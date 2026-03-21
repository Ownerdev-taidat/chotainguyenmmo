import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getPlatformSettings } from '@/lib/mock-order-store';

function generateInvoiceNumber(): string {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    return `HD-${yy}${mm}${dd}-${rand}`;
}

// POST /api/v1/invoices — Generate invoice for an order
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { orderId } = await request.json();
        if (!orderId) {
            return NextResponse.json({ success: false, message: 'Thiếu orderId' }, { status: 400 });
        }

        // Check if invoice already exists
        const existing = await prisma.invoice.findFirst({ where: { orderId } });
        if (existing) {
            return NextResponse.json({ success: true, data: existing });
        }

        // Get order details
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                buyer: { select: { fullName: true, username: true, email: true } },
                shop: { select: { name: true } },
                items: { include: { product: { select: { name: true } } } },
            },
        });

        if (!order) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy đơn hàng' }, { status: 404 });
        }

        // Only the buyer or admin can generate invoice
        if (order.buyerId !== authResult.userId &&
            !['ADMIN', 'SUPER_ADMIN'].includes((authResult as any).role || '')) {
            return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
        }

        // Read tax setting from admin
        const settings = getPlatformSettings();
        const taxEnabled = settings.taxEnabled ?? false;
        const vatRate = taxEnabled ? (settings.vatRate ?? 10) : 0;

        let subtotal: number;
        let vatAmount: number;
        if (taxEnabled && vatRate > 0) {
            subtotal = Math.round(order.totalAmount / (1 + vatRate / 100));
            vatAmount = order.totalAmount - subtotal;
        } else {
            subtotal = order.totalAmount;
            vatAmount = 0;
        }

        const items = order.items.map(item => ({
            name: item.product?.name || 'Sản phẩm',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
        }));

        const invoice = await prisma.invoice.create({
            data: {
                invoiceNumber: generateInvoiceNumber(),
                orderId: order.id,
                orderCode: order.orderCode,
                buyerId: order.buyerId,
                buyerName: order.buyer.fullName || order.buyer.username,
                buyerEmail: order.buyer.email,
                sellerName: order.shop.name,
                subtotal,
                vatRate,
                vatAmount,
                feeAmount: order.feeAmount,
                totalAmount: order.totalAmount,
                items: JSON.stringify(items),
            },
        });

        return NextResponse.json({ success: true, data: invoice });
    } catch (error) {
        console.error('Invoice error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// GET /api/v1/invoices — List invoices (admin sees all, user sees own)
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const backfill = searchParams.get('backfill');

    try {
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((authResult as any).role || '');

        // ── Backfill: create invoices for old orders that don't have one ──
        if (backfill === 'true' && isAdmin) {
            const ordersWithoutInvoice = await prisma.order.findMany({
                where: {
                    status: { in: ['COMPLETED', 'PROCESSING', 'DELIVERED'] },
                    invoices: { none: {} },
                },
                include: {
                    buyer: { select: { fullName: true, username: true, email: true } },
                    shop: { select: { name: true } },
                    items: { include: { product: { select: { name: true } } } },
                },
                take: 500,
            });

            let created = 0;
            for (const order of ordersWithoutInvoice) {
                try {
                    const settings = getPlatformSettings();
                    const taxEnabled = settings.taxEnabled ?? false;
                    const vatRate = taxEnabled ? (settings.vatRate ?? 10) : 0;
                    const subtotal = vatRate > 0 ? Math.round(order.totalAmount / (1 + vatRate / 100)) : order.totalAmount;
                    const vatAmount = order.totalAmount - subtotal;
                    const items = order.items.map(item => ({
                        name: item.product?.name || 'Sản phẩm',
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.total,
                    }));

                    const d = order.createdAt;
                    const invoiceNumber = `HD-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

                    await prisma.invoice.create({
                        data: {
                            invoiceNumber,
                            orderId: order.id,
                            orderCode: order.orderCode,
                            buyerId: order.buyerId,
                            buyerName: order.buyer.fullName || order.buyer.username,
                            buyerEmail: order.buyer.email,
                            sellerName: order.shop.name,
                            subtotal,
                            vatRate,
                            vatAmount,
                            feeAmount: order.feeAmount,
                            totalAmount: order.totalAmount,
                            items: JSON.stringify(items),
                            issuedAt: order.createdAt,
                        },
                    });
                    created++;
                } catch (err) {
                    console.error(`Backfill invoice for order ${order.orderCode} failed:`, err);
                }
            }
            console.log(`[Invoice Backfill] Created ${created} invoices for ${ordersWithoutInvoice.length} orders`);
        }

        let where: any = {};
        if (orderId) {
            where.orderId = orderId;
        } else if (!isAdmin) {
            where.buyerId = authResult.userId;
        }

        const invoices = await prisma.invoice.findMany({
            where,
            orderBy: { issuedAt: 'desc' },
            take: 500,
        });

        // Read current tax state to pass to frontend
        let taxEnabled = false;
        try {
            const taxSetting = await prisma.setting.findUnique({ where: { key: 'tax_settings' } });
            if (taxSetting) taxEnabled = !!JSON.parse(taxSetting.value).enabled;
        } catch {}

        const data = invoices.map(inv => ({ ...inv, taxEnabled }));
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Invoice list error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
