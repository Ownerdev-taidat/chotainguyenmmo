import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET /api/v1/notifications — Get user's notifications
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '20'), 50);
        const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true';

        const where: any = { userId: user.userId };
        if (unreadOnly) where.isRead = false;

        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
            }),
            prisma.notification.count({
                where: { userId: user.userId, isRead: false },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: { notifications, unreadCount },
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal error' },
            { status: 500 }
        );
    }
}

// PATCH /api/v1/notifications — Mark notifications as read
export async function PATCH(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { ids, markAll } = body;

        if (markAll) {
            await prisma.notification.updateMany({
                where: { userId: user.userId, isRead: false },
                data: { isRead: true },
            });
        } else if (ids && Array.isArray(ids)) {
            await prisma.notification.updateMany({
                where: { id: { in: ids }, userId: user.userId },
                data: { isRead: true },
            });
        }

        const unreadCount = await prisma.notification.count({
            where: { userId: user.userId, isRead: false },
        });

        return NextResponse.json({ success: true, data: { unreadCount } });
    } catch (error) {
        console.error('Mark notifications error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal error' },
            { status: 500 }
        );
    }
}
