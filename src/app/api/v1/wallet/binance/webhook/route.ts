import { NextRequest, NextResponse } from 'next/server';
import { verifyBinancePayWebhook } from '@/lib/binance-pay';
import prisma from '@/lib/prisma';

// POST /api/v1/wallet/binance/webhook — Binance Pay webhook callback
export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const body = JSON.parse(rawBody);

        console.log('[BinancePay Webhook] Received:', JSON.stringify(body));

        // Verify signature
        const timestamp = request.headers.get('BinancePay-Timestamp') || '';
        const nonce = request.headers.get('BinancePay-Nonce') || '';
        const signature = request.headers.get('BinancePay-Signature') || '';

        if (!verifyBinancePayWebhook(timestamp, nonce, rawBody, signature)) {
            console.error('[BinancePay Webhook] Invalid signature');
            return NextResponse.json({ returnCode: 'FAIL', returnMessage: 'Invalid signature' });
        }

        // Binance Pay webhook types: PAY, PAY_REFUND, etc.
        if (body.bizType !== 'PAY') {
            console.log('[BinancePay Webhook] Ignoring non-PAY event:', body.bizType);
            return NextResponse.json({ returnCode: 'SUCCESS', returnMessage: null });
        }

        const bizData = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
        const merchantTradeNo = bizData.merchantTradeNo;
        const transactionId = bizData.transactionId;
        const orderStatus = bizData.tradeType || bizData.orderStatus;

        // Look up deposit by merchantTradeNo
        const deposit = await prisma.deposit.findFirst({
            where: { referenceCode: merchantTradeNo },
        });

        if (!deposit) {
            console.error('[BinancePay Webhook] Deposit not found:', merchantTradeNo);
            return NextResponse.json({ returnCode: 'FAIL', returnMessage: 'Deposit not found' });
        }

        if (deposit.status === 'COMPLETED') {
            console.log('[BinancePay Webhook] Already processed:', merchantTradeNo);
            return NextResponse.json({ returnCode: 'SUCCESS', returnMessage: null });
        }

        const userId = deposit.userId;
        const amount = deposit.amount; // VND amount stored when order was created

        // Credit user wallet
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            console.error('[BinancePay Webhook] Wallet not found for user:', userId);
            return NextResponse.json({ returnCode: 'FAIL', returnMessage: 'Wallet not found' });
        }

        const newBalance = wallet.availableBalance + amount;
        await prisma.$transaction([
            prisma.wallet.update({
                where: { userId },
                data: { availableBalance: newBalance, totalDeposited: { increment: amount } },
            }),
            prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'DEPOSIT',
                    direction: 'CREDIT',
                    amount,
                    balanceAfter: newBalance,
                    description: `Nạp tiền qua Binance Pay — ${merchantTradeNo}`,
                },
            }),
            prisma.deposit.update({
                where: { id: deposit.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    bankTxnId: transactionId,
                },
            }),
        ]);

        console.log(`[BinancePay Webhook] ✅ Credited ${amount}đ to user ${userId}. New balance: ${newBalance}đ`);

        return NextResponse.json({ returnCode: 'SUCCESS', returnMessage: null });
    } catch (error) {
        console.error('[BinancePay Webhook] Error:', error);
        return NextResponse.json({ returnCode: 'FAIL', returnMessage: 'Internal error' });
    }
}
