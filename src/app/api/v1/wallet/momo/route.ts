export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createMoMoPayment } from '@/lib/momo';
import prisma from '@/lib/prisma';

// POST /api/v1/wallet/momo — Create MoMo payment
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { amount } = await request.json();

        if (!amount || amount < 2000) {
            return NextResponse.json({ success: false, message: 'Số tiền tối thiểu 2,000đ' }, { status: 400 });
        }

        const orderId = `CTN_MOMO_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const orderInfo = `Nap tien vao vi ChoTaiNguyen`;

        // Store pending order in DB so IPN can look it up
        // extraData must be empty string per reference code
        try {
            await prisma.deposit.create({
                data: {
                    userId: authResult.userId,
                    amount,
                    method: 'MOMO',
                    referenceCode: orderId,
                    status: 'PENDING',
                },
            });
        } catch (dbErr) {
            console.warn('[MoMo] Could not store deposit record:', dbErr);
        }

        const result = await createMoMoPayment({
            orderId,
            amount,
            orderInfo,
        });

        return NextResponse.json({
            success: true,
            data: {
                orderId,
                payUrl: result.payUrl,
                shortLink: result.shortLink,
                qrCodeUrl: result.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.payUrl)}`,
                amount,
            },
        });
    } catch (error: any) {
        console.error('[MoMo] Create payment error:', error);
        return NextResponse.json({
            success: false,
            message: error.message || 'Không thể tạo thanh toán MoMo',
        }, { status: 500 });
    }
}
