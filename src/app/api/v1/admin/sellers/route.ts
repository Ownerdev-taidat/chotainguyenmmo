export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/v1/admin/sellers — List all shops with real stats from DB
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes((authResult as any).role || '')) {
        return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
    }

    try {
        const shops = await prisma.shop.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                owner: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        fullName: true,
                        phone: true,
                        wallet: {
                            select: {
                                availableBalance: true,
                                heldBalance: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        products: true,
                        orders: true,
                    },
                },
            },
        });

        // For each shop, get revenue and complaint stats
        const sellersWithStats = await Promise.all(
            shops.map(async (shop) => {
                // Total revenue from completed orders
                let totalRevenue = 0;
                try {
                    const revenueAgg = await prisma.order.aggregate({
                        where: { shopId: shop.id, status: { in: ['COMPLETED', 'PAID', 'PROCESSING'] } },
                        _sum: { totalAmount: true },
                    });
                    totalRevenue = revenueAgg._sum?.totalAmount || 0;
                } catch {}

                // Complaint count
                let complaintCount = 0;
                try {
                    complaintCount = await prisma.complaint.count({
                        where: { shopId: shop.id },
                    });
                } catch {}

                // Successful orders count
                let successfulOrders = 0;
                try {
                    successfulOrders = await prisma.order.count({
                        where: { shopId: shop.id, status: 'COMPLETED' },
                    });
                } catch {}

                return {
                    id: shop.id,
                    name: shop.name,
                    slug: shop.slug,
                    logoUrl: shop.logoUrl,
                    status: shop.status,
                    verified: shop.verified,
                    joinedAt: shop.joinedAt,
                    createdAt: shop.createdAt,
                    ratingAverage: shop.ratingAverage || 0,
                    ratingCount: shop.ratingCount || 0,
                    owner: shop.owner,
                    productCount: shop._count.products,
                    totalOrders: shop._count.orders,
                    successfulOrders,
                    totalRevenue,
                    complaintCount,
                    walletBalance: shop.owner.wallet?.availableBalance || 0,
                    walletHeld: shop.owner.wallet?.heldBalance || 0,
                };
            })
        );

        return NextResponse.json({ success: true, data: sellersWithStats });
    } catch (error) {
        console.error('Admin sellers list error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
