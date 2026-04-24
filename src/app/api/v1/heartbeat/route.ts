export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/v1/heartbeat — Update user's lastSeenAt timestamp
 * Called periodically by the frontend (every 2 minutes)
 */
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        await prisma.user.update({
            where: { id: authResult.userId },
            data: { lastSeenAt: new Date() },
        });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false }, { status: 500 });
    }
}

/**
 * GET /api/v1/heartbeat?userIds=id1,id2,id3 — Get online status of specific users
 * Returns lastSeenAt for each user
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userIds = searchParams.get('userIds');
    const userId = searchParams.get('userId');

    try {
        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { lastSeenAt: true },
            });
            return NextResponse.json({
                success: true,
                data: { [userId]: user?.lastSeenAt?.toISOString() || null },
            });
        }

        if (userIds) {
            const ids = userIds.split(',').slice(0, 50); // max 50
            const users = await prisma.user.findMany({
                where: { id: { in: ids } },
                select: { id: true, lastSeenAt: true },
            });
            const statusMap: Record<string, string | null> = {};
            users.forEach(u => {
                statusMap[u.id] = u.lastSeenAt?.toISOString() || null;
            });
            return NextResponse.json({ success: true, data: statusMap });
        }

        return NextResponse.json({ success: false, message: 'Missing userId or userIds' }, { status: 400 });
    } catch {
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
