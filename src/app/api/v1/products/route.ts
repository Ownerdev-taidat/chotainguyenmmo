export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/v1/products — Public product listing with filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 60);
        const category = searchParams.get('category');
        const shop = searchParams.get('shop');
        const search = searchParams.get('q');
        const sort = searchParams.get('sort') || 'newest';
        const minPrice = searchParams.get('minPrice');
        const maxPrice = searchParams.get('maxPrice');
        const featured = searchParams.get('featured');

        // Build where clause
        const where: Record<string, unknown> = { status: 'ACTIVE' };

        if (category) {
            where.category = { slug: category };
        }
        if (shop) {
            where.shop = { slug: shop };
        }
        if (search) {
            const searchTrimmed = search.trim();
            const searchNoSpaces = searchTrimmed.replace(/\s+/g, '').toLowerCase();
            const words = searchTrimmed.split(/\s+/).filter(Boolean);

            if (words.length > 1) {
                // Multiple words: each word must appear in name, description, or category
                where.AND = words.map((word: string) => ({
                    OR: [
                        { name: { contains: word, mode: 'insensitive' } },
                        { shortDescription: { contains: word, mode: 'insensitive' } },
                        { category: { name: { contains: word, mode: 'insensitive' } } },
                    ],
                }));
            } else {
                // Single word: try both normal contains AND space-stripped matching via raw filter
                // Use Prisma raw filter to check REPLACE(LOWER(name), ' ', '') LIKE '%searchnospaces%'
                where.OR = [
                    { name: { contains: searchTrimmed, mode: 'insensitive' } },
                    { shortDescription: { contains: searchTrimmed, mode: 'insensitive' } },
                    { category: { name: { contains: searchTrimmed, mode: 'insensitive' } } },
                ];

                // Also find IDs via raw SQL for space-stripped matching
                try {
                    const rawIds: { id: string }[] = await prisma.$queryRawUnsafe(
                        `SELECT id FROM "Product" WHERE status = 'ACTIVE' AND (
                            LOWER(REPLACE(name, ' ', '')) LIKE $1 OR
                            LOWER(REPLACE(COALESCE("shortDescription", ''), ' ', '')) LIKE $1
                        ) LIMIT $2`,
                        `%${searchNoSpaces}%`,
                        limit
                    );
                    if (rawIds.length > 0) {
                        // Merge: OR with id-based matches
                        (where.OR as any[]).push({ id: { in: rawIds.map(r => r.id) } });
                    }
                } catch { /* ignore raw query errors, fall back to normal search */ }
            }
        }
        if (minPrice) where.price = { ...((where.price as object) || {}), gte: parseInt(minPrice) };
        if (maxPrice) where.price = { ...((where.price as object) || {}), lte: parseInt(maxPrice) };
        if (featured === 'true') where.isFeatured = true;

        // Sort
        let orderBy: Record<string, string> | Record<string, string>[] = { createdAt: 'desc' };
        if (sort === 'price_asc') orderBy = { price: 'asc' };
        else if (sort === 'price_desc') orderBy = { price: 'desc' };
        else if (sort === 'bestselling') orderBy = { soldCount: 'desc' };
        else if (sort === 'rating') orderBy = { ratingAverage: 'desc' };
        else if (sort === 'homepage') orderBy = [
            { ratingAverage: 'desc' },
            { soldCount: 'desc' },
            { ratingCount: 'desc' },
        ];

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    category: { select: { name: true, slug: true } },
                    shop: { select: { name: true, slug: true, verified: true, logoUrl: true } },
                    images: { take: 1, orderBy: { sortOrder: 'asc' } },
                    _count: {
                        select: { stockItems: { where: { status: 'AVAILABLE' } } },
                    },
                },
            }),
            prisma.product.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                products: products.map(p => ({
                    ...p,
                    stockCountCached: p._count.stockItems || p.stockCountCached,
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error('List products error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

