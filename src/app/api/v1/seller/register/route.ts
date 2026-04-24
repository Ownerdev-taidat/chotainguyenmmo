export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * Seller Registration API — Prisma DB
 * 
 * GET    — Check seller status / list all shops (admin)
 * POST   — Register new shop
 * PUT    — Admin review / settings
 */

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now().toString(36);
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const view = searchParams.get('view');

    // Admin: list all shops
    if (view === 'all') {
        try {
            const shops = await prisma.shop.findMany({
                orderBy: { createdAt: 'desc' },
                include: { owner: { select: { fullName: true, username: true, email: true } } },
            });
            return NextResponse.json({
                success: true,
                data: shops.map(s => ({
                    id: s.id,
                    userId: s.ownerId,
                    username: s.owner.username,
                    userEmail: s.owner.email,
                    shopName: s.name,
                    bankName: s.bankName || '',
                    bankAccount: s.bankAccount || '',
                    bankOwner: s.bankAccountName || '',
                    status: s.status,
                    kycCompleted: true,
                    createdAt: s.createdAt.toISOString(),
                })),
            });
        } catch (error) {
            console.error('List shops error:', error);
            return NextResponse.json({ success: true, data: [] });
        }
    }

    // Admin: pending shops
    if (view === 'pending') {
        try {
            const shops = await prisma.shop.findMany({
                where: { status: 'PENDING' },
                orderBy: { createdAt: 'desc' },
                include: { owner: { select: { fullName: true, username: true, email: true } } },
            });
            return NextResponse.json({ success: true, data: shops });
        } catch {
            return NextResponse.json({ success: true, data: [] });
        }
    }

    // Admin: settings (return defaults)
    if (view === 'settings') {
        return NextResponse.json({
            success: true,
            data: { kycRequired: false, autoApprove: false, autoApproveWhenKycOff: true },
        });
    }

    // User: check own seller status
    if (userId) {
        try {
            const shop = await prisma.shop.findUnique({ where: { ownerId: userId } });
            return NextResponse.json({
                success: true,
                data: shop ? {
                    id: shop.id,
                    shopName: shop.name,
                    status: shop.status,
                } : null,
                isActiveSeller: shop?.status === 'ACTIVE',
                needsKyc: false,
            });
        } catch {
            return NextResponse.json({
                success: true,
                data: null,
                isActiveSeller: false,
                needsKyc: false,
            });
        }
    }

    return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { userId, shopName, bankName, bankAccount, bankOwner } = body;

    if (!userId || !shopName || !bankName || !bankAccount || !bankOwner) {
        return NextResponse.json({
            success: false,
            message: 'Vui lòng điền đầy đủ thông tin: tên shop, ngân hàng, số tài khoản, tên chủ TK',
        }, { status: 400 });
    }

    try {
        // Check if user already has a shop
        const existing = await prisma.shop.findUnique({ where: { ownerId: userId } });
        if (existing) {
            if (existing.status === 'ACTIVE' || existing.status === 'PENDING') {
                return NextResponse.json({
                    success: false,
                    message: 'Bạn đã có đơn đăng ký. Vui lòng chờ duyệt hoặc liên hệ admin.',
                }, { status: 400 });
            }
            // If rejected, allow re-registration by deleting old shop
            await prisma.shop.delete({ where: { id: existing.id } });
        }

        // Create shop in Prisma — auto-approve for now (no KYC)
        const shop = await prisma.shop.create({
            data: {
                ownerId: userId,
                name: shopName,
                slug: generateSlug(shopName),
                bankName,
                bankAccount,
                bankAccountName: bankOwner,
                status: 'ACTIVE', // Auto-approve
            },
        });

        // Upgrade user role to SELLER
        await prisma.user.update({
            where: { id: userId },
            data: { role: 'SELLER' },
        });

        return NextResponse.json({
            success: true,
            message: '🎉 Gian hàng đã được tạo thành công! Bạn có thể bắt đầu bán hàng ngay.',
            data: {
                id: shop.id,
                shopName: shop.name,
                status: shop.status,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Create shop error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const body = await req.json();
    const { action } = body;

    // Admin: review application
    if (action === 'review') {
        const { appId, decision, reason } = body;
        if (!appId || !decision) {
            return NextResponse.json({ success: false, message: 'appId and decision required' }, { status: 400 });
        }

        try {
            const shop = await prisma.shop.findUnique({ where: { id: appId } });
            if (!shop) return NextResponse.json({ success: false, message: 'Shop not found' }, { status: 404 });

            const newStatus = decision === 'APPROVED' ? 'ACTIVE' : 'REJECTED';
            await prisma.shop.update({
                where: { id: appId },
                data: { status: newStatus },
            });

            // If approved, upgrade user role
            if (decision === 'APPROVED') {
                await prisma.user.update({
                    where: { id: shop.ownerId },
                    data: { role: 'SELLER' },
                });
            }

            return NextResponse.json({
                success: true,
                message: decision === 'APPROVED' ? 'Đã duyệt gian hàng' : 'Đã từ chối đơn đăng ký',
            });
        } catch (error) {
            console.error('Review error:', error);
            return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
        }
    }

    // Admin: delete shop
    if (action === 'delete') {
        const { appId } = body;
        if (!appId) return NextResponse.json({ success: false, message: 'appId required' }, { status: 400 });

        try {
            const shop = await prisma.shop.findUnique({ where: { id: appId } });
            if (!shop) return NextResponse.json({ success: false, message: 'Shop not found' }, { status: 404 });

            await prisma.shop.delete({ where: { id: appId } });

            // Downgrade user role
            await prisma.user.update({
                where: { id: shop.ownerId },
                data: { role: 'USER' },
            });

            return NextResponse.json({ success: true, message: 'Đã xóa gian hàng' });
        } catch (error) {
            console.error('Delete shop error:', error);
            return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
        }
    }

    // Admin: update settings (no-op for now since using Prisma Settings model)
    if (action === 'updateSettings') {
        return NextResponse.json({ success: true, message: 'Cập nhật cài đặt thành công', data: body });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
}
