import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/v1/vouchers/validate?code=XXX&shopId=YYY&productId=ZZZ
 * Public route — validates a voucher code for checkout
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code')?.toUpperCase().trim();
        const shopId = searchParams.get('shopId');
        const productId = searchParams.get('productId');

        if (!code) {
            return NextResponse.json({ success: false, message: 'Thiếu mã voucher' }, { status: 400 });
        }

        // Find voucher by code
        const where: Record<string, unknown> = { code, isActive: true };

        const voucher = await prisma.voucher.findFirst({ where });

        if (!voucher) {
            return NextResponse.json({ success: false, message: 'Mã giảm giá không tồn tại' }, { status: 404 });
        }

        // Check shop match — if shopId provided, voucher must belong to that shop
        if (shopId) {
            const shop = await prisma.shop.findFirst({ where: { ownerId: shopId } });
            if (shop && voucher.shopId !== shop.id) {
                return NextResponse.json({ success: false, message: 'Mã không áp dụng cho shop này' }, { status: 400 });
            }
        }

        // Check expiry
        if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
            return NextResponse.json({ success: false, message: 'Mã giảm giá đã hết hạn' }, { status: 400 });
        }

        // Check usage
        if (voucher.usedCount >= voucher.usageLimit) {
            return NextResponse.json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng' }, { status: 400 });
        }

        // Check product scope
        if (voucher.productId && productId && voucher.productId !== productId) {
            return NextResponse.json({ success: false, message: 'Mã không áp dụng cho sản phẩm này' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: {
                discountType: voucher.discountType,
                discountValue: voucher.discountValue,
                minOrderAmount: voucher.minOrderAmount,
                maxDiscount: voucher.maxDiscount,
                usageLimit: voucher.usageLimit,
                usedCount: voucher.usedCount,
                expiresAt: voucher.expiresAt?.toISOString() || null,
            },
        });
    } catch (error) {
        console.error('[Voucher Validate] Error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
