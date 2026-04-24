export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/v1/shops — Public shop listing
export async function GET() {
    try {
        const shops = await prisma.shop.findMany({
            where: { status: 'ACTIVE' },
            orderBy: { successfulOrdersCount: 'desc' },
            select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                bannerUrl: true,
                shortDescription: true,
                verified: true,
                ratingAverage: true,
                ratingCount: true,
                productCount: true,
                successfulOrdersCount: true,
                joinedAt: true,
            },
        });

        return NextResponse.json({ success: true, data: shops });
    } catch (error) {
        console.error('List shops error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
