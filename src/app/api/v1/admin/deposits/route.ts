export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Admin Deposits API
 * GET — List all deposits (with filters)
 * PUT — Approve or reject a deposit
 */

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(authResult.role)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    try {
        const where: any = {};
        if (status && status !== 'all') {
            where.status = status.toUpperCase();
        }

        const deposits = await prisma.deposit.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: { id: true, username: true, fullName: true, role: true },
                },
            },
        });

        // Stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [totalToday, pending, completed, failed] = await Promise.all([
            prisma.deposit.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: today } }, _sum: { amount: true } }),
            prisma.deposit.count({ where: { status: 'PENDING' } }),
            prisma.deposit.count({ where: { status: 'COMPLETED' } }),
            prisma.deposit.count({ where: { status: { in: ['FAILED', 'EXPIRED', 'CANCELLED'] } } }),
        ]);

        const data = deposits.map(d => ({
            id: d.id,
            transactionCode: d.referenceCode || d.transferContent || d.id.slice(0, 12),
            user: d.user.fullName || d.user.username,
            userId: d.user.id,
            userRole: d.user.role,
            amount: d.amount,
            method: d.method || 'MBBank',
            status: d.status.toLowerCase(),
            createdAt: d.createdAt.toISOString(),
            completedAt: d.completedAt?.toISOString() || null,
        }));

        return NextResponse.json({
            success: true,
            data,
            stats: {
                totalToday: totalToday._sum?.amount || 0,
                pending,
                completed,
                failed,
            },
        });
    } catch (error: any) {
        console.error('[Admin Deposits] GET error:', error);
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
        const { id, action } = await request.json();
        if (!id || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
        }

        const deposit = await prisma.deposit.findUnique({ where: { id } });
        if (!deposit) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy lệnh nạp' }, { status: 404 });
        }
        if (deposit.status !== 'PENDING') {
            return NextResponse.json({ success: false, message: 'Lệnh nạp đã được xử lý' }, { status: 400 });
        }

        if (action === 'approve') {
            await prisma.$transaction(async (tx) => {
                await tx.deposit.update({
                    where: { id },
                    data: { status: 'COMPLETED', completedAt: new Date() },
                });

                const wallet = await tx.wallet.findUnique({ where: { userId: deposit.userId } });
                if (wallet) {
                    const updated = await tx.wallet.update({
                        where: { userId: deposit.userId },
                        data: { availableBalance: { increment: deposit.amount } },
                    });

                    await tx.walletTransaction.create({
                        data: {
                            walletId: wallet.id,
                            type: 'DEPOSIT',
                            direction: 'CREDIT',
                            amount: deposit.amount,
                            balanceAfter: updated.availableBalance,
                            description: `Nạp tiền ${deposit.amount.toLocaleString()}đ — Admin duyệt`,
                            referenceType: 'deposit',
                            referenceId: deposit.id,
                        },
                    });
                }
            });

            return NextResponse.json({ success: true, message: 'Đã duyệt nạp tiền thành công' });
        }

        if (action === 'reject') {
            await prisma.deposit.update({
                where: { id },
                data: { status: 'FAILED', completedAt: new Date() },
            });

            return NextResponse.json({ success: true, message: 'Đã từ chối lệnh nạp tiền' });
        }
    } catch (error: any) {
        console.error('[Admin Deposits] PUT error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
