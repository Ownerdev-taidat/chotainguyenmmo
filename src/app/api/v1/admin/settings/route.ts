export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getPlatformSettingsAsync, updatePlatformSettings } from '@/lib/mock-order-store';
import prisma from '@/lib/prisma';

// GET /api/v1/admin/settings — Get platform settings & stats
export async function GET() {
    try {
        const settings = await getPlatformSettingsAsync();

        // Compute stats from Prisma DB
        let totalOrders = 0, totalRevenue = 0, totalPlatformFees = 0, totalSellerEarnings = 0;
        try {
            totalOrders = await prisma.order.count();
            const orderSum = await prisma.order.aggregate({
                where: { status: { in: ['COMPLETED', 'PAID', 'PROCESSING'] } },
                _sum: { totalAmount: true, feeAmount: true },
            });
            totalRevenue = orderSum._sum?.totalAmount || 0;
            totalPlatformFees = orderSum._sum?.feeAmount || 0;
            totalSellerEarnings = totalRevenue - totalPlatformFees;
        } catch {}

        return NextResponse.json({
            success: true,
            data: {
                settings,
                stats: {
                    totalOrders,
                    totalRevenue,
                    totalPlatformFees,
                    totalSellerEarnings,
                    commissionRate: settings.commissionRate,
                },
            },
        });
    } catch (error) {
        console.error('Get admin settings error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// PUT /api/v1/admin/settings — Update platform settings
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate commission rate
        if (body.commissionRate !== undefined) {
            const rate = Number(body.commissionRate);
            if (isNaN(rate) || rate < 0 || rate > 50) {
                return NextResponse.json({ success: false, message: 'Phí sàn phải từ 0% đến 50%' }, { status: 400 });
            }
            body.commissionRate = rate;
        }

        const updated = await updatePlatformSettings(body);

        return NextResponse.json({
            success: true,
            message: 'Đã cập nhật cài đặt thành công',
            data: updated,
        });
    } catch (error) {
        console.error('Update admin settings error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
