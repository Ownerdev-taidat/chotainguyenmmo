export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/v1/reviews — Create a review for an order
 * GET /api/v1/reviews?productId=xxx — Get reviews for a product
 */

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { orderId, productId, rating, comment } = await request.json();

        if (!orderId || !productId || !rating) {
            return NextResponse.json({ success: false, message: 'Thiếu thông tin đánh giá' }, { status: 400 });
        }

        if (rating < 1 || rating > 5) {
            return NextResponse.json({ success: false, message: 'Đánh giá phải từ 1-5 sao' }, { status: 400 });
        }

        // Verify the user actually bought this order
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                buyerId: authResult.userId,
                status: { in: ['COMPLETED', 'PAID', 'DELIVERED'] },
            },
            include: { items: { select: { productId: true } } },
        });

        if (!order) {
            return NextResponse.json({ success: false, message: 'Đơn hàng không hợp lệ hoặc chưa hoàn tất' }, { status: 400 });
        }

        // Check product belongs to order
        const orderHasProduct = order.items.some(item => item.productId === productId);
        if (!orderHasProduct) {
            return NextResponse.json({ success: false, message: 'Sản phẩm không thuộc đơn hàng này' }, { status: 400 });
        }

        // Check duplicate review (enforced by @@unique([userId, orderId]))
        const existing = await prisma.review.findFirst({
            where: { userId: authResult.userId, orderId },
        });
        if (existing) {
            return NextResponse.json({ success: false, message: 'Bạn đã đánh giá đơn hàng này rồi' }, { status: 400 });
        }

        const review = await prisma.review.create({
            data: {
                productId,
                userId: authResult.userId,
                orderId,
                rating,
                comment: comment?.trim() || null,
            },
        });

        // Update product rating cache
        const avgResult = await prisma.review.aggregate({
            where: { productId, status: 'ACTIVE' },
            _avg: { rating: true },
            _count: { rating: true },
        });

        await prisma.product.update({
            where: { id: productId },
            data: {
                ratingAverage: avgResult._avg.rating || 0,
                ratingCount: avgResult._count.rating || 0,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Đánh giá thành công!',
            data: review,
        });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return NextResponse.json({ success: false, message: 'Bạn đã đánh giá đơn hàng này rồi' }, { status: 400 });
        }
        console.error('Review error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
        return NextResponse.json({ success: false, message: 'Thiếu productId' }, { status: 400 });
    }

    try {
        const reviews = await prisma.review.findMany({
            where: { productId, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                user: { select: { fullName: true, username: true, avatarUrl: true } },
            },
        });

        const avg = await prisma.review.aggregate({
            where: { productId, status: 'ACTIVE' },
            _avg: { rating: true },
            _count: { rating: true },
        });

        // If user is authenticated, also return their reviewed orderIds for this product
        let myReviewedOrderIds: string[] = [];
        try {
            const authResult = await requireAuth(request);
            if (!(authResult instanceof NextResponse)) {
                const userReviews = await prisma.review.findMany({
                    where: { productId, userId: authResult.userId },
                    select: { orderId: true },
                });
                myReviewedOrderIds = userReviews.map(r => r.orderId).filter(Boolean) as string[];
            }
        } catch {} // Not authenticated — fine, just skip

        return NextResponse.json({
            success: true,
            data: {
                reviews: reviews.map(r => ({
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    userName: r.user.fullName || r.user.username,
                    userAvatar: r.user.avatarUrl,
                    createdAt: r.createdAt.toISOString(),
                })),
                avgRating: Math.round((avg._avg.rating || 0) * 10) / 10,
                totalReviews: avg._count.rating || 0,
                myReviewedOrderIds,
            },
        });
    } catch (error) {
        console.error('Reviews GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
