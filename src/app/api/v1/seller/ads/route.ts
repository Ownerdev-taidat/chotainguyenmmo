export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET /api/v1/seller/ads — List seller's ad campaigns
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) return NextResponse.json({ success: false, message: 'Chưa đăng nhập' }, { status: 401 });

        const shop = await prisma.shop.findUnique({ where: { ownerId: user.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Bạn chưa có gian hàng' }, { status: 403 });

        const campaigns = await prisma.adCampaign.findMany({
            where: { sellerId: user.userId },
            orderBy: { createdAt: 'desc' },
            include: {
                product: {
                    select: { id: true, name: true, slug: true, images: { take: 1 } },
                },
            },
        });

        return NextResponse.json({ success: true, data: campaigns });
    } catch (error) {
        console.error('List ads error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// POST /api/v1/seller/ads — Create a new ad campaign
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) return NextResponse.json({ success: false, message: 'Chưa đăng nhập' }, { status: 401 });

        const shop = await prisma.shop.findUnique({ where: { ownerId: user.userId } });
        if (!shop) return NextResponse.json({ success: false, message: 'Bạn chưa có gian hàng' }, { status: 403 });

        const { productId, title, bidAmount, totalBudget, dailyBudget, startDate, endDate } = await request.json();

        if (!productId || !title || !bidAmount || !totalBudget || !dailyBudget || !startDate || !endDate) {
            return NextResponse.json({ success: false, message: 'Thiếu thông tin bắt buộc' }, { status: 400 });
        }

        // Validate product belongs to this seller
        const product = await prisma.product.findFirst({
            where: { id: productId, shopId: shop.id, status: 'ACTIVE' },
        });
        if (!product) return NextResponse.json({ success: false, message: 'Sản phẩm không hợp lệ' }, { status: 400 });

        // Validate budget
        if (bidAmount < 100) return NextResponse.json({ success: false, message: 'Giá bid tối thiểu 100đ' }, { status: 400 });
        if (totalBudget < 10000) return NextResponse.json({ success: false, message: 'Ngân sách tối thiểu 10.000đ' }, { status: 400 });
        if (dailyBudget < 5000) return NextResponse.json({ success: false, message: 'Ngân sách ngày tối thiểu 5.000đ' }, { status: 400 });

        // Check seller wallet balance
        const wallet = await prisma.wallet.findUnique({ where: { userId: user.userId } });
        if (!wallet || wallet.availableBalance < totalBudget) {
            return NextResponse.json({ success: false, message: `Số dư không đủ. Cần ${totalBudget.toLocaleString()}đ, hiện có ${(wallet?.availableBalance || 0).toLocaleString()}đ` }, { status: 400 });
        }

        // Deduct from wallet
        await prisma.wallet.update({
            where: { userId: user.userId },
            data: { availableBalance: { decrement: totalBudget }, heldBalance: { increment: totalBudget } },
        });

        // Create wallet transaction
        await prisma.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'FEE',
                direction: 'DEBIT',
                amount: totalBudget,
                balanceAfter: wallet.availableBalance - totalBudget,
                description: `Đặt quảng cáo: ${title}`,
                referenceType: 'ad_campaign',
            },
        });

        const campaign = await prisma.adCampaign.create({
            data: {
                sellerId: user.userId,
                productId,
                title,
                bidAmount,
                totalBudget,
                dailyBudget,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                status: 'PENDING_REVIEW',
            },
        });

        return NextResponse.json({ success: true, data: campaign, message: 'Đã tạo chiến dịch quảng cáo — đang chờ admin duyệt' });
    } catch (error) {
        console.error('Create ad error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// PUT /api/v1/seller/ads — Pause/resume campaign
export async function PUT(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) return NextResponse.json({ success: false, message: 'Chưa đăng nhập' }, { status: 401 });

        const { campaignId, action } = await request.json();
        const campaign = await prisma.adCampaign.findFirst({ where: { id: campaignId, sellerId: user.userId } });
        if (!campaign) return NextResponse.json({ success: false, message: 'Chiến dịch không tồn tại' }, { status: 404 });

        if (action === 'pause' && campaign.status === 'ACTIVE') {
            await prisma.adCampaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
            return NextResponse.json({ success: true, message: 'Đã tạm dừng chiến dịch' });
        }
        if (action === 'resume' && campaign.status === 'PAUSED') {
            await prisma.adCampaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } });
            return NextResponse.json({ success: true, message: 'Đã tiếp tục chiến dịch' });
        }

        return NextResponse.json({ success: false, message: 'Hành động không hợp lệ' }, { status: 400 });
    } catch (error) {
        console.error('Update ad error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
