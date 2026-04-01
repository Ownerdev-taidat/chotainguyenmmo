import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { signToken, hashPassword } from '@/lib/auth';

// ⚠️ BẮT BUỘC set ADMIN_SECRET_KEY trong .env — không có fallback
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
if (!ADMIN_SECRET_KEY) {
    console.error('[SECURITY] ADMIN_SECRET_KEY chưa được cấu hình trong .env!');
}

/**
 * Admin Key Login — enter admin key only, auto-login as admin
 */
export async function POST(request: NextRequest) {
    try {
        const { adminKey } = await request.json();

        if (!adminKey || adminKey !== ADMIN_SECRET_KEY) {
            return NextResponse.json({ success: false, message: 'Admin Key không đúng' }, { status: 401 });
        }

        // Find the admin/super_admin user
        let adminUser = await prisma.user.findFirst({
            where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
            orderBy: { createdAt: 'asc' },
        });

        // Auto-create admin if none exists (e.g. after deleting all users)
        if (!adminUser) {
            adminUser = await prisma.user.create({
                data: {
                    username: 'admin',
                    email: 'admin@chotainguyen.com',
                    passwordHash: hashPassword('admin@CTN2026'),
                    fullName: 'Admin CTN',
                    role: 'SUPER_ADMIN',
                    status: 'ACTIVE',
                },
            });
        }

        // Generate JWT token for admin
        const token = await signToken({
            userId: adminUser.id,
            email: adminUser.email,
            role: adminUser.role,
        });

        return NextResponse.json({
            success: true,
            data: {
                token,
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    email: adminUser.email,
                    fullName: adminUser.fullName,
                    role: adminUser.role,
                },
            },
        });
    } catch (error) {
        console.error('[Admin Key Login] Error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
