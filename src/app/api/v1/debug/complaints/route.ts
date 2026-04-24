export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/v1/debug/complaints — Debug complaint data (temp endpoint)
export async function GET() {
    try {
        const disputed = await prisma.order.findMany({
            where: { status: 'DISPUTED' },
            select: {
                id: true,
                orderCode: true,
                shopId: true,
                buyerId: true,
                totalAmount: true,
                notes: true,
                shop: { select: { id: true, name: true, ownerId: true } },
                buyer: { select: { fullName: true, username: true } },
            },
        });

        const shops = await prisma.shop.findMany({
            select: { id: true, name: true, ownerId: true, status: true },
        });

        const users = await prisma.user.findMany({
            select: { id: true, username: true, fullName: true, role: true },
        });

        return NextResponse.json({
            disputedOrders: disputed,
            allShops: shops,
            allUsers: users.map(u => ({ id: u.id, username: u.username, role: u.role })),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
