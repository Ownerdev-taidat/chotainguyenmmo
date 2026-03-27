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
        if (variants && variants.length > 0) {
            for (const v of variants) {
                const items = (v as any).stockItems;
                if (items && typeof items === 'string' && items.trim()) {
                    const lines = items.trim().split('\n').filter((l: string) => l.trim());
                    if (lines.length > 0) {
                        // Hash and deduplicate within batch
                        const seen = new Set<string>();
                        const lineData: { content: string; hash: string }[] = [];
                        for (const line of lines) {
                            const h = hashContent(line);
                            if (!seen.has(h)) { seen.add(h); lineData.push({ content: line.trim(), hash: h }); }
                        }

                        // Check against existing DB stock (all statuses)
                        const hashes = lineData.map(l => l.hash);
                        const existing = await prisma.stockItem.findMany({
                            where: { contentHash: { in: hashes } },
                            select: { contentHash: true },
                        });
                        const existingSet = new Set(existing.map(e => e.contentHash));
                        const clean = lineData.filter(l => !existingSet.has(l.hash));
                        totalDuplicates += lines.length - clean.length;

                        if (clean.length > 0) {
                            const batch = await prisma.stockBatch.create({
                                data: { productId: product.id, sourceType: 'paste', totalLines: lines.length, validLines: clean.length, invalidLines: lines.length - clean.length, uploadedBy: authResult.userId },
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

        return NextResponse.json({
            success: true,
            message: `Đã tạo sản phẩm "${name}"${totalStock > 0 ? ` với ${totalStock} sản phẩm trong kho` : ''}${totalDuplicates > 0 ? ` (loại ${totalDuplicates} mục trùng)` : ''}`,
            data: { id: product.id, slug: product.slug },
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

            // Add new stock items from variants (with duplicate detection)
            let newStockCount = 0;
            let dupCount = 0;
            for (const v of variants) {
                const items = (v as any).stockItems;
                if (items && typeof items === 'string' && items.trim()) {
                    const lines = items.trim().split('\n').filter((l: string) => l.trim());
                    if (lines.length > 0) {
                        // Hash and deduplicate within batch
                        const seen = new Set<string>();
                        const lineData: { content: string; hash: string }[] = [];
                        for (const line of lines) {
                            const h = hashContent(line);
                            if (!seen.has(h)) { seen.add(h); lineData.push({ content: line.trim(), hash: h }); }
                        }

                        // Check against existing DB stock (all statuses)
                        const hashes = lineData.map(l => l.hash);
                        const existing = await prisma.stockItem.findMany({
                            where: { contentHash: { in: hashes } },
                            select: { contentHash: true },
                        });
                        const existingSet = new Set(existing.map(e => e.contentHash));
                        const clean = lineData.filter(l => !existingSet.has(l.hash));
                        dupCount += lines.length - clean.length;

                        if (clean.length > 0) {
                            const batch = await prisma.stockBatch.create({
                                data: { productId: id, sourceType: 'paste', totalLines: lines.length, validLines: clean.length, invalidLines: lines.length - clean.length, uploadedBy: authResult.userId },
                            });
                            await prisma.stockItem.createMany({
                                data: clean.map(item => ({ productId: id, rawContent: item.content, contentHash: item.hash, batchId: batch.id, uploadedBy: authResult.userId })),
                            });
                            newStockCount += clean.length;
                        }
                    }
                }
            }

            // Update stock count
            if (newStockCount > 0) {
                const totalAvailable = await prisma.stockItem.count({ where: { productId: id, status: 'AVAILABLE' } });
                await prisma.product.update({ where: { id }, data: { stockCountCached: totalAvailable } });
            }
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

        return NextResponse.json({ success: true, message: 'Đã cập nhật sản phẩm' });
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
