import { NextResponse } from 'next/server';

/**
 * POST /api/v1/auth/logout
 * ========================
 * Xóa httpOnly cookie — client không thể tự xóa
 */
export async function POST() {
    const response = NextResponse.json({ success: true });

    // Clear httpOnly cookie
    response.cookies.set('token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });

    return response;
}
