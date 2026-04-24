export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import prisma from '@/lib/prisma';

/**
 * Public API — Orders & Balance
 * Auth: API Key via x-api-key header
 */
export async function GET(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key') || new URL(req.url).searchParams.get('api_key');
    if (!apiKey) {
        return NextResponse.json({ success: false, message: 'API Key required' }, { status: 401 });
    }

    const keyData = await validateApiKey(apiKey);
    if (!keyData) {
        return NextResponse.json({ success: false, message: 'Invalid or revoked API Key' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    try {
        // Balance check
        if (type === 'balance') {
            if (!keyData.permissions.includes('balance:read')) {
                return NextResponse.json({ success: false, message: 'Permission denied: balance:read' }, { status: 403 });
            }
            const wallet = await prisma.wallet.findUnique({ where: { userId: keyData.userId } });
            return NextResponse.json({
                success: true,
                data: {
                    balance: wallet?.availableBalance || 0,
                    currency: 'VND',
                },
            });
        }

        // Orders
        if (!keyData.permissions.includes('orders:read')) {
            return NextResponse.json({ success: false, message: 'Permission denied: orders:read' }, { status: 403 });
        }

        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

        const [total, orders] = await Promise.all([
            prisma.order.count({ where: { buyerId: keyData.userId } }),
            prisma.order.findMany({
                where: { buyerId: keyData.userId },
                include: {
                    items: {
                        include: { product: { select: { name: true } } },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: orders.map(o => ({
                orderId: o.id,
                orderCode: o.orderCode,
                products: o.items.map(item => ({
                    name: item.product.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total,
                })),
                totalAmount: o.totalAmount,
                status: o.status,
                createdAt: o.createdAt.toISOString(),
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('[Public Orders] Error:', error);
        return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
    }
}
