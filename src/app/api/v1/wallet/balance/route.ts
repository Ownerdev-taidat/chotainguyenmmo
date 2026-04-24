export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/v1/wallet/balance — Get current wallet balance from DB
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) return NextResponse.json({ success: false, message: 'Chưa đăng nhập' }, { status: 401 });

        const wallet = await prisma.wallet.findUnique({
            where: { userId: user.userId },
            select: { availableBalance: true, heldBalance: true },
        });

        return NextResponse.json({
            success: true,
            data: {
                availableBalance: wallet?.availableBalance || 0,
                heldBalance: wallet?.heldBalance || 0,
            },
        });
    } catch (error) {
        console.error('Wallet balance error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
