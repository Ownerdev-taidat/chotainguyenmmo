export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { signToken, hashPassword } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getOrCreateUserApiKey } from '@/lib/api-keys';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, email, password, fullName, termsAccepted } = body;

        // Validation
        if (!username || !email || !password || !fullName) {
            return NextResponse.json(
                { success: false, message: 'Vui lòng điền đầy đủ thông tin', errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        if (!termsAccepted) {
            return NextResponse.json(
                { success: false, message: 'Bạn phải đồng ý với điều khoản sử dụng', errorCode: 'TERMS_NOT_ACCEPTED' },
                { status: 400 }
            );
        }

        if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
            return NextResponse.json(
                { success: false, message: 'Tên đăng nhập chỉ chứa chữ, số, dấu chấm và gạch dưới (3–30 ký tự)', errorCode: 'INVALID_USERNAME' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự', errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Check username exists
        const existingUsername = await prisma.user.findUnique({ where: { username } });
        if (existingUsername) {
            return NextResponse.json(
                { success: false, message: 'Tên đăng nhập đã được sử dụng', errorCode: 'USERNAME_EXISTS' },
                { status: 409 }
            );
        }

        // Check email exists
        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail) {
            return NextResponse.json(
                { success: false, message: 'Email đã được sử dụng', errorCode: 'EMAIL_EXISTS' },
                { status: 409 }
            );
        }

        // Create user in Prisma DB
        const user = await prisma.user.create({
            data: {
                username,
                email,
                passwordHash: hashPassword(password),
                fullName,
                role: 'USER',
                status: 'ACTIVE',
                termsVersion: '1.0',
                termsAcceptedAt: new Date(),
            },
        });

        // Create wallet for new user
        await prisma.wallet.create({
            data: { userId: user.id },
        });

        // Auto-generate API key for new user
        try {
            await getOrCreateUserApiKey(user.id);
        } catch (e) {
            console.error('Auto API key generation failed:', e);
        }

        // Generate JWT
        const token = await signToken({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
        });

        const response = NextResponse.json({
            success: true,
            message: 'Tạo tài khoản thành công',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    fullName: user.fullName,
                    role: user.role,
                    avatarUrl: null,
                    walletBalance: 0,
                },
            },
        }, { status: 201 });

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
        console.error('Register error:', error);
        return NextResponse.json(
            { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại sau.', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
