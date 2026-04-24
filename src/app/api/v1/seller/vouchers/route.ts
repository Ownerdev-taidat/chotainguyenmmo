export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Seller Voucher API
 * GET  — List vouchers
 * POST — Create voucher
 * PUT  — Update voucher
 * DELETE — Deactivate voucher
 */

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: true, data: { vouchers: [], stats: { total: 0, active: 0, used: 0, totalDiscount: 0 } } });

        const vouchers = await prisma.voucher.findMany({
            where: { shopId: shop.id },
            orderBy: { createdAt: 'desc' },
            include: {
                product: { select: { id: true, name: true } },
            },
        });

        const stats = {
            total: vouchers.length,
            active: vouchers.filter(v => v.isActive && (!v.expiresAt || v.expiresAt > new Date())).length,
            used: vouchers.reduce((sum, v) => sum + v.usedCount, 0),
            totalDiscount: 0, // Could be calculated from orders
        };

        return NextResponse.json({
            success: true,
            data: {
                vouchers: vouchers.map(v => ({
                    id: v.id,
                    code: v.code,
                    discountType: v.discountType,
                    discountValue: v.discountValue,
                    minOrderAmount: v.minOrderAmount,
                    maxDiscount: v.maxDiscount,
                    productId: v.productId,
                    productName: v.product?.name || null,
                    usageLimit: v.usageLimit,
                    usedCount: v.usedCount,
                    isActive: v.isActive,
                    startsAt: v.startsAt.toISOString(),
                    expiresAt: v.expiresAt?.toISOString() || null,
                    createdAt: v.createdAt.toISOString(),
                })),
                stats,
            },
        });
    } catch (error) {
        console.error('[Seller Voucher] GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const body = await request.json();
        const { code, discountType, discountValue, minOrderAmount, maxDiscount, productId, usageLimit, expiresAt } = body;

        if (!code || !discountValue) {
            return NextResponse.json({ success: false, message: 'Cần mã giảm giá và giá trị giảm' }, { status: 400 });
        }

        // Check unique code
        const existing = await prisma.voucher.findUnique({ where: { code: code.toUpperCase().trim() } });
        if (existing) {
            return NextResponse.json({ success: false, message: 'Mã giảm giá đã tồn tại' }, { status: 400 });
        }

        // Verify productId belongs to this shop if provided
        if (productId) {
            const product = await prisma.product.findFirst({ where: { id: productId, shopId: shop.id } });
            if (!product) return NextResponse.json({ success: false, message: 'Sản phẩm không tồn tại' }, { status: 400 });
        }

        const voucher = await prisma.voucher.create({
            data: {
                shopId: shop.id,
                code: code.toUpperCase().trim(),
                discountType: discountType || 'PERCENT',
                discountValue: parseInt(discountValue),
                minOrderAmount: minOrderAmount ? parseInt(minOrderAmount) : null,
                maxDiscount: maxDiscount ? parseInt(maxDiscount) : null,
                productId: productId || null,
                usageLimit: parseInt(usageLimit) || 100,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
        });

        return NextResponse.json({
            success: true,
            message: `Đã tạo mã giảm giá ${voucher.code}`,
            data: { id: voucher.id, code: voucher.code },
        });
    } catch (error) {
        console.error('[Seller Voucher] POST error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi tạo voucher' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const body = await request.json();
        const { id, discountType, discountValue, minOrderAmount, maxDiscount, productId, usageLimit, expiresAt, isActive } = body;

        if (!id) return NextResponse.json({ success: false, message: 'Thiếu ID voucher' }, { status: 400 });

        const voucher = await prisma.voucher.findFirst({ where: { id, shopId: shop.id } });
        if (!voucher) return NextResponse.json({ success: false, message: 'Không tìm thấy voucher' }, { status: 404 });

        await prisma.voucher.update({
            where: { id },
            data: {
                discountType: discountType || voucher.discountType,
                discountValue: discountValue ? parseInt(discountValue) : voucher.discountValue,
                minOrderAmount: minOrderAmount !== undefined ? (minOrderAmount ? parseInt(minOrderAmount) : null) : voucher.minOrderAmount,
                maxDiscount: maxDiscount !== undefined ? (maxDiscount ? parseInt(maxDiscount) : null) : voucher.maxDiscount,
                productId: productId !== undefined ? (productId || null) : voucher.productId,
                usageLimit: usageLimit ? parseInt(usageLimit) : voucher.usageLimit,
                expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : voucher.expiresAt,
                isActive: isActive !== undefined ? isActive : voucher.isActive,
            },
        });

        return NextResponse.json({ success: true, message: 'Đã cập nhật voucher' });
    } catch (error) {
        console.error('[Seller Voucher] PUT error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi cập nhật' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ success: false, message: 'Thiếu ID voucher' }, { status: 400 });

        const voucher = await prisma.voucher.findFirst({ where: { id, shopId: shop.id } });
        if (!voucher) return NextResponse.json({ success: false, message: 'Không tìm thấy voucher' }, { status: 404 });

        await prisma.voucher.delete({ where: { id } });

        return NextResponse.json({ success: true, message: 'Đã xóa voucher' });
    } catch (error) {
        console.error('[Seller Voucher] DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi xóa' }, { status: 500 });
    }
}
