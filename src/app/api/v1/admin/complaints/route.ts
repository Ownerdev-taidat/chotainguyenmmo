export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/v1/admin/complaints — List all complaint-related orders for admin (read-only)
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes((authResult as any).role || '')) {
        return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
    }

    try {
        // Query 1: Currently DISPUTED orders
        const disputed = await prisma.order.findMany({
            where: { status: 'DISPUTED' },
            orderBy: { updatedAt: 'desc' },
            include: {
                buyer: { select: { fullName: true, username: true } },
                shop: { select: { name: true, ownerId: true } },
                items: { include: { product: { select: { name: true } } }, take: 1 },
            },
        });

        // Query 2: Previously disputed orders (resolved/refunded) — check notes is not null
        const resolved = await prisma.order.findMany({
            where: {
                status: { in: ['COMPLETED', 'REFUNDED'] },
                notes: { not: null },
            },
            orderBy: { updatedAt: 'desc' },
            include: {
                buyer: { select: { fullName: true, username: true } },
                shop: { select: { name: true, ownerId: true } },
                items: { include: { product: { select: { name: true } } }, take: 1 },
            },
        });

        // Filter resolved to only include complaint-related (notes mention khiếu nại or Khiếu nại or Đã giải quyết)
        const complaintResolved = resolved.filter(o =>
            o.notes && (o.notes.includes('hiếu nại') || o.notes.includes('Đã giải quyết') || o.notes.includes('từ chối'))
        );

        const allOrders = [...disputed, ...complaintResolved];

        const data = allOrders.map(o => {
            let displayStatus = 'open';
            if (o.status === 'COMPLETED') {
                displayStatus = 'resolved';
            } else if (o.status === 'REFUNDED') {
                displayStatus = 'refunded';
            }

            return {
                id: o.id,
                orderCode: o.orderCode,
                buyer: o.buyer.fullName || o.buyer.username,
                seller: o.shop.name,
                sellerOwnerId: o.shop.ownerId,
                product: o.items[0]?.product?.name || 'N/A',
                reason: o.notes?.replace('Khiếu nại: ', '') || 'Không rõ',
                totalAmount: o.totalAmount,
                status: displayStatus,
                createdAt: o.createdAt.toISOString(),
                updatedAt: o.updatedAt.toISOString(),
            };
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Admin complaints error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

