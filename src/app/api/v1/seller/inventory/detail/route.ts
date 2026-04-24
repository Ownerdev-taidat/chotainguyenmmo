export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Seller Inventory Detail API — Google Sheet-like view
 * GET ?productId=xxx&variantId=yyy&status=AVAILABLE&page=1&limit=50&search=xxx
 * Returns paginated stock items for the spreadsheet grid
 */
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        const variantId = searchParams.get('variantId');
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

        if (!productId) {
            return NextResponse.json({ success: false, message: 'Thiếu productId' }, { status: 400 });
        }

        // Verify ownership
        const product = await prisma.product.findFirst({
            where: { id: productId, shopId: shop.id },
            include: {
                variants: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, price: true } },
            },
        });
        if (!product) return NextResponse.json({ success: false, message: 'Không tìm thấy sản phẩm' }, { status: 404 });

        // Build where clause
        const where: any = { productId };
        if (variantId) where.variantId = variantId;
        if (status && status !== 'ALL') where.status = status;
        if (search) where.rawContent = { contains: search, mode: 'insensitive' };

        const [total, items] = await Promise.all([
            prisma.stockItem.count({ where }),
            prisma.stockItem.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    variant: { select: { name: true } },
                },
            }),
        ]);

        // Stats for this product
        const [totalCount, availableCount, soldCount, reservedCount] = await Promise.all([
            prisma.stockItem.count({ where: { productId } }),
            prisma.stockItem.count({ where: { productId, status: 'AVAILABLE' } }),
            prisma.stockItem.count({ where: { productId, status: 'SOLD' } }),
            prisma.stockItem.count({ where: { productId, status: 'RESERVED' } }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                product: { id: product.id, name: product.name, variants: product.variants },
                items: items.map((item, idx) => ({
                    id: item.id,
                    rowNumber: (page - 1) * limit + idx + 1,
                    rawContent: item.rawContent,
                    status: item.status,
                    variantId: item.variantId,
                    variantName: item.variant?.name || null,
                    createdAt: item.createdAt.toISOString(),
                    soldAt: item.soldAt?.toISOString() || null,
                })),
                stats: { total: totalCount, available: availableCount, sold: soldCount, reserved: reservedCount },
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            },
        });
    } catch (error) {
        console.error('[Seller Inventory Detail] GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

/**
 * DELETE — Delete specific stock items by IDs
 */
export async function DELETE(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const body = await request.json();
        const { itemIds, productId } = body;

        if (!productId || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return NextResponse.json({ success: false, message: 'Thiếu thông tin' }, { status: 400 });
        }

        // Verify ownership
        const product = await prisma.product.findFirst({ where: { id: productId, shopId: shop.id } });
        if (!product) return NextResponse.json({ success: false, message: 'Không tìm thấy sản phẩm' }, { status: 404 });

        // Only delete AVAILABLE items
        const deleted = await prisma.stockItem.deleteMany({
            where: { id: { in: itemIds }, productId, status: 'AVAILABLE' },
        });

        // Update cache
        const availableCount = await prisma.stockItem.count({
            where: { productId, status: 'AVAILABLE' },
        });
        await prisma.product.update({
            where: { id: productId },
            data: { stockCountCached: availableCount, lastStockUpdateAt: new Date() },
        });

        return NextResponse.json({
            success: true,
            message: `Đã xóa ${deleted.count} mục`,
            data: { deletedCount: deleted.count },
        });
    } catch (error) {
        console.error('[Seller Inventory Detail] DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi xóa' }, { status: 500 });
    }
}
