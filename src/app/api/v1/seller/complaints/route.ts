export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Seller Complaints API
 * GET — List complaint-related orders for seller's shop
 * Shows: DISPUTED + resolved complaints (COMPLETED with complaint notes)
 */

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) {
            return NextResponse.json({ success: true, data: { complaints: [], stats: { open: 0, review: 0, resolved: 0, rate: 0 } } });
        }

        const complaints = await prisma.order.findMany({
            where: {
                shopId: shop.id,
                OR: [
                    { status: 'DISPUTED' },
                    { status: 'COMPLETED', notes: { contains: 'khiếu nại' } },
                    { status: 'REFUNDED' },
                ],
            },
            orderBy: { updatedAt: 'desc' },
            include: {
                buyer: { select: { fullName: true, username: true } },
                items: { include: { product: { select: { name: true } } }, take: 1 },
            },
        });

        const mapped = complaints.map(o => {
            let displayStatus = 'open';
            if (o.status === 'COMPLETED' && o.notes?.includes('khiếu nại')) {
                displayStatus = 'resolved';
            } else if (o.status === 'REFUNDED') {
                displayStatus = 'refunded';
            }
            return {
                id: o.id,
                orderCode: o.orderCode,
                buyer: o.buyer.fullName || o.buyer.username,
                product: o.items[0]?.product?.name || 'N/A',
                reason: o.notes?.replace('Khiếu nại: ', '') || 'Không rõ',
                totalAmount: o.totalAmount,
                status: displayStatus,
                createdAt: o.createdAt.toISOString(),
            };
        });

        const openCount = mapped.filter(c => c.status === 'open').length;
        const resolvedCount = mapped.filter(c => c.status === 'resolved').length;

        const stats = {
            open: openCount,
            review: 0,
            resolved: resolvedCount,
            rate: mapped.length > 0 ? Math.round((resolvedCount / mapped.length) * 100) : 0,
        };

        return NextResponse.json({ success: true, data: { complaints: mapped, stats } });
    } catch (error) {
        console.error('[Seller Complaints] Error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
