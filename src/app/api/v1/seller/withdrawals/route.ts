export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendWithdrawalNotification } from '@/lib/telegram-withdraw';

/**
 * Seller Withdrawals API
 * GET  — List withdrawal history + balance
 * POST — Create withdrawal request (with rate limit, configurable limits, Telegram notification)
 */

/** Load withdrawal settings from DB platform_settings JSON */
async function getWithdrawSettings() {
    try {
        const record = await prisma.setting.findUnique({ where: { key: 'platform_settings' } });
        if (record) {
            const s = JSON.parse(record.value);
            return {
                fee: s.withdrawalFee != null ? Number(s.withdrawalFee) : 15000,
                min: s.minWithdraw != null ? Number(s.minWithdraw) : 50000,
                max: s.maxWithdraw != null ? Number(s.maxWithdraw) : 10000000,
                dailyLimit: s.withdrawDailyLimit != null ? Number(s.withdrawDailyLimit) : 3,
                cooldownMinutes: s.withdrawCooldownMinutes != null ? Number(s.withdrawCooldownMinutes) : 30,
            };
        }
    } catch (e) {
        console.error('[Withdraw Settings] Error:', e);
    }
    return { fee: 15000, min: 50000, max: 10000000, dailyLimit: 3, cooldownMinutes: 30 };
}

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const config = await getWithdrawSettings();
        const [withdrawals, wallet] = await Promise.all([
            prisma.withdrawal.findMany({
                where: { userId: authResult.userId },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.wallet.findUnique({ where: { userId: authResult.userId } }),
        ]);

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
                config: {
                    fee: config.fee,
                    min: config.min,
                    max: config.max,
                    dailyLimit: config.dailyLimit,
                    cooldownMinutes: config.cooldownMinutes,
                },
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
        const config = await getWithdrawSettings();

        // ── Validation ──
        if (!amount || amount < config.min) {
            return NextResponse.json({ success: false, message: `Số tiền rút tối thiểu ${config.min.toLocaleString('vi-VN')}đ` }, { status: 400 });
        }
        if (amount > config.max) {
            return NextResponse.json({ success: false, message: `Số tiền rút tối đa ${config.max.toLocaleString('vi-VN')}đ/lần` }, { status: 400 });
        }
        if (!accountNumber || !accountName || !bankName) {
            return NextResponse.json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin ngân hàng' }, { status: 400 });
        }

        // ── Rate Limit: max N withdrawals/day ──
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = await prisma.withdrawal.count({
            where: {
                userId: authResult.userId,
                createdAt: { gte: todayStart },
            },
        });
        if (todayCount >= config.dailyLimit) {
            return NextResponse.json({
                success: false,
                message: `Bạn đã rút ${config.dailyLimit} lần hôm nay. Vui lòng thử lại ngày mai.`,
            }, { status: 429 });
        }

        // ── Cooldown: min N minutes between withdrawals ──
        const lastWithdrawal = await prisma.withdrawal.findFirst({
            where: { userId: authResult.userId },
            orderBy: { createdAt: 'desc' },
        });
        if (lastWithdrawal) {
            const diffMs = Date.now() - lastWithdrawal.createdAt.getTime();
            const diffMinutes = diffMs / 60000;
            if (diffMinutes < config.cooldownMinutes) {
                const remaining = Math.ceil(config.cooldownMinutes - diffMinutes);
                return NextResponse.json({
                    success: false,
                    message: `Vui lòng chờ ${remaining} phút nữa trước khi rút tiền tiếp.`,
                }, { status: 429 });
            }
        }

        // ── Balance check ──
        const wallet = await prisma.wallet.findUnique({ where: { userId: authResult.userId } });
        if (!wallet || wallet.availableBalance < amount) {
            return NextResponse.json({ success: false, message: 'Số dư không đủ' }, { status: 400 });
        }

        const netAmount = amount - config.fee;
        if (netAmount <= 0) {
            return NextResponse.json({ success: false, message: 'Số tiền sau phí phải lớn hơn 0' }, { status: 400 });
        }

        // ── Create withdrawal + deduct wallet (atomic) ──
        const withdrawal = await prisma.$transaction(async (tx) => {
            await tx.wallet.update({
                where: { userId: authResult.userId },
                data: {
                    availableBalance: { decrement: amount },
                    totalWithdrawn: { increment: netAmount },
                },
            });

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

            return tx.withdrawal.create({
                data: {
                    userId: authResult.userId,
                    amount,
                    feeAmount: config.fee,
                    netAmount,
                    method: 'bank_transfer',
                    bankName,
                    accountNumber,
                    accountName,
                    status: 'PENDING',
                },
            });
        });

        // Get seller name for Telegram notification
        const user = await prisma.user.findUnique({
            where: { id: authResult.userId },
            select: { fullName: true, username: true },
        });

        // ── Send Telegram notification to all admins (fire & forget) ──
        sendWithdrawalNotification({
            id: withdrawal.id,
            sellerName: user?.fullName || user?.username || 'Unknown',
            amount,
            fee: config.fee,
            netAmount,
            bankName,
            accountNumber,
            accountName,
        }).catch(e => console.error('[Withdrawal] Telegram notify error:', e));

        return NextResponse.json({
            success: true,
            message: `Đã tạo yêu cầu rút ${amount.toLocaleString('vi-VN')}đ. Phí: ${config.fee.toLocaleString('vi-VN')}đ. Chờ admin duyệt.`,
            data: { id: withdrawal.id },
        });
    } catch (error) {
        console.error('[Seller Withdrawals] POST error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi tạo yêu cầu rút tiền' }, { status: 500 });
    }
}
