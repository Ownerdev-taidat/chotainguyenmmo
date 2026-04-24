export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Read tax settings from Prisma Setting model
async function getTaxState(): Promise<{ taxEnabled: boolean; vatRate: number }> {
    try {
        const record = await prisma.setting.findUnique({ where: { key: 'tax_settings' } });
        if (record) {
            const data = JSON.parse(record.value);
            return { taxEnabled: !!data.enabled, vatRate: data.taxRate ?? 10 };
        }
    } catch {}
    return { taxEnabled: false, vatRate: 10 };
}

/**
 * GET /api/v1/seller/invoices — List invoices for seller's shop orders
 * Tax is only applied when admin enables it in platform settings
 */
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findFirst({
            where: { ownerId: authResult.userId },
        });

        if (!shop) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Read tax setting from Prisma DB
        const { taxEnabled, vatRate } = await getTaxState();

        // Get all orders for this shop
        const orders = await prisma.order.findMany({
            where: { shopId: shop.id },
            orderBy: { createdAt: 'desc' },
            include: {
                buyer: { select: { username: true, fullName: true } },
                items: { select: { product: { select: { name: true } }, quantity: true, unitPrice: true } },
            },
        });

        const invoices = orders.map(order => {
            const totalAmount = order.totalAmount;
            const feeAmount = order.feeAmount || 0;

            let subtotal: number;
            let vatAmount: number;

            if (taxEnabled && vatRate > 0) {
                subtotal = Math.round(totalAmount / (1 + vatRate / 100));
                vatAmount = totalAmount - subtotal;
            } else {
                subtotal = totalAmount;
                vatAmount = 0;
            }

            const dateStr = new Date(order.createdAt).toISOString().slice(2, 10).replace(/-/g, '');
            const shortId = order.id.slice(-4).toUpperCase();

            return {
                id: order.id,
                invoiceNumber: `HD-${dateStr}-${shortId}`,
                orderCode: order.orderCode,
                buyerName: order.buyer?.fullName || order.buyer?.username || 'Khách hàng',
                sellerName: shop.name,
                subtotal,
                vatRate,
                vatAmount,
                feeAmount,
                totalAmount,
                taxEnabled,
                items: order.items.map(i => `${i.product.name} x${i.quantity}`).join(', '),
                status: order.status,
                issuedAt: order.createdAt.toISOString(),
            };
        });

        return NextResponse.json({ success: true, data: invoices });
    } catch (error) {
        console.error('Seller invoices error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
