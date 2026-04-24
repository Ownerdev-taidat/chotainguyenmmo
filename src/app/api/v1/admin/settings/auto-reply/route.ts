export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// Simple file-based auto-reply storage (no extra DB model needed)
const AUTO_REPLY_KEY = 'AUTO_REPLY_MESSAGE';

// In-memory cache for auto-reply
let cachedAutoReply: string | null = null;

// GET /api/v1/admin/settings/auto-reply
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(authResult.role || '');
    if (!isAdmin) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
        success: true,
        data: {
            message: cachedAutoReply || process.env.AUTO_REPLY_MESSAGE || '',
            enabled: !!(cachedAutoReply || process.env.AUTO_REPLY_MESSAGE),
        },
    });
}

// POST /api/v1/admin/settings/auto-reply
// Body: { message: string }
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(authResult.role || '');
    if (!isAdmin) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
    }

    try {
        const { message } = await request.json();
        cachedAutoReply = message?.trim() || null;

        // Update env variable in-memory
        if (cachedAutoReply) {
            process.env.AUTO_REPLY_MESSAGE = cachedAutoReply;
        } else {
            delete process.env.AUTO_REPLY_MESSAGE;
        }

        return NextResponse.json({
            success: true,
            message: cachedAutoReply ? 'Đã cập nhật tin nhắn tự động' : 'Đã tắt tin nhắn tự động',
            data: { message: cachedAutoReply, enabled: !!cachedAutoReply },
        });
    } catch (error) {
        console.error('Auto-reply settings error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
