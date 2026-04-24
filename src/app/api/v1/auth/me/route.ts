export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const user = await prisma.user.findUnique({
            where: { id: authResult.userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                avatarUrl: true,
                phone: true,
                role: true,
                status: true,
                emailVerifiedAt: true,
                twoFactorEnabled: true,
                termsAcceptedAt: true,
                createdAt: true,
                wallet: {
                    select: {
                        availableBalance: true,
                        heldBalance: true,
                        totalDeposited: true,
                        totalSpent: true,
                    },
                },
                shop: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        status: true,
                        verified: true,
                        sellerTermsAcceptedAt: true,
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Không tìm thấy người dùng', errorCode: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        console.error('Get me error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
