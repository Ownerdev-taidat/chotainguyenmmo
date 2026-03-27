import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Seller Withdrawals API
 * GET  — List withdrawal history
 * POST — Create withdrawal request
 */

const WITHDRAWAL_FEE = 15000; // 15,000đ per withdrawal
const MIN_WITHDRAWAL = 50000; // 50,000đ minimum

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const [withdrawals, wallet] = await Promise.all([
            prisma.withdrawal.findMany({
                where: { userId: authResult.userId },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.wallet.findUnique({ where: { userId: authResult.userId } }),
        ]);

        // Calculate pending withdrawal amount
        const pendingAmount = withdrawals
            .filter(w => w.status === 'PENDING')
            .reduce((sum, w) => sum + w.amount, 0);

        const totalWithdrawn = wallet?.totalWithdrawn || 0;

        return NextResponse.json({
            success: true,
            data: {
                withdrawals: withdrawals.map(w => ({
                    id: w.id,
                    code: `RT-${w.id.slice(-6).toUpperCase()}`,
                    amount: w.amount,
                    fee: w.feeAmount,
                    netAmount: w.netAmount,
                    method: `${w.bankName || ''} ****${(w.accountNumber || '').slice(-4)}`,
                    bankName: w.bankName,
                    bankAccount: w.accountNumber,
                    bankOwner: w.accountName,
                    status: w.status.toLowerCase(),
                    createdAt: w.createdAt.toISOString(),
                    completedAt: w.completedAt?.toISOString() || null,
                })),
                balance: wallet?.availableBalance || 0,
                pendingAmount,
                totalWithdrawn,
            },
        });
    } catch (error) {
        console.error('[Seller Withdrawals] GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const body = await request.json();
        const { amount, bankName, accountNumber, accountName } = body;

        if (!amount || amount < MIN_WITHDRAWAL) {
            return NextResponse.json({ success: false, message: `Số tiền rút tối thiểu ${MIN_WITHDRAWAL.toLocaleString('vi-VN')}đ` }, { status: 400 });
        }
        if (!accountNumber || !accountName || !bankName) {
            return NextResponse.json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin ngân hàng' }, { status: 400 });
        }

        // Check wallet balance
        const wallet = await prisma.wallet.findUnique({ where: { userId: authResult.userId } });
        if (!wallet || wallet.availableBalance < amount) {
            return NextResponse.json({ success: false, message: 'Số dư không đủ' }, { status: 400 });
        }

        const netAmount = amount - WITHDRAWAL_FEE;
        if (netAmount <= 0) {
            return NextResponse.json({ success: false, message: 'Số tiền sau phí phải lớn hơn 0' }, { status: 400 });
        }

        // Create withdrawal + deduct from wallet in transaction
        const withdrawal = await prisma.$transaction(async (tx) => {
            // Deduct from wallet
            await tx.wallet.update({
                where: { userId: authResult.userId },
                data: {
                    availableBalance: { decrement: amount },
                    totalWithdrawn: { increment: netAmount },
                },
            });

            // Create wallet transaction
            const updatedWallet = await tx.wallet.findUnique({ where: { userId: authResult.userId } });
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'WITHDRAWAL',
                    direction: 'DEBIT',
                    amount,
                    balanceAfter: updatedWallet?.availableBalance || 0,
                    description: `Rút tiền về ${bankName} ****${accountNumber.slice(-4)}`,
                },
            });

            // Create withdrawal record
            return tx.withdrawal.create({
                data: {
                    userId: authResult.userId,
                    amount,
                    feeAmount: WITHDRAWAL_FEE,
                    netAmount,
                    method: 'bank_transfer',
                    bankName,
                    accountNumber,
                    accountName,
                    status: 'PENDING',
                },
            });
        });

        return NextResponse.json({
            success: true,
            message: `Đã tạo yêu cầu rút ${amount.toLocaleString('vi-VN')}đ. Phí: ${WITHDRAWAL_FEE.toLocaleString('vi-VN')}đ`,
            data: { id: withdrawal.id },
        });
    } catch (error) {
        console.error('[Seller Withdrawals] POST error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi tạo yêu cầu rút tiền' }, { status: 500 });
    }
}
