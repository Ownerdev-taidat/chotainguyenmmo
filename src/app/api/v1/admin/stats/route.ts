export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/v1/admin/stats — Real dashboard stats from DB
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes((authResult as any).role || '')) {
        return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
    }

    try {
        let totalUsers = 0, totalShops = 0, totalOrders = 0, pendingDeposits = 0;
        let totalDepositAmount = 0, pendingWithdrawals = 0, openComplaints = 0;
        let recentUsers: any[] = [], recentSellers: any[] = [], ordersToday = 0;
        let commissionRevenue = 0, sellerPaidOut = 0, totalOrderRevenue = 0;

        try { totalUsers = await prisma.user.count(); } catch {}
        try { totalShops = await prisma.shop.count({ where: { status: 'ACTIVE' } }); } catch {}
        try { totalOrders = await prisma.order.count(); } catch {}
        try { pendingDeposits = await prisma.deposit.count({ where: { status: 'PENDING' } }); } catch {}
        try {
            const sum = await prisma.deposit.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } });
            totalDepositAmount = sum._sum?.amount || 0;
        } catch {}
        try { pendingWithdrawals = await prisma.withdrawal.count({ where: { status: 'PENDING' } }); } catch {}
        try { openComplaints = await prisma.order.count({ where: { status: 'DISPUTED' } }); } catch {}

        // Total order revenue (sum of all orders' totalAmount)
        try {
            const orderSum = await prisma.order.aggregate({
                where: { status: { in: ['COMPLETED', 'PAID', 'PROCESSING'] } },
                _sum: { totalAmount: true },
            });
            totalOrderRevenue = orderSum._sum?.totalAmount || 0;
        } catch {}

        // Platform commission revenue (sum of FEE transactions credited to admin)
        try {
            const feeSum = await prisma.walletTransaction.aggregate({
                where: { type: 'FEE', direction: 'CREDIT' },
                _sum: { amount: true },
            });
            commissionRevenue = feeSum._sum?.amount || 0;
        } catch {}

        // Also try summing feeAmount from orders if FEE transactions are missing
        if (commissionRevenue === 0) {
            try {
                const feeFromOrders = await prisma.order.aggregate({
                    where: { status: { in: ['COMPLETED', 'PAID', 'PROCESSING'] } },
                    _sum: { feeAmount: true },
                });
                commissionRevenue = feeFromOrders._sum?.feeAmount || 0;
            } catch {}
        }

        // Total paid to sellers
        try {
            const sellerSum = await prisma.walletTransaction.aggregate({
                where: { type: 'SALE_EARNING', direction: 'CREDIT' },
                _sum: { amount: true },
            });
            sellerPaidOut = sellerSum._sum?.amount || 0;
        } catch {}

        // If no SALE_EARNING transactions, compute from orders
        if (sellerPaidOut === 0 && totalOrderRevenue > 0) {
            sellerPaidOut = totalOrderRevenue - commissionRevenue;
        }

        // Today's orders
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            ordersToday = await prisma.order.count({ where: { createdAt: { gte: today } } });
        } catch {}

        // Recent users
        try {
            const users = await prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, fullName: true, username: true, createdAt: true },
            });
            recentUsers = users.map((u: any) => ({
                name: u.fullName,
                username: u.username,
                date: u.createdAt.toLocaleDateString('vi-VN'),
            }));
        } catch {}

        // Recent pending shops
        try {
            const shops = await prisma.shop.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                where: { status: 'PENDING' },
                include: { owner: { select: { fullName: true, username: true } } },
            });
            recentSellers = shops.map((s: any) => ({
                name: s.name,
                owner: s.owner.fullName,
                date: s.createdAt.toLocaleDateString('vi-VN'),
            }));
        } catch {}

        return NextResponse.json({
            success: true,
            data: {
                totalUsers,
                totalShops,
                totalOrders,
                ordersToday,
                totalRevenue: totalDepositAmount,
                totalOrderRevenue,
                commissionRevenue,
                sellerPaidOut,
                pendingDeposits,
                pendingWithdrawals,
                openComplaints,
                recentUsers,
                recentSellers,
            },
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
