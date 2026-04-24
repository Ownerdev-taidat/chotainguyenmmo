export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/v1/seller/inventory/items?productId=xxx
 * Returns AVAILABLE stock items for a specific product (seller must own it)
 */
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        if (!productId) {
            return NextResponse.json({ success: false, message: 'productId required' }, { status: 400 });
        }

        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) {
            return NextResponse.json({ success: false, message: 'No shop found' }, { status: 403 });
        }

        // Verify this product belongs to the seller
        const product = await prisma.product.findFirst({
            where: { id: productId, shopId: shop.id },
        });
        if (!product) {
            return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
        }

        // Fetch AVAILABLE stock items
        const items = await prisma.stockItem.findMany({
            where: { productId, status: 'AVAILABLE' },
            select: { id: true, rawContent: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            data: items,
            total: items.length,
        });
    } catch (error) {
        console.error('[Seller Inventory Items] GET error:', error);
        return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
    }
}
