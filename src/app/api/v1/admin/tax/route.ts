export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { updatePlatformSettings } from '@/lib/mock-order-store';
import prisma from '@/lib/prisma';

interface TaxBracket {
    minRevenue: number;
    rate: number;
    label: string;
}

interface TaxSettings {
    enabled: boolean;
    taxRate: number;
    taxBrackets: TaxBracket[];
    paymentDay: number;
    lastCollectionDate: string | null;
}

interface TaxRecord {
    id: string;
    sellerId: string;
    sellerName: string;
    shopName: string;
    period: string;
    revenue: number;
    taxRate: number;
    taxAmount: number;
    balanceBefore: number;
    balanceAfter: number;
    status: 'collected' | 'negative';
    createdAt: string;
}

const DEFAULT_TAX_SETTINGS: TaxSettings = {
    enabled: false,
    taxRate: 1,
    taxBrackets: [
        { minRevenue: 0, rate: 0, label: 'Dưới 100 triệu' },
        { minRevenue: 100000000, rate: 5, label: '100 triệu - 500 triệu' },
        { minRevenue: 500000000, rate: 10, label: '500 triệu - 1 tỷ' },
        { minRevenue: 1000000000, rate: 15, label: 'Trên 1 tỷ' },
    ],
    paymentDay: 25,
    lastCollectionDate: null,
};

async function loadTaxSettings(): Promise<TaxSettings> {
    try {
        const record = await prisma.setting.findUnique({ where: { key: 'tax_settings' } });
        if (record) return { ...DEFAULT_TAX_SETTINGS, ...JSON.parse(record.value) };
    } catch {}
    return { ...DEFAULT_TAX_SETTINGS };
}

async function saveTaxSettings(s: TaxSettings) {
    try {
        await prisma.setting.upsert({
            where: { key: 'tax_settings' },
            update: { value: JSON.stringify(s) },
            create: { key: 'tax_settings', value: JSON.stringify(s), type: 'json', group: 'tax' },
        });
    } catch (e) { console.error('saveTaxSettings error:', e); }
}

async function loadTaxHistory(): Promise<TaxRecord[]> {
    try {
        const record = await prisma.setting.findUnique({ where: { key: 'tax_history' } });
        if (record) return JSON.parse(record.value);
    } catch {}
    return [];
}

async function saveTaxHistory(h: TaxRecord[]) {
    try {
        await prisma.setting.upsert({
            where: { key: 'tax_history' },
            update: { value: JSON.stringify(h) },
            create: { key: 'tax_history', value: JSON.stringify(h), type: 'json', group: 'tax' },
        });
    } catch (e) { console.error('saveTaxHistory error:', e); }
}

// GET — get tax settings + history
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'history') {
        const sellerId = searchParams.get('sellerId');
        const history = await loadTaxHistory();
        if (sellerId) {
            return NextResponse.json({ success: true, data: history.filter(h => h.sellerId === sellerId) });
        }
        return NextResponse.json({ success: true, data: history });
    }

    const settings = await loadTaxSettings();
    return NextResponse.json({ success: true, data: settings });
}

// PUT — update tax settings (admin only)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const current = await loadTaxSettings();

        if (typeof body.enabled === 'boolean') current.enabled = body.enabled;
        if (typeof body.taxRate === 'number' && body.taxRate >= 0 && body.taxRate <= 30) current.taxRate = body.taxRate;
        if (typeof body.paymentDay === 'number' && body.paymentDay >= 1 && body.paymentDay <= 28) current.paymentDay = body.paymentDay;
        if (Array.isArray(body.taxBrackets)) {
            current.taxBrackets = body.taxBrackets.filter((b: any) =>
                typeof b.minRevenue === 'number' && typeof b.rate === 'number' && b.rate >= 0 && b.rate <= 50
            ).map((b: any) => ({
                minRevenue: b.minRevenue,
                rate: b.rate,
                label: b.label || '',
            }));
        }

        await saveTaxSettings(current);

        // Sync to platform settings so invoice APIs can read the tax state
        await updatePlatformSettings({
            taxEnabled: current.enabled,
            vatRate: current.taxRate || 10,
        });

        return NextResponse.json({ success: true, data: current, message: 'Đã cập nhật cài đặt thuế' });
    } catch {
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

// POST — collect tax from all sellers (admin trigger)
export async function POST(request: NextRequest) {
    try {
        const settings = await loadTaxSettings();
        if (!settings.enabled) {
            return NextResponse.json({ success: false, message: 'Thu thuế đang tắt' }, { status: 400 });
        }

        // Get all active shops with owners
        const shops = await prisma.shop.findMany({
            where: { status: 'ACTIVE' },
            include: {
                owner: { select: { id: true, username: true, fullName: true, wallet: true } },
            },
        });

        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const history = await loadTaxHistory();
        const results: TaxRecord[] = [];

        for (const shop of shops) {
            if (!shop.owner || !shop.owner.wallet) continue;

            // Check if already collected this period
            const alreadyCollected = history.find(h => h.sellerId === shop.ownerId && h.period === period);
            if (alreadyCollected) continue;

            // Calculate revenue for this period
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const orders = await prisma.order.findMany({
                where: {
                    shopId: shop.id,
                    status: { in: ['COMPLETED', 'DELIVERED', 'PAID'] },
                    createdAt: { gte: monthStart },
                },
            });

            const revenue = orders.reduce((sum, o) => sum + (o.totalAmount - (o.feeAmount || 0)), 0);
            if (revenue <= 0) continue;

            // Find applicable tax bracket based on revenue
            let applicableRate = settings.taxRate;
            if (settings.taxBrackets && settings.taxBrackets.length > 0) {
                const sorted = [...settings.taxBrackets].sort((a, b) => b.minRevenue - a.minRevenue);
                for (const bracket of sorted) {
                    if (revenue >= bracket.minRevenue) {
                        applicableRate = bracket.rate;
                        break;
                    }
                }
            }

            const taxAmount = Math.floor(revenue * applicableRate / 100);
            if (taxAmount <= 0) continue;

            const wallet = shop.owner.wallet;
            const balanceBefore = wallet.availableBalance;
            const balanceAfter = balanceBefore - taxAmount;

            // Deduct from seller wallet
            await prisma.wallet.update({
                where: { id: wallet.id },
                data: { availableBalance: balanceAfter },
            });

            // Create transaction record
            await prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'ADJUSTMENT',
                    direction: 'DEBIT',
                    amount: taxAmount,
                    balanceAfter,
                    referenceType: 'tax',
                    referenceId: `TAX-${period}-${shop.id.slice(-6)}`,
                    description: `Thuế ${applicableRate}% tháng ${period} — DT: ${revenue.toLocaleString('vi-VN')}đ`,
                },
            });

            const record: TaxRecord = {
                id: `tax_${Date.now()}_${shop.id.slice(-4)}`,
                sellerId: shop.ownerId,
                sellerName: shop.owner.fullName || shop.owner.username,
                shopName: shop.name,
                period,
                revenue,
                taxRate: applicableRate,
                taxAmount,
                balanceBefore,
                balanceAfter,
                status: balanceAfter < 0 ? 'negative' : 'collected',
                createdAt: now.toISOString(),
            };
            results.push(record);
            history.push(record);
        }

        await saveTaxHistory(history);
        settings.lastCollectionDate = now.toISOString();
        await saveTaxSettings(settings);

        return NextResponse.json({
            success: true,
            message: `Đã thu thuế ${results.length} seller`,
            data: results,
        });
    } catch (error) {
        console.error('Tax collection error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi thu thuế' }, { status: 500 });
    }
}
