export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUsdtVndRate } from '@/lib/exchange-rate';

/**
 * GET /api/v1/exchange-rate — Get real-time USDT/VND rate
 * 
 * Response: { success: true, data: { rate: 26312, source: "coingecko", cached: true } }
 * 
 * Source:
 * - "coingecko" = CoinGecko API (primary, free, USDT/VND direct)
 * - "exchangerate-api" = ExchangeRate-API (backup, USD/VND)
 * - "fallback" = Hardcoded value from env
 */
export async function GET(request: NextRequest) {
    try {
        const result = await getUsdtVndRate();

        return NextResponse.json({
            success: true,
            data: {
                rate: result.rate,
                source: result.source,
                cached: result.cached,
                formattedRate: `1 USDT ≈ ${result.rate.toLocaleString('vi-VN')}đ`,
            },
        }, {
            headers: {
                'Cache-Control': 'public, max-age=60', // Browser cache 1 min
            },
        });
    } catch (error: any) {
        console.error('[ExchangeRate] API error:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch rate' },
            { status: 500 }
        );
    }
}
