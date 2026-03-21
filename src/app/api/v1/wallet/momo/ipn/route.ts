import { NextRequest, NextResponse } from 'next/server';
import { verifyMoMoSignature } from '@/lib/momo';
import prisma from '@/lib/prisma';

// POST /api/v1/wallet/momo/ipn — MoMo IPN Callback (webhook)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('[MoMo IPN] Received:', JSON.stringify(body));

        // Verify signature
        if (!verifyMoMoSignature(body)) {
            console.error('[MoMo IPN] Invalid signature');
            return NextResponse.json({ status: 1, message: 'Invalid signature' });
        }

        // Check payment result
        if (body.resultCode !== 0) {
            console.log('[MoMo IPN] Payment failed:', body.message);
            // Update deposit status to FAILED
            if (body.orderId) {
                await prisma.deposit.updateMany({
                    where: { referenceCode: body.orderId, status: 'PENDING' },
                    data: { status: 'FAILED' },
                }).catch(() => {});
            }
            return NextResponse.json({ status: 0, message: 'ok' });
        }

        const orderId = body.orderId;
        const amount = Number(body.amount);

        // Look up deposit record from DB by orderId
        const deposit = await prisma.deposit.findFirst({
            where: { referenceCode: orderId },
        });

        if (!deposit) {
            console.error('[MoMo IPN] Deposit not found for orderId:', orderId);
            return NextResponse.json({ status: 1, message: 'Deposit not found' });
        }

        if (deposit.status === 'COMPLETED') {
            console.log('[MoMo IPN] Already processed:', orderId);
            return NextResponse.json({ status: 0, message: 'ok' });
        }

        const userId = deposit.userId;

        // Credit user wallet via Prisma
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            console.error('[MoMo IPN] Wallet not found for user:', userId);
            return NextResponse.json({ status: 1, message: 'Wallet not found' });
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
                    description: `Nạp tiền qua MoMo — ${orderId}`,
                },
            }),
            prisma.deposit.update({
                where: { id: deposit.id },
                data: { status: 'COMPLETED', completedAt: new Date() },
            }),
        ]);

        console.log(`[MoMo IPN] ✅ Credited ${amount}đ to user ${userId}. New balance: ${newBalance}đ`);

        // MoMo requires { status: 0 } response
        return NextResponse.json({ status: 0, message: 'ok' });
    } catch (error) {
        console.error('[MoMo IPN] Error:', error);
        return NextResponse.json({ status: 1, message: 'Internal error' });
    }
}
