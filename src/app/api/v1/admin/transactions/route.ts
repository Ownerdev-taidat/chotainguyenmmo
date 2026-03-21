import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/v1/admin/transactions — List all wallet transactions with period filter
 * Query params: period (today|month|3months|6months|year|YYYY-MM), page, limit, type
 */
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes((authResult as any).role || '')) {
        return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50'));
    const typeFilter = searchParams.get('type') || '';
    const search = searchParams.get('search') || '';

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // ── Period calculation ──
    let periodStart: Date;
    let periodEnd: Date | undefined;
    let periodLabel = '';

    if (period === 'today') {
        periodStart = startOfDay;
        periodLabel = 'Hôm nay';
    } else if (period === '3months') {
        periodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        periodLabel = '3 tháng gần nhất';
    } else if (period === '6months') {
        periodStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        periodLabel = '6 tháng gần nhất';
    } else if (period === 'year') {
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodLabel = `Năm ${now.getFullYear()}`;
    } else if (/^\d{4}-\d{2}$/.test(period)) {
        const [y, m] = period.split('-').map(Number);
        periodStart = new Date(y, m - 1, 1);
        periodEnd = new Date(y, m, 1);
        periodLabel = `Tháng ${m}/${y}`;
    } else {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
    }

    try {
        const dateWhere = periodEnd
            ? { gte: periodStart, lt: periodEnd }
            : { gte: periodStart };

        const where: any = { createdAt: dateWhere };
        if (typeFilter) where.type = typeFilter;

        // Get transactions
        const [transactions, total] = await Promise.all([
            prisma.walletTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    wallet: {
                        include: {
                            user: { select: { username: true, fullName: true, email: true } },
                        },
                    },
                },
            }),
            prisma.walletTransaction.count({ where }),
        ]);

        // Summary stats for the period
        const allPeriodTx = await prisma.walletTransaction.findMany({
            where: { createdAt: dateWhere },
            select: { type: true, direction: true, amount: true },
        });

        const totalDeposits = allPeriodTx
            .filter(t => t.type === 'DEPOSIT' && t.direction === 'CREDIT')
            .reduce((s, t) => s + t.amount, 0);
        const totalPurchases = allPeriodTx
            .filter(t => t.type === 'PURCHASE')
            .reduce((s, t) => s + t.amount, 0);
        const totalRefunds = allPeriodTx
            .filter(t => t.type === 'REFUND')
            .reduce((s, t) => s + t.amount, 0);
        const totalWithdrawals = allPeriodTx
            .filter(t => t.type === 'WITHDRAWAL')
            .reduce((s, t) => s + t.amount, 0);
        const totalFees = allPeriodTx
            .filter(t => t.type === 'FEE')
            .reduce((s, t) => s + t.amount, 0);
        const totalSales = allPeriodTx
            .filter(t => t.type === 'SALE_EARNING')
            .reduce((s, t) => s + t.amount, 0);

        // Today stats
        const todayTx = await prisma.walletTransaction.count({
            where: { createdAt: { gte: startOfDay } },
        });

        return NextResponse.json({
            success: true,
            data: {
                transactions: transactions.map(t => ({
                    id: t.id,
                    type: t.type,
                    direction: t.direction,
                    amount: t.amount,
                    balanceAfter: t.balanceAfter,
                    description: t.description,
                    note: t.note,
                    username: t.wallet.user.fullName || t.wallet.user.username,
                    email: t.wallet.user.email,
                    createdAt: t.createdAt.toISOString(),
                })),
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
                stats: {
                    totalDeposits,
                    totalPurchases,
                    totalRefunds,
                    totalWithdrawals,
                    totalFees,
                    totalSales,
                    todayCount: todayTx,
                    periodCount: total,
                },
                periodLabel,
            },
        });
    } catch (error) {
        console.error('Admin transactions error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
