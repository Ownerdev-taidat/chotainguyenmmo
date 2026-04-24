export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPlatformSettings } from '@/lib/mock-order-store';

const HOLD_DAYS = 7;

/**
 * GET /api/v1/cron/release-funds — Auto-release seller held funds after 7 days
 * Should be called periodically (e.g., every hour) by a cron job or scheduler.
 * Can also be called manually by admin.
 */
export async function GET(request: NextRequest) {
    // Optional: verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'ctn-cron-2026';
    if (authHeader !== `Bearer ${cronSecret}`) {
        // Also allow admin_token
        const token = authHeader?.replace('Bearer ', '');
        if (token) {
            try {
                const { jwtVerify } = await import('jose');
                const JWT_SECRET = new TextEncoder().encode(
                    process.env.JWT_SECRET || 'chotainguyen-secret-key-change-in-production'
                );
                const { payload } = await jwtVerify(token, JWT_SECRET);
                if (!['ADMIN', 'SUPER_ADMIN'].includes((payload as any).role || '')) {
                    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
                }
            } catch {
                return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
            }
        } else {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - HOLD_DAYS);

        // Find completed orders older than 7 days that haven't been released
        const ordersToRelease = await prisma.order.findMany({
            where: {
                status: { in: ['COMPLETED', 'PAID'] },
                completedAt: { lte: cutoffDate },
                // Check if seller was already paid by looking for a RELEASE transaction
            },
            include: {
                shop: { select: { ownerId: true } },
                items: { include: { product: { select: { name: true } } }, take: 1 },
            },
            take: 100, // Process in batches
        });

        let releasedCount = 0;
        let releasedAmount = 0;

        for (const order of ordersToRelease) {
            // Check if already released
            const existingRelease = await prisma.walletTransaction.findFirst({
                where: {
                    referenceId: order.id,
                    referenceType: 'order',
                    type: 'ADJUSTMENT',
                    description: { contains: 'Giải phóng' },
                },
            });
            if (existingRelease) continue;

            // Use stored feeAmount from order if available, otherwise calculate from settings
            const feeAmount = order.feeAmount || Math.floor(order.totalAmount * getPlatformSettings().commissionRate / 100);
            const sellerEarning = order.totalAmount - feeAmount;

            const sellerWallet = await prisma.wallet.findUnique({
                where: { userId: order.shop.ownerId },
            });

            if (sellerWallet && sellerWallet.heldBalance >= sellerEarning) {
                await prisma.$transaction(async (tx) => {
                    // Move from heldBalance to availableBalance
                    await tx.wallet.update({
                        where: { userId: order.shop.ownerId },
                        data: {
                            heldBalance: { decrement: sellerEarning },
                            availableBalance: { increment: sellerEarning },
                        },
                    });

                    // Record release transaction
                    await tx.walletTransaction.create({
                        data: {
                            walletId: sellerWallet.id,
                            type: 'ADJUSTMENT',
                            direction: 'CREDIT',
                            amount: sellerEarning,
                            balanceAfter: sellerWallet.availableBalance + sellerEarning,
                            referenceType: 'order',
                            referenceId: order.id,
                            description: `Giải phóng tiền đơn ${order.orderCode} — ${sellerEarning.toLocaleString()}đ (sau ${HOLD_DAYS} ngày)`,
                        },
                    });
                });

                releasedCount++;
                releasedAmount += sellerEarning;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Đã giải phóng ${releasedCount} đơn, tổng: ${releasedAmount.toLocaleString()}đ`,
            data: { releasedCount, releasedAmount },
        });
    } catch (error) {
        console.error('Release funds error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
