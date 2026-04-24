export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Seller Orders API
 * GET — List orders for seller's shop
 */

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) {
            return NextResponse.json({ success: true, data: { orders: [], stats: { pending: 0, delivering: 0, completed: 0, total: 0 } } });
        }

        const orders = await prisma.order.findMany({
            where: { shopId: shop.id },
            orderBy: { createdAt: 'desc' },
            include: {
                items: { include: { product: { select: { name: true } } } },
                buyer: { select: { fullName: true, username: true } },
            },
        });

        const mapped = orders.map(o => ({
            id: o.id,
            orderCode: o.orderCode,
            productName: o.items[0]?.product?.name || 'N/A',
            buyerName: o.buyer.fullName || o.buyer.username,
            quantity: o.items.reduce((s, i) => s + i.quantity, 0),
            totalAmount: o.totalAmount,
            status: o.status.toLowerCase(),
            paymentStatus: o.paymentStatus.toLowerCase(),
            deliveryStatus: o.deliveryStatus.toLowerCase(),
            createdAt: o.createdAt.toISOString(),
        }));

        const stats = {
            pending: orders.filter(o => ['PENDING', 'PAID', 'PROCESSING'].includes(o.status)).length,
            delivering: orders.filter(o => ['DELIVERING', 'DELIVERED'].includes(o.status)).length,
            completed: orders.filter(o => o.status === 'COMPLETED').length,
            total: orders.length,
        };

        return NextResponse.json({ success: true, data: { orders: mapped, stats } });
    } catch (error) {
        console.error('[Seller Orders] Error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
