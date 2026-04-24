export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET — List user's favorites
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const favorites = await prisma.favorite.findMany({
            where: { userId: authResult.userId },
            orderBy: { createdAt: 'desc' },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                        soldCount: true,
                        stockCountCached: true,
                        ratingAverage: true,
                        deliveryType: true,
                        status: true,
                        images: { select: { url: true }, take: 1 },
                        category: { select: { name: true, slug: true } },
                        shop: { select: { name: true, slug: true, verified: true } },
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: favorites.map(f => ({
                id: f.id,
                productId: f.productId,
                addedAt: f.createdAt,
                product: f.product,
            })),
        });
    } catch (error) {
        console.error('Get favorites error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// POST — Toggle favorite (add/remove)
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { productId } = await request.json();

        if (!productId) {
            return NextResponse.json({ success: false, message: 'Thiếu productId' }, { status: 400 });
        }

        // Check if already favorited
        const existing = await prisma.favorite.findUnique({
            where: { userId_productId: { userId: authResult.userId, productId } },
        });

        if (existing) {
            // Remove favorite
            await prisma.favorite.delete({ where: { id: existing.id } });
            return NextResponse.json({ success: true, favorited: false, message: 'Đã bỏ yêu thích' });
        } else {
            // Add favorite
            await prisma.favorite.create({
                data: { userId: authResult.userId, productId },
            });
            return NextResponse.json({ success: true, favorited: true, message: 'Đã thêm vào yêu thích' });
        }
    } catch (error) {
        console.error('Toggle favorite error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// DELETE — Remove a favorite by ID
export async function DELETE(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');

        if (!productId) {
            return NextResponse.json({ success: false, message: 'Thiếu productId' }, { status: 400 });
        }

        await prisma.favorite.deleteMany({
            where: { userId: authResult.userId, productId },
        });

        return NextResponse.json({ success: true, message: 'Đã bỏ yêu thích' });
    } catch (error) {
        console.error('Delete favorite error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

