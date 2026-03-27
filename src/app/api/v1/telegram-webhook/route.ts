import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    getWithdrawAdminChatIds,
    showTransferDetails,
    confirmTransferDone,
    showRejected,
} from '@/lib/telegram-withdraw';
import { createNotification } from '@/lib/notifications';

/**
 * POST /api/v1/telegram-webhook
 * Handles Telegram bot callback queries for withdrawal approval
 * 
 * Security:
 * - Only configured admin Chat IDs can interact
 * - Idempotency: each withdrawal can only be processed once
 * - Atomic transactions for balance changes
 */

export async function POST(request: NextRequest) {
    try {
        const update = await request.json();

        // Only handle callback queries (button clicks)
        const callback = update.callback_query;
        if (!callback) {
            return NextResponse.json({ ok: true });
        }

        const chatId = String(callback.from?.id || '');
        const messageId = callback.message?.message_id;
        const callbackQueryId = callback.id;
        const data = callback.data || '';
        const adminName = callback.from?.first_name || 'Admin';

        // Verify admin
        const adminIds = await getWithdrawAdminChatIds();
        if (!adminIds.includes(chatId)) {
            return NextResponse.json({ ok: true }); // Silently ignore non-admins
        }

        // Parse callback data: "wd_approve:withdrawalId" | "wd_reject:withdrawalId" | "wd_done:withdrawalId"
        const [action, withdrawalId] = data.split(':');
        if (!withdrawalId || !['wd_approve', 'wd_reject', 'wd_done'].includes(action)) {
            return NextResponse.json({ ok: true });
        }

        // Load withdrawal
        const withdrawal = await prisma.withdrawal.findUnique({
            where: { id: withdrawalId },
            include: {
                user: { select: { fullName: true, username: true } },
            },
        });

        if (!withdrawal) {
            return NextResponse.json({ ok: true });
        }

        const info = {
            id: withdrawal.id,
            sellerName: withdrawal.user.fullName || withdrawal.user.username,
            amount: withdrawal.amount,
            fee: withdrawal.feeAmount,
            netAmount: withdrawal.netAmount,
            bankName: withdrawal.bankName || '',
            accountNumber: withdrawal.accountNumber || '',
            accountName: withdrawal.accountName || '',
        };

        // ── APPROVE ──
        if (action === 'wd_approve') {
            // Idempotency: only approve if PENDING
            if (withdrawal.status !== 'PENDING') {
                return NextResponse.json({ ok: true });
            }

            // Show transfer details (step 2)
            await showTransferDetails(chatId, messageId, callbackQueryId, info, adminName);
            return NextResponse.json({ ok: true });
        }

        // ── CONFIRM TRANSFER DONE ──
        if (action === 'wd_done') {
            if (withdrawal.status !== 'PENDING') {
                return NextResponse.json({ ok: true });
            }

            // Update withdrawal status to COMPLETED
            await prisma.withdrawal.update({
                where: { id: withdrawalId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    approvedBy: `telegram:${chatId}`,
                    approvedAt: new Date(),
                },
            });

            // Update Telegram message
            await confirmTransferDone(chatId, messageId, callbackQueryId, info, adminName);

            // Notify seller on web
            await createNotification({
                userId: withdrawal.userId,
                type: 'WITHDRAWAL',
                title: 'Rút tiền thành công',
                message: `Yêu cầu rút ${info.netAmount.toLocaleString('vi-VN')}đ đã được chuyển vào ${info.bankName} ****${info.accountNumber.slice(-4)}.`,
                link: '/seller/rut-tien',
            });

            return NextResponse.json({ ok: true });
        }

        // ── REJECT ──
        if (action === 'wd_reject') {
            if (withdrawal.status !== 'PENDING') {
                return NextResponse.json({ ok: true });
            }

            // Reject + refund in transaction
            await prisma.$transaction(async (tx) => {
                await tx.withdrawal.update({
                    where: { id: withdrawalId },
                    data: {
                        status: 'REJECTED',
                        completedAt: new Date(),
                        rejectedReason: `Từ chối bởi ${adminName} (Telegram)`,
                    },
                });

                // Refund to wallet
                const wallet = await tx.wallet.findUnique({ where: { userId: withdrawal.userId } });
                if (wallet) {
                    await tx.wallet.update({
                        where: { userId: withdrawal.userId },
                        data: {
                            availableBalance: { increment: withdrawal.amount },
                            totalWithdrawn: { decrement: withdrawal.netAmount },
                        },
                    });

                    const updatedWallet = await tx.wallet.findUnique({ where: { userId: withdrawal.userId } });
                    await tx.walletTransaction.create({
                        data: {
                            walletId: wallet.id,
                            type: 'REFUND',
                            direction: 'CREDIT',
                            amount: withdrawal.amount,
                            balanceAfter: updatedWallet?.availableBalance || 0,
                            description: `Hoàn tiền rút tiền bị từ chối — ${adminName}`,
                            referenceType: 'withdrawal',
                            referenceId: withdrawal.id,
                        },
                    });
                }
            });

            // Update Telegram message
            await showRejected(chatId, messageId, callbackQueryId, info, adminName);

            // Notify seller on web
            await createNotification({
                userId: withdrawal.userId,
                type: 'WITHDRAWAL',
                title: 'Yêu cầu rút tiền bị từ chối',
                message: `Yêu cầu rút ${info.amount.toLocaleString('vi-VN')}đ đã bị từ chối. Tiền đã hoàn về ví.`,
                link: '/seller/rut-tien',
            });

            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Telegram Webhook] Error:', error);
        return NextResponse.json({ ok: true }); // Always return 200 for Telegram
    }
}
