export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, generateDepositToken } from '@/lib/auth';
import { generateQRUrl } from '@/lib/mbbank';

// GET /api/v1/wallet — Get wallet balance & recent transactions
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const wallet = await prisma.wallet.findUnique({
            where: { userId: authResult.userId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });

        if (!wallet) {
            return NextResponse.json(
                { success: false, message: 'Ví không tồn tại', errorCode: 'NOT_FOUND' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                availableBalance: wallet.availableBalance,
                heldBalance: wallet.heldBalance,
                totalDeposited: wallet.totalDeposited,
                totalSpent: wallet.totalSpent,
                totalRefunded: wallet.totalRefunded,
                totalWithdrawn: wallet.totalWithdrawn,
                transactions: wallet.transactions,
            },
        });
    } catch (error) {
        console.error('Get wallet error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
