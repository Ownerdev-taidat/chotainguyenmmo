export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const token = request.cookies.get('token')?.value ||
            request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
            return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập' }, { status: 401 });
        }

        const payload = await verifyToken(token);
        if (!payload || !payload.userId) {
            return NextResponse.json({ success: false, message: 'Phiên đăng nhập hết hạn' }, { status: 401 });
        }

        const userId = payload.userId as string;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'orders' | 'transactions' | 'balance'

        if (type === 'transactions') {
            const wallet = await prisma.wallet.findUnique({ where: { userId } });
            if (!wallet) return NextResponse.json({ success: true, data: [] });
            const txns = await prisma.walletTransaction.findMany({
                where: { walletId: wallet.id },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });
            return NextResponse.json({ success: true, data: txns });
        }

        if (type === 'balance') {
            const wallet = await prisma.wallet.findUnique({ where: { userId } });
            return NextResponse.json({ success: true, data: { balance: wallet?.availableBalance || 0 } });
        }

        // Default: return orders
        const orders = await prisma.order.findMany({
            where: { buyerId: userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                items: { include: { product: { select: { name: true, slug: true } } } },
                shop: { select: { name: true, slug: true } },
            },
        });
        return NextResponse.json({ success: true, data: orders });
    } catch (error) {
        console.error('User data error:', error);
        return NextResponse.json({ success: false, message: 'Có lỗi xảy ra' }, { status: 500 });
    }
}
