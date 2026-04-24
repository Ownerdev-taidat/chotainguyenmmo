export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hashPassword } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST /api/v1/auth/change-password
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ success: false, message: 'Thiếu thông tin' }, { status: 400 });
        }
        if (newPassword.length < 8) {
            return NextResponse.json({ success: false, message: 'Mật khẩu mới tối thiểu 8 ký tự' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: authResult.userId } });
        if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

        // Verify current password
        if (hashPassword(currentPassword) !== user.passwordHash) {
            return NextResponse.json({ success: false, message: 'Mật khẩu hiện tại không đúng' }, { status: 400 });
        }

        // Update password
        await prisma.user.update({
            where: { id: authResult.userId },
            data: { passwordHash: hashPassword(newPassword) },
        });

        return NextResponse.json({ success: true, message: 'Đã đổi mật khẩu thành công!' });
    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
