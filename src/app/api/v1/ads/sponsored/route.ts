export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/v1/ads/sponsored — Get active sponsored products for the homepage sidebar
// Rotation logic: weighted by bid amount + budget remaining
export async function GET() {
    try {
        const now = new Date();

        const campaigns = await prisma.adCampaign.findMany({
            where: {
                status: 'ACTIVE',
                startDate: { lte: now },
                endDate: { gte: now },
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                        soldCount: true,
                        stockCountCached: true,
                        images: { take: 1, orderBy: { sortOrder: 'asc' } },
                        shop: { select: { name: true, slug: true } },
                        variants: { where: { isActive: true }, take: 3, orderBy: { sortOrder: 'asc' } },
                    },
                },
            },
            orderBy: { bidAmount: 'desc' },
        });

        // Filter out campaigns that have exceeded budget
        const validCampaigns = campaigns.filter(c => c.spentAmount < c.totalBudget);

        // Weighted rotation: higher bid = more chances
        // For simplicity, we shuffle with weighted probability
        const weighted: any[] = [];
        for (const c of validCampaigns) {
            // Weight factor: bid amount / 100 (min 1)
            const weight = Math.max(1, Math.ceil(c.bidAmount / 100));
            for (let i = 0; i < weight; i++) {
                weighted.push(c);
            }
        }

        // Shuffle and pick unique products (max 5)
        const shuffled = weighted.sort(() => Math.random() - 0.5);
        const seen = new Set<string>();
        const result: any[] = [];
        for (const c of shuffled) {
            if (!seen.has(c.productId) && result.length < 5) {
                seen.add(c.productId);
                result.push({
                    campaignId: c.id,
                    bidAmount: c.bidAmount,
                    product: c.product,
                });
            }
        }

        // Record impressions for each shown campaign
        for (const r of result) {
            try {
                await prisma.adCampaign.update({
                    where: { id: r.campaignId },
                    data: {
                        impressions: { increment: 1 },
                        spentAmount: { increment: r.bidAmount },
                    },
                });
                await prisma.adImpression.create({
                    data: {
                        campaignId: r.campaignId,
                        type: 'impression',
                        cost: r.bidAmount,
                    },
                });
            } catch { /* ignore impression tracking errors */ }
        }

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error('Sponsored ads error:', error);
        return NextResponse.json({ success: true, data: [] }); // Fail silently, don't break the homepage
    }
}
