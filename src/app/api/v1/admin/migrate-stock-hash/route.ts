export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createHash } from 'crypto';

/**
 * POST /api/v1/admin/migrate-stock-hash
 * One-time migration: backfill contentHash for all existing stock items.
 * Admin-only. Safe to run multiple times (idempotent).
 */
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes((authResult as any).role || '')) {
        return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
    }

    try {
        // Find all stock items without contentHash
        const itemsWithoutHash = await prisma.stockItem.findMany({
            where: { contentHash: null },
            select: { id: true, rawContent: true },
        });

        if (itemsWithoutHash.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Tất cả stock items đã có contentHash. Không cần migrate.',
                data: { updated: 0 },
            });
        }

        // Batch update in chunks of 100
        let updated = 0;
        const CHUNK_SIZE = 100;

        for (let i = 0; i < itemsWithoutHash.length; i += CHUNK_SIZE) {
            const chunk = itemsWithoutHash.slice(i, i + CHUNK_SIZE);
            await prisma.$transaction(
                chunk.map(item => {
                    const normalized = item.rawContent.trim().toLowerCase();
                    const hash = createHash('sha256').update(normalized).digest('hex');
                    return prisma.stockItem.update({
                        where: { id: item.id },
                        data: { contentHash: hash },
                    });
                })
            );
            updated += chunk.length;
        }

        // Count duplicates after migration
        const duplicates = await prisma.$queryRawUnsafe<{ hash: string; cnt: bigint }[]>(
            `SELECT "contentHash" as hash, COUNT(*) as cnt FROM "StockItem" WHERE "contentHash" IS NOT NULL GROUP BY "contentHash" HAVING COUNT(*) > 1 LIMIT 20`
        );

        return NextResponse.json({
            success: true,
            message: `Đã cập nhật contentHash cho ${updated} stock items.${duplicates.length > 0 ? ` Phát hiện ${duplicates.length} nhóm hàng trùng lặp.` : ' Không có hàng trùng.'}`,
            data: {
                updated,
                totalWithoutHash: itemsWithoutHash.length,
                duplicateGroups: duplicates.length,
            },
        });
    } catch (error) {
        console.error('[Migrate Stock Hash] Error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi migration' }, { status: 500 });
    }
}
