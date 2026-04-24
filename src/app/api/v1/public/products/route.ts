export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api-keys';
import prisma from '@/lib/prisma';

/**
 * Public Product API — Authenticate via x-api-key header
 * GET ?slug=xxx  — Get product details + availability
 * GET            — List products
 * POST           — Purchase product via API (with optional voucher)
 */

export async function GET(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key') || new URL(req.url).searchParams.get('api_key');
    if (!apiKey) {
        return NextResponse.json({
            success: false,
            message: 'API Key required. Pass via x-api-key header or api_key query param.',
            docs: '/api-docs',
        }, { status: 401 });
    }

    const keyData = await validateApiKey(apiKey);
    if (!keyData) {
        return NextResponse.json({ success: false, message: 'Invalid or revoked API Key' }, { status: 403 });
    }

    if (!keyData.permissions.includes('products:read')) {
        return NextResponse.json({ success: false, message: 'Permission denied: products:read required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const productId = searchParams.get('id');

    try {
        if (slug || productId) {
            // Single product detail
            const where = slug ? { slug } : { id: productId! };
            const product = await prisma.product.findFirst({
                where: { ...where, status: 'ACTIVE' },
                include: {
                    shop: { select: { name: true, slug: true } },
                    category: { select: { name: true } },
                    variants: {
                        where: { isActive: true },
                        orderBy: { sortOrder: 'asc' },
                        select: { id: true, name: true, price: true, warrantyDays: true },
                    },
                    images: { orderBy: { sortOrder: 'asc' }, select: { url: true, alt: true } },
                },
            });

            if (!product) {
                return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
            }

            const stockAvailable = await prisma.stockItem.count({
                where: { productId: product.id, status: 'AVAILABLE' },
            });

            return NextResponse.json({
                success: true,
                data: {
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    shortDescription: product.shortDescription,
                    price: product.price,
                    compareAtPrice: product.compareAtPrice,
                    deliveryType: product.deliveryType,
                    inStock: stockAvailable > 0,
                    stockAvailable,
                    soldCount: product.soldCount,
                    rating: product.ratingAverage,
                    ratingCount: product.ratingCount,
                    shop: product.shop,
                    category: product.category?.name,
                    variants: product.variants,
                    images: product.images,
                },
            });
        }

        // List products
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
        const category = searchParams.get('category');
        const search = searchParams.get('search') || searchParams.get('q');

        const where: any = { status: 'ACTIVE' };
        if (category) where.category = { slug: category };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [total, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true, name: true, slug: true, price: true, compareAtPrice: true,
                    stockCountCached: true, soldCount: true, ratingAverage: true,
                    shop: { select: { name: true, slug: true } },
                    images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } },
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: products.map(p => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                price: p.price,
                compareAtPrice: p.compareAtPrice,
                inStock: p.stockCountCached > 0,
                soldCount: p.soldCount,
                rating: p.ratingAverage,
                shop: p.shop,
                image: p.images[0]?.url || null,
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('[Public Products API] Error:', error);
        return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key') || '';
    if (!apiKey) {
        return NextResponse.json({ success: false, message: 'API Key required' }, { status: 401 });
    }

    const keyData = await validateApiKey(apiKey);
    if (!keyData) {
        return NextResponse.json({ success: false, message: 'Invalid or revoked API Key' }, { status: 403 });
    }

    if (!keyData.permissions.includes('purchase')) {
        return NextResponse.json({ success: false, message: 'Permission denied: purchase required' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { productSlug, productId, quantity, variantId, voucherCode } = body;

        // Find product
        const pwhere: any = { status: 'ACTIVE' };
        if (productSlug) pwhere.slug = productSlug;
        else if (productId) pwhere.id = productId;
        else return NextResponse.json({ success: false, message: 'productSlug or productId required' }, { status: 400 });

        const product = await prisma.product.findFirst({
            where: pwhere,
            include: {
                shop: { select: { id: true, name: true, ownerId: true } },
                variants: { where: { isActive: true } },
                category: { select: { feePercent: true } },
            },
        });

        if (!product) {
            return NextResponse.json({ success: false, message: 'Product not found or inactive' }, { status: 404 });
        }

        const qty = Math.max(1, Math.min(quantity || 1, product.maxPurchaseQty));

        // Determine price
        let unitPrice = product.price;
        if (variantId) {
            const variant = product.variants.find(v => v.id === variantId);
            if (variant) unitPrice = variant.price;
        }

        // Check stock
        const stockWhere: any = { productId: product.id, status: 'AVAILABLE' };
        if (variantId) stockWhere.variantId = variantId;

        const availableStock = await prisma.stockItem.count({ where: stockWhere });
        if (availableStock < qty) {
            return NextResponse.json({ success: false, message: `Không đủ hàng. Còn ${availableStock} sản phẩm.` }, { status: 400 });
        }

        // Apply voucher
        let discountAmount = 0;
        let voucher: any = null;
        if (voucherCode) {
            voucher = await prisma.voucher.findFirst({
                where: {
                    code: voucherCode.toUpperCase().trim(),
                    shopId: product.shop.id,
                    isActive: true,
                    OR: [{ productId: null }, { productId: product.id }],
                },
            });

            if (voucher && voucher.usedCount < voucher.usageLimit) {
                if (!voucher.expiresAt || voucher.expiresAt > new Date()) {
                    const subtotal = unitPrice * qty;
                    if (!voucher.minOrderAmount || subtotal >= voucher.minOrderAmount) {
                        if (voucher.discountType === 'PERCENT') {
                            discountAmount = Math.floor(subtotal * voucher.discountValue / 100);
                            if (voucher.maxDiscount) discountAmount = Math.min(discountAmount, voucher.maxDiscount);
                        } else {
                            discountAmount = voucher.discountValue;
                        }
                    }
                }
            }
        }

        const subtotal = unitPrice * qty;
        const totalAmount = Math.max(0, subtotal - discountAmount);

        // Check buyer wallet
        const wallet = await prisma.wallet.findUnique({ where: { userId: keyData.userId } });
        if (!wallet || wallet.availableBalance < totalAmount) {
            return NextResponse.json({
                success: false,
                message: `Số dư không đủ. Cần ${totalAmount.toLocaleString()}đ, hiện có ${(wallet?.availableBalance || 0).toLocaleString()}đ.`,
            }, { status: 400 });
        }

        // Execute purchase transaction
        const orderCode = `API-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const result = await prisma.$transaction(async (tx) => {
            // Get stock items
            const stockItems = await tx.stockItem.findMany({
                where: stockWhere,
                take: qty,
                orderBy: { createdAt: 'asc' },
            });

            // Mark as sold
            for (const item of stockItems) {
                await tx.stockItem.update({
                    where: { id: item.id },
                    data: { status: 'SOLD', soldAt: new Date(), orderId: orderCode },
                });
            }

            // Create order
            const newOrder = await tx.order.create({
                data: {
                    orderCode,
                    buyerId: keyData.userId,
                    shopId: product.shop.id,
                    status: 'COMPLETED',
                    subtotal,
                    discountAmount,
                    totalAmount,
                    paymentStatus: 'PAID',
                    deliveryStatus: 'DELIVERED',
                    paidAt: new Date(),
                    deliveredAt: new Date(),
                    completedAt: new Date(),
                    items: { create: { productId: product.id, quantity: qty, unitPrice, total: subtotal } },
                },
            });

            // Delivery content
            await tx.delivery.create({
                data: {
                    orderId: newOrder.id,
                    content: stockItems.map(s => s.rawContent).join('\n'),
                    status: 'DELIVERED',
                },
            });

            // Deduct buyer
            await tx.wallet.update({
                where: { userId: keyData.userId },
                data: { availableBalance: { decrement: totalAmount }, totalSpent: { increment: totalAmount } },
            });

            // Credit seller (per-category fee or global default)
            const { getPlatformSettings } = await import('@/lib/mock-order-store');
            const globalRate = getPlatformSettings().commissionRate;
            const commissionRate = product.category?.feePercent ?? globalRate;
            const feeAmount = Math.floor(totalAmount * commissionRate / 100);
            const sellerEarning = totalAmount - feeAmount;
            await tx.wallet.upsert({
                where: { userId: product.shop.ownerId },
                create: { userId: product.shop.ownerId, availableBalance: sellerEarning },
                update: { availableBalance: { increment: sellerEarning } },
            });

            // Update stock cache
            const remaining = await tx.stockItem.count({ where: { productId: product.id, status: 'AVAILABLE' } });
            await tx.product.update({
                where: { id: product.id },
                data: { stockCountCached: remaining, soldCount: { increment: qty } },
            });

            // Update voucher usage
            if (voucher && discountAmount > 0) {
                await tx.voucher.update({ where: { id: voucher.id }, data: { usedCount: { increment: 1 } } });
            }

            return { order: newOrder, items: stockItems };
        });

        return NextResponse.json({
            success: true,
            message: 'Mua hàng thành công',
            data: {
                orderCode,
                productName: product.name,
                quantity: qty,
                unitPrice,
                subtotal,
                discountAmount,
                totalAmount,
                voucherApplied: discountAmount > 0 ? voucherCode : null,
                deliveredContent: result.items.map(s => s.rawContent),
                remainingBalance: wallet.availableBalance - totalAmount,
            },
        });
    } catch (error) {
        console.error('[Public Products API] Purchase error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi mua hàng' }, { status: 500 });
    }
}
