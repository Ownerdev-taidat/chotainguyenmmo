export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

// GET /api/v1/admin/ads — List all ad campaigns
export async function GET(request: NextRequest) {
    try {
        const user = await requireRole(request, ['ADMIN', 'SUPER_ADMIN']);

        const campaigns = await prisma.adCampaign.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                product: { select: { id: true, name: true, slug: true, images: { take: 1 } } },
            },
        });

        return NextResponse.json({ success: true, data: campaigns });
    } catch (error: any) {
        if (error?.status) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
        console.error('Admin list ads error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// PUT /api/v1/admin/ads — Approve/reject/pause campaigns
export async function PUT(request: NextRequest) {
    try {
        const user = await requireRole(request, ['ADMIN', 'SUPER_ADMIN']);
        const { campaignId, action, reason } = await request.json();

        const campaign = await prisma.adCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) return NextResponse.json({ success: false, message: 'Chiến dịch không tồn tại' }, { status: 404 });

        if (action === 'approve') {
            await prisma.adCampaign.update({
                where: { id: campaignId },
                data: { status: 'ACTIVE' },
            });
            return NextResponse.json({ success: true, message: 'Đã duyệt chiến dịch quảng cáo' });
        }

        if (action === 'reject') {
            // Refund the seller
            const wallet = await prisma.wallet.findUnique({ where: { userId: campaign.sellerId } });
            if (wallet) {
                await prisma.wallet.update({
                    where: { userId: campaign.sellerId },
                    data: {
                        availableBalance: { increment: campaign.totalBudget - campaign.spentAmount },
                        heldBalance: { decrement: campaign.totalBudget - campaign.spentAmount },
                    },
                });
                await prisma.walletTransaction.create({
                    data: {
                        walletId: wallet.id,
                        type: 'REFUND',
                        direction: 'CREDIT',
                        amount: campaign.totalBudget - campaign.spentAmount,
                        balanceAfter: wallet.availableBalance + (campaign.totalBudget - campaign.spentAmount),
                        description: `Hoàn tiền quảng cáo bị từ chối: ${campaign.title}`,
                        referenceType: 'ad_campaign',
                        referenceId: campaign.id,
                    },
                });
            }
            await prisma.adCampaign.update({
                where: { id: campaignId },
                data: { status: 'REJECTED', rejectedReason: reason || 'Không phù hợp chính sách' },
            });
            return NextResponse.json({ success: true, message: 'Đã từ chối và hoàn tiền' });
        }

        if (action === 'pause') {
            await prisma.adCampaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
            return NextResponse.json({ success: true, message: 'Đã tạm dừng chiến dịch' });
        }

        return NextResponse.json({ success: false, message: 'Hành động không hợp lệ' }, { status: 400 });
    } catch (error: any) {
        if (error?.status) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
        console.error('Admin ads action error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
