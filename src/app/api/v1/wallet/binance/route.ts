export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createBinancePayOrder } from '@/lib/binance-pay';
import prisma from '@/lib/prisma';

// POST /api/v1/wallet/binance — Create Binance Pay order
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { amount } = await request.json();

        if (!amount || amount < 2000) {
            return NextResponse.json({ success: false, message: 'Số tiền tối thiểu 2,000đ' }, { status: 400 });
        }

        // Convert VND to USDT (configurable rate)
        const usdtRate = parseInt(process.env.BINANCE_USDT_VND_RATE || '25000');
        const usdtAmount = parseFloat((amount / usdtRate).toFixed(2));

        if (usdtAmount < 0.01) {
            return NextResponse.json({ success: false, message: 'Số tiền quá nhỏ để thanh toán bằng USDT' }, { status: 400 });
        }

        const merchantTradeNo = `CTN_BP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const description = `Nap ${amount.toLocaleString()} VND vao vi ChoTaiNguyen`;

        // Store pending deposit in DB
        try {
            await prisma.deposit.create({
                data: {
                    userId: authResult.userId,
                    amount,
                    method: 'BINANCE_PAY',
                    referenceCode: merchantTradeNo,
                    status: 'PENDING',
                },
            });
        } catch (dbErr) {
            console.warn('[BinancePay] Could not store deposit record:', dbErr);
        }

        const result = await createBinancePayOrder({
            merchantTradeNo,
            orderAmount: usdtAmount,
            currency: 'USDT',
            description,
        });

        return NextResponse.json({
            success: true,
            data: {
                merchantTradeNo,
                checkoutUrl: result.data.checkoutUrl,
                qrcodeLink: result.data.qrcodeLink,
                qrContent: result.data.qrContent,
                deeplink: result.data.deeplink,
                universalUrl: result.data.universalUrl,
                totalFee: result.data.totalFee,
                currency: result.data.currency,
                expireTime: result.data.expireTime,
                amountVND: amount,
                amountUSDT: usdtAmount,
                rate: usdtRate,
            },
        });
    } catch (error: any) {
        console.error('[BinancePay] Create order error:', error);
        return NextResponse.json({
            success: false,
            message: error.message || 'Không thể tạo thanh toán Binance Pay',
        }, { status: 500 });
    }
}
