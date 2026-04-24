export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Seller Shop Settings API
 * GET — Get shop settings
 * PUT — Update shop settings
 */

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({
            where: { ownerId: authResult.userId },
            include: { owner: { select: { email: true, phone: true } } },
        });

        if (!shop) {
            return NextResponse.json({ success: true, data: null });
        }

        return NextResponse.json({
            success: true,
            data: {
                id: shop.id,
                name: shop.name,
                logoUrl: shop.logoUrl || '',
                description: shop.shortDescription || '',
                email: shop.owner.email,
                phone: shop.owner.phone || '',
                bankName: shop.bankName || '',
                bankAccount: shop.bankAccount || '',
                bankAccountName: shop.bankAccountName || '',
                bankBranch: shop.bankBranch || '',
            },
        });
    } catch (error) {
        console.error('[Seller Settings] GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 404 });

        const body = await request.json();
        const { name, description, phone, bankName, bankAccount, bankAccountName, bankBranch, logoUrl } = body;

        await prisma.shop.update({
            where: { id: shop.id },
            data: {
                ...(name && { name: name.trim() }),
                ...(logoUrl !== undefined && { logoUrl }),
                ...(description !== undefined && { shortDescription: description.trim() }),
                ...(bankName !== undefined && { bankName }),
                ...(bankAccount !== undefined && { bankAccount }),
                ...(bankAccountName !== undefined && { bankAccountName }),
                ...(bankBranch !== undefined && { bankBranch }),
            },
        });

        if (phone !== undefined) {
            await prisma.user.update({
                where: { id: authResult.userId },
                data: { phone },
            });
        }

        return NextResponse.json({ success: true, message: 'Đã lưu cài đặt' });
    } catch (error) {
        console.error('[Seller Settings] PUT error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi cập nhật' }, { status: 500 });
    }
}
