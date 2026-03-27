import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createHash } from 'crypto';

function hashContent(content: string): string {
    const normalized = content.trim().toLowerCase();
    return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Seller Products API
 * GET  — List seller's own products
 * POST — Create product with variants
 */

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        // Find seller's shop
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) {
            return NextResponse.json({ success: true, data: { products: [], stats: { total: 0, active: 0, outOfStock: 0, draft: 0 } } });
        }

        const products = await prisma.product.findMany({
            where: { shopId: shop.id },
            orderBy: { createdAt: 'desc' },
            include: {
                category: { select: { id: true, name: true, slug: true } },
                variants: { orderBy: { sortOrder: 'asc' } },
                images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                _count: {
                    select: {
                        stockItems: { where: { status: 'AVAILABLE' } },
                        orderItems: true,
                    },
                },
            },
        });

        const stats = {
            total: products.length,
            active: products.filter(p => p.status === 'ACTIVE').length,
            outOfStock: products.filter(p => p.stockCountCached === 0 && p.status === 'ACTIVE').length,
            draft: products.filter(p => p.status === 'DRAFT').length,
        };

        return NextResponse.json({
            success: true,
            data: {
                products: products.map(p => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    shortDescription: p.shortDescription,
                    price: p.price,
                    compareAtPrice: p.compareAtPrice,
                    status: p.status,
                    deliveryType: p.deliveryType,
                    stockCount: p._count.stockItems,
                    soldCount: p.soldCount,
                    categoryId: p.categoryId,
                    categoryName: p.category.name,
                    imageUrl: p.images[0]?.url || null,
                    variants: p.variants.map(v => ({
                        id: v.id,
                        name: v.name,
                        price: v.price,
                        warrantyDays: v.warrantyDays,
                        isActive: v.isActive,
                    })),
                    createdAt: p.createdAt.toISOString(),
                })),
                stats,
            },
        });
    } catch (error) {
        console.error('[Seller Products] GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        // Find or verify seller's shop
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) {
            return NextResponse.json({ success: false, message: 'Bạn chưa có shop. Vui lòng đăng ký bán hàng trước.' }, { status: 403 });
        }

        const body = await request.json();
        const { name, categoryId, shortDescription, price, deliveryType, imageUrl, variants } = body;

        if (!name?.trim() || !categoryId) {
            return NextResponse.json({ success: false, message: 'Tên sản phẩm và danh mục là bắt buộc' }, { status: 400 });
        }

        const slug = name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim() + '-' + Date.now().toString(36);

        const product = await prisma.product.create({
            data: {
                shopId: shop.id,
                categoryId,
                name: name.trim(),
                slug,
                shortDescription: shortDescription?.trim() || null,
                price: parseInt(price) || (variants?.[0]?.price ? parseInt(variants[0].price) : 0),
                deliveryType: deliveryType === 'manual' ? 'MANUAL' : 'AUTO',
                status: 'ACTIVE',
                publishedAt: new Date(),
            },
        });

        // Create variants
        if (variants && variants.length > 0) {
            await prisma.productVariant.createMany({
                data: variants.map((v: { name: string; price: string; warrantyDays: string }, i: number) => ({
                    productId: product.id,
                    name: v.name || `Gói ${i + 1}`,
                    price: parseInt(v.price) || 0,
                    warrantyDays: parseInt(v.warrantyDays) || 3,
                    sortOrder: i,
                })),
            });
        }

        // Create stock items from variants (with duplicate detection)
        let totalStock = 0;
        let totalDuplicates = 0;
        let totalErrors = 0;
        let totalInput = 0;
        if (variants && variants.length > 0) {
            for (const v of variants) {
                const items = (v as any).stockItems;
                if (items && typeof items === 'string' && items.trim()) {
                    const rawLines = items.trim().split('\n');
                    totalInput += rawLines.length;
                    // Format validation: must contain '|' and be at least 5 chars (e.g. a|b@c)
                    const validLines = rawLines.filter((l: string) => l.trim().includes('|') && l.trim().length >= 5);
                    totalErrors += rawLines.length - validLines.length;

                    if (validLines.length > 0) {
                        // Hash and deduplicate within batch
                        const seen = new Set<string>();
                        const lineData: { content: string; hash: string }[] = [];
                        let selfDups = 0;
                        for (const line of validLines) {
                            const h = hashContent(line);
                            if (seen.has(h)) { selfDups++; } else { seen.add(h); lineData.push({ content: line.trim(), hash: h }); }
                        }
                        totalDuplicates += selfDups;

                        // Check against existing DB stock (all statuses)
                        const hashes = lineData.map(l => l.hash);
                        const existing = await prisma.stockItem.findMany({
                            where: { contentHash: { in: hashes } },
                            select: { contentHash: true },
                        });
                        const existingSet = new Set(existing.map(e => e.contentHash));
                        const clean = lineData.filter(l => !existingSet.has(l.hash));
                        totalDuplicates += lineData.length - clean.length;

                        if (clean.length > 0) {
                            const batch = await prisma.stockBatch.create({
                                data: { productId: product.id, sourceType: 'paste', totalLines: rawLines.length, validLines: clean.length, invalidLines: rawLines.length - clean.length, uploadedBy: authResult.userId },
                            });
                            await prisma.stockItem.createMany({
                                data: clean.map(item => ({ productId: product.id, rawContent: item.content, contentHash: item.hash, batchId: batch.id, uploadedBy: authResult.userId })),
                            });
                            totalStock += clean.length;
                        }
                    }
                }
            }
        }

        // Update stock count
        if (totalStock > 0) {
            await prisma.product.update({ where: { id: product.id }, data: { stockCountCached: totalStock } });
        }

        // Create image if provided
        if (imageUrl) {
            await prisma.productImage.create({
                data: { productId: product.id, url: imageUrl, sortOrder: 0 },
            });
        }

        // Update shop product count
        await prisma.shop.update({
            where: { id: shop.id },
            data: { productCount: { increment: 1 } },
        });

        // Build detailed message
        let message = `Đã tạo sản phẩm "${name}"`;
        if (totalInput > 0) {
            const parts: string[] = [];
            if (totalStock > 0) parts.push(`✅ Thêm: ${totalStock}`);
            if (totalDuplicates > 0) parts.push(`🔁 Trùng: ${totalDuplicates}`);
            if (totalErrors > 0) parts.push(`❌ Lỗi: ${totalErrors}`);
            message += ` | Kho (${totalInput} dòng): ${parts.join(', ')}`;
        }

        return NextResponse.json({
            success: true,
            message,
            data: { id: product.id, slug: product.slug, stockAdded: totalStock, stockDuplicates: totalDuplicates, stockErrors: totalErrors },
        });
    } catch (error) {
        console.error('[Seller Products] POST error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi tạo sản phẩm' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const body = await request.json();
        const { id, name, categoryId, shortDescription, price, deliveryType, status, imageUrl, variants } = body;

        if (!id) return NextResponse.json({ success: false, message: 'Thiếu ID sản phẩm' }, { status: 400 });

        // Verify ownership
        const existing = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
        if (!existing) return NextResponse.json({ success: false, message: 'Không tìm thấy sản phẩm' }, { status: 404 });

        await prisma.product.update({
            where: { id },
            data: {
                ...(name && { name: name.trim() }),
                ...(categoryId && { categoryId }),
                ...(shortDescription !== undefined && { shortDescription: shortDescription?.trim() || null }),
                ...(price && { price: parseInt(price) }),
                ...(deliveryType && { deliveryType: deliveryType === 'manual' ? 'MANUAL' : 'AUTO' }),
                ...(status && { status }),
            },
        });

        // Update variants if provided
        let newStockCount = 0;
        let dupCount = 0;
        let errorCount = 0;
        let inputCount = 0;
        let deletedCount = 0;
        if (variants && variants.length > 0) {
            await prisma.productVariant.deleteMany({ where: { productId: id } });
            await prisma.productVariant.createMany({
                data: variants.map((v: { name: string; price: string; warrantyDays: string }, i: number) => ({
                    productId: id,
                    name: v.name || `Gói ${i + 1}`,
                    price: parseInt(v.price) || 0,
                    warrantyDays: parseInt(v.warrantyDays) || 3,
                    sortOrder: i,
                })),
            });

            // ── STOCK SYNC: compare textarea content with existing DB stock ──
            // Collect all stock lines from all variants
            const allStockLines: string[] = [];
            for (const v of variants) {
                const items = (v as any).stockItems;
                if (items && typeof items === 'string' && items.trim()) {
                    const lines = items.trim().split('\n');
                    for (const line of lines) {
                        if (line.trim()) allStockLines.push(line.trim());
                    }
                }
            }
            inputCount = allStockLines.length;

            // Format validation: each line must contain '|' (e.g. email|pass)
            const validLines: string[] = [];
            for (const line of allStockLines) {
                if (line.includes('|') && line.length >= 5) {
                    validLines.push(line);
                } else {
                    errorCount++;
                }
            }

            // Hash valid lines
            const lineHashes = validLines.map(line => ({ content: line, hash: hashContent(line) }));

            // Get existing AVAILABLE stock items from DB
            const existingItems = await prisma.stockItem.findMany({
                where: { productId: id, status: 'AVAILABLE' },
                select: { id: true, rawContent: true, contentHash: true },
            });

            // Build set of hashes from the textarea
            const textareaHashes = new Set(lineHashes.map(l => l.hash));

            // Find items to DELETE (in DB but removed from textarea)
            const itemsToDelete = existingItems.filter(item => {
                const h = item.contentHash || hashContent(item.rawContent);
                return !textareaHashes.has(h);
            });
            if (itemsToDelete.length > 0) {
                await prisma.stockItem.deleteMany({
                    where: { id: { in: itemsToDelete.map(i => i.id) } },
                });
                deletedCount = itemsToDelete.length;
            }

            // Find items to ADD (in textarea but not in DB)
            const existingHashSet = new Set(existingItems.map(item => item.contentHash || hashContent(item.rawContent)));

            // Also dedupe within the batch itself
            const seen = new Set<string>();
            const newItems: { content: string; hash: string }[] = [];
            for (const item of lineHashes) {
                if (seen.has(item.hash)) {
                    dupCount++;
                } else {
                    seen.add(item.hash);
                    if (existingHashSet.has(item.hash)) {
                        // Already exists in DB as AVAILABLE — skip (not a duplicate, just existing)
                    } else {
                        newItems.push(item);
                    }
                }
            }

            // Check new items against ALL stock (including SOLD from other products)
            if (newItems.length > 0) {
                const globalExisting = await prisma.stockItem.findMany({
                    where: { contentHash: { in: newItems.map(i => i.hash) } },
                    select: { contentHash: true },
                });
                const globalSet = new Set(globalExisting.map(e => e.contentHash));
                const clean = newItems.filter(i => !globalSet.has(i.hash));
                dupCount += newItems.length - clean.length;

                if (clean.length > 0) {
                    const batch = await prisma.stockBatch.create({
                        data: { productId: id, sourceType: 'paste', totalLines: inputCount, validLines: clean.length, invalidLines: errorCount, uploadedBy: authResult.userId },
                    });
                    await prisma.stockItem.createMany({
                        data: clean.map(item => ({ productId: id, rawContent: item.content, contentHash: item.hash, batchId: batch.id, uploadedBy: authResult.userId })),
                    });
                    newStockCount = clean.length;
                }
            }

            // Update stock count cache
            const totalAvailable = await prisma.stockItem.count({ where: { productId: id, status: 'AVAILABLE' } });
            await prisma.product.update({ where: { id }, data: { stockCountCached: totalAvailable } });
        }

        // Update image if provided
        if (imageUrl !== undefined) {
            await prisma.productImage.deleteMany({ where: { productId: id } });
            if (imageUrl) {
                await prisma.productImage.create({
                    data: { productId: id, url: imageUrl, sortOrder: 0 },
                });
            }
        }

        // Build detailed message
        let message = `Đã cập nhật sản phẩm`;
        if (inputCount > 0 || deletedCount > 0) {
            const parts: string[] = [];
            if (newStockCount > 0) parts.push(`✅ Thêm: ${newStockCount}`);
            if (dupCount > 0) parts.push(`🔁 Trùng: ${dupCount}`);
            if (errorCount > 0) parts.push(`❌ Lỗi format: ${errorCount}`);
            if (deletedCount > 0) parts.push(`🗑️ Xóa: ${deletedCount}`);
            message += ` | Kho: ${parts.join(', ')}`;
        }

        return NextResponse.json({
            success: true,
            message,
            data: { stockAdded: newStockCount, stockDuplicates: dupCount, stockErrors: errorCount, stockDeleted: deletedCount },
        });
    } catch (error) {
        console.error('[Seller Products] PUT error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi cập nhật' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Không tìm thấy shop' }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ success: false, message: 'Thiếu ID' }, { status: 400 });

        const existing = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
        if (!existing) return NextResponse.json({ success: false, message: 'Không tìm thấy sản phẩm' }, { status: 404 });

        await prisma.product.update({
            where: { id },
            data: { status: 'ARCHIVED' },
        });

        await prisma.shop.update({
            where: { id: shop.id },
            data: { productCount: { decrement: 1 } },
        });

        return NextResponse.json({ success: true, message: 'Đã xóa sản phẩm' });
    } catch (error) {
        console.error('[Seller Products] DELETE error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi xóa' }, { status: 500 });
    }
}
