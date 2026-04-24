export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { signToken, hashPassword } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu', errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Find user by username or email
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: username },
                    { email: username },
                ],
            },
            include: {
                wallet: { select: { availableBalance: true } },
            },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng', errorCode: 'INVALID_CREDENTIALS' },
                { status: 401 }
            );
        }

        // Verify password
        const passwordHashInput = hashPassword(password);
        if (passwordHashInput !== user.passwordHash) {
            return NextResponse.json(
                { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng', errorCode: 'INVALID_CREDENTIALS' },
                { status: 401 }
            );
        }

        // Check if banned
        if (user.status === 'BANNED') {
            return NextResponse.json(
                { success: false, message: 'Tài khoản đã bị khóa. Liên hệ admin để được hỗ trợ.', errorCode: 'ACCOUNT_BANNED' },
                { status: 403 }
            );
        }

        if (user.status === 'SUSPENDED') {
            return NextResponse.json(
                { success: false, message: 'Tài khoản đang bị tạm khóa. Liên hệ admin.', errorCode: 'ACCOUNT_SUSPENDED' },
                { status: 403 }
            );
        }

        const token = await signToken({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        });

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        }).catch(() => {}); // Non-critical, don't fail login

        const response = NextResponse.json({
            success: true,
            message: 'Đăng nhập thành công',
            data: {
                token,
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

        // Set cookie
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại sau.', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
