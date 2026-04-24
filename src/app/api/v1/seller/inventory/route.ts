import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createHash } from 'crypto';

/**
 * Seller Inventory API
 * GET  — List products with stock counts
 * POST — Upload stock items (paste text or file content)
 */

// Hash content for duplicate detection (normalized: trim + lowercase)
function hashContent(content: string): string {
    const normalized = content.trim().toLowerCase();
    return createHash('sha256').update(normalized).digest('hex');
}

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) {
            return NextResponse.json({ success: true, data: { products: [], stats: { total: 0, available: 0, used: 0, low: 0 } } });
        }

        const products = await prisma.product.findMany({
            where: { shopId: shop.id, status: { not: 'ARCHIVED' } },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        stockItems: true,
                    },
                },
                stockItems: {
                    select: { status: true },
                },
                stockBatches: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { createdAt: true },
                },
            },
        });

        const inventory = products.map(p => {
            const total = p.stockItems.length;
            const available = p.stockItems.filter(s => s.status === 'AVAILABLE').length;
            const sold = p.stockItems.filter(s => s.status === 'SOLD').length;
            const reserved = p.stockItems.filter(s => s.status === 'RESERVED').length;
            return {
                id: p.id,
                product: p.name,
                total,
                available,
                used: sold + reserved,
                lastUpload: p.stockBatches[0]?.createdAt?.toISOString() || '',
            };
        });

        const stats = {
            total: inventory.reduce((s, i) => s + i.total, 0),
            available: inventory.reduce((s, i) => s + i.available, 0),
            used: inventory.reduce((s, i) => s + i.used, 0),
            low: inventory.filter(i => i.available > 0 && i.available <= 5).length,
        };

        return NextResponse.json({ success: true, data: { products: inventory, stats } });
    } catch (error) {
        console.error('[Seller Inventory] GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const body = await request.json();
        const { productId, variantId, items, sourceType, fileName } = body;

        if (!productId || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, message: 'Cần productId và danh sách items' }, { status: 400 });
        }

        // Verify ownership
        const product = await prisma.product.findFirst({
            where: { id: productId, shopId: shop.id },
            include: { variants: { select: { id: true } } },
        });
        if (!product) return NextResponse.json({ success: false, message: 'Không tìm thấy sản phẩm' }, { status: 404 });

        // Validate variantId if provided
        if (variantId && !product.variants.some(v => v.id === variantId)) {
            return NextResponse.json({ success: false, message: 'Variant không tồn tại' }, { status: 400 });
        }

        // ── DUPLICATE CHECK ──
        const validLines = items.filter((line: string) => line.trim());
        const lineHashes = validLines.map((line: string) => ({
            content: line.trim(),
            hash: hashContent(line),
        }));

        // 1. Remove duplicates within the uploaded batch itself
        const seen = new Set<string>();
        const uniqueLines: { content: string; hash: string }[] = [];
        const selfDuplicates: string[] = [];
        for (const item of lineHashes) {
            if (seen.has(item.hash)) {
                selfDuplicates.push(item.content);
            } else {
                seen.add(item.hash);
                uniqueLines.push(item);
            }
        }

        // 2. Check against existing stock in DB (ALL status: AVAILABLE, SOLD, RESERVED)
        // This catches resold items across all products and all sellers
        const hashesToCheck = uniqueLines.map(l => l.hash);
        let existingHashes = new Set<string>();

        if (hashesToCheck.length > 0) {
            // Batch query in chunks of 500 to avoid query size limits
            for (let i = 0; i < hashesToCheck.length; i += 500) {
                const chunk = hashesToCheck.slice(i, i + 500);
                const existing = await prisma.stockItem.findMany({
                    where: { contentHash: { in: chunk } },
                    select: { contentHash: true },
                });
                existing.forEach(e => {
                    if (e.contentHash) existingHashes.add(e.contentHash);
                });
            }
        }

        const dbDuplicates: string[] = [];
        const cleanLines: { content: string; hash: string }[] = [];
        for (const item of uniqueLines) {
            if (existingHashes.has(item.hash)) {
                dbDuplicates.push(item.content);
            } else {
                cleanLines.push(item);
            }
        }

        const totalDuplicates = selfDuplicates.length + dbDuplicates.length;

        // If ALL items are duplicates
        if (cleanLines.length === 0) {
            return NextResponse.json({
                success: false,
                message: `Tất cả ${validLines.length} mục đều trùng lặp! (${dbDuplicates.length} đã tồn tại trong hệ thống, ${selfDuplicates.length} trùng trong file)`,
                data: { duplicateCount: totalDuplicates, addedCount: 0 },
            }, { status: 400 });
        }

        // Create batch
        const batch = await prisma.stockBatch.create({
            data: {
                productId,
                sourceType: sourceType || 'paste',
                fileName: fileName || null,
                totalLines: items.length,
                validLines: cleanLines.length,
                invalidLines: items.length - cleanLines.length,
                uploadedBy: authResult.userId,
                notes: totalDuplicates > 0 ? `Auto-removed ${totalDuplicates} duplicates` : null,
            },
        });

        // Create stock items with contentHash
        await prisma.stockItem.createMany({
            data: cleanLines.map(item => ({
                productId,
                variantId: variantId || null,
                rawContent: item.content,
                contentHash: item.hash,
                status: 'AVAILABLE' as const,
                batchId: batch.id,
                uploadedBy: authResult.userId,
            })),
        });

        // Update product stock cache
        const availableCount = await prisma.stockItem.count({
            where: { productId, status: 'AVAILABLE' },
        });
        await prisma.product.update({
            where: { id: productId },
            data: { stockCountCached: availableCount, lastStockUpdateAt: new Date() },
        });

        // Build result message
        let message = `Đã thêm ${cleanLines.length} mục tồn kho cho "${product.name}"`;
        if (totalDuplicates > 0) {
            message += ` (đã loại ${totalDuplicates} mục trùng lặp`;
            if (dbDuplicates.length > 0) message += `: ${dbDuplicates.length} đã bán/tồn tại`;
            if (selfDuplicates.length > 0) message += `${dbDuplicates.length > 0 ? ', ' : ': '}${selfDuplicates.length} trùng trong file`;
            message += ')';
        }

        return NextResponse.json({
            success: true,
            message,
            data: {
                batchId: batch.id,
                added: cleanLines.length,
                duplicateCount: totalDuplicates,
                dbDuplicates: dbDuplicates.length,
                selfDuplicates: selfDuplicates.length,
            },
        });
    } catch (error) {
        console.error('[Seller Inventory] POST error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi upload tồn kho' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');
        if (!productId) return NextResponse.json({ success: false, message: 'Thiếu productId' }, { status: 400 });

        const product = await prisma.product.findFirst({ where: { id: productId, shopId: shop.id } });
        if (!product) return NextResponse.json({ success: false, message: 'Không tìm thấy' }, { status: 404 });

        // Delete available stock items
        await prisma.stockItem.deleteMany({
            where: { productId, status: 'AVAILABLE' },
        });

        // Update cache
        await prisma.product.update({
            where: { id: productId },
            data: { stockCountCached: 0, lastStockUpdateAt: new Date() },
        });

        return NextResponse.json({ success: true, message: 'Đã xóa tồn kho khả dụng' });
    } catch (error) {
        console.error('[Seller Inventory] DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi xóa' }, { status: 500 });
    }
}
