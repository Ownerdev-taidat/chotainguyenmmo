export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Admin Withdrawals API
 * GET  — List all withdrawal requests (with filters)
 * PUT  — Approve or reject a withdrawal
 */

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(authResult.role)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // PENDING, COMPLETED, REJECTED

    try {
        const where: any = {};
        if (status && status !== 'all') {
            where.status = status.toUpperCase();
        }

        const withdrawals = await prisma.withdrawal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: { id: true, username: true, fullName: true, email: true, role: true },
                },
            },
        });

        const data = withdrawals.map(w => ({
            id: w.id,
            user: w.user.fullName || w.user.username,
            userId: w.user.id,
            userRole: w.user.role,
            type: ['SELLER', 'ADMIN', 'SUPER_ADMIN'].includes(w.user.role) ? 'seller' : 'buyer',
            amount: w.amount,
            feeAmount: w.feeAmount,
            netAmount: w.netAmount,
            method: `${w.bankName || ''} ****${(w.accountNumber || '').slice(-4)}`,
            bankName: w.bankName,
            accountNumber: w.accountNumber,
            accountName: w.accountName,
            status: w.status.toLowerCase(),
            note: w.rejectedReason || '',
            createdAt: w.createdAt.toISOString(),
            completedAt: w.completedAt?.toISOString() || null,
        }));

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('[Admin Withdrawals] GET error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(authResult.role)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { id, action, reason } = await request.json();
        if (!id || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
        }

        const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
        if (!withdrawal) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy yêu cầu rút tiền' }, { status: 404 });
        }
        if (withdrawal.status !== 'PENDING') {
            return NextResponse.json({ success: false, message: 'Yêu cầu đã được xử lý' }, { status: 400 });
        }

        if (action === 'approve') {
            await prisma.withdrawal.update({
                where: { id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    approvedBy: authResult.userId,
                    approvedAt: new Date(),
                },
            });

            return NextResponse.json({ success: true, message: 'Đã duyệt yêu cầu rút tiền' });
        }

        if (action === 'reject') {
            // Reject: refund money back to wallet
            await prisma.$transaction(async (tx) => {
                // Update withdrawal status
                await tx.withdrawal.update({
                    where: { id },
                    data: {
                        status: 'REJECTED',
                        completedAt: new Date(),
                        rejectedReason: reason || 'Admin từ chối',
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
                            description: `Hoàn tiền rút tiền bị từ chối — ${reason || 'Admin từ chối'}`,
                            referenceType: 'withdrawal',
                            referenceId: withdrawal.id,
                        },
                    });
                }
            });

            return NextResponse.json({ success: true, message: 'Đã từ chối và hoàn tiền về ví' });
        }
    } catch (error: any) {
        console.error('[Admin Withdrawals] PUT error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
