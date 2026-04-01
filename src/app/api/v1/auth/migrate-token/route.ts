import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * POST /api/v1/auth/migrate-token
 * ================================
 * Chuyển token từ localStorage → httpOnly cookie
 * Gọi 1 lần duy nhất khi user có token cũ trong localStorage
 */
export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ success: false, message: 'No token' }, { status: 400 });
        }

        // Verify token hợp lệ
        const payload = await verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ success: false, message: 'Token expired' }, { status: 401 });
        }

        // Lấy user info mới nhất từ DB
        const user = await prisma.user.findUnique({
            where: { id: payload.userId as string },
            include: { wallet: { select: { availableBalance: true } } },
        });

        if (!user || user.status === 'BANNED') {
            return NextResponse.json({ success: false, message: 'User not found or banned' }, { status: 403 });
        }

        // Set httpOnly cookie với token hiện tại
        const response = NextResponse.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    avatarUrl: user.avatarUrl,
                    walletBalance: user.wallet?.availableBalance || 0,
                },
            },
        });

        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('[Migrate Token] Error:', error);
        return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
    }
}
