/**
 * USDT/VND Exchange Rate Service
 * ================================
 * Fetches real-time USDT/VND rate from CoinGecko (free API, no key needed).
 * Caches rate for 5 minutes to avoid excessive API calls.
 * Falls back to hardcoded rate if API fails.
 * 
 * Note: USDT is pegged to USD, so USDT/VND ≈ USD/VND.
 * CoinGecko gives the actual USDT/VND market rate.
 */

// Cache config
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const FALLBACK_RATE = parseInt(process.env.USDT_VND_RATE || '25000');

interface RateCache {
    rate: number;
    timestamp: number;
    source: string;
}

let cachedRate: RateCache | null = null;

/**
 * Get current USDT/VND rate.
 * 1. Check cache (5 min)
 * 2. Try CoinGecko API
 * 3. Try ExchangeRate API (USD/VND as backup)
 * 4. Fallback to env/hardcoded
 */
export async function getUsdtVndRate(): Promise<{ rate: number; source: string; cached: boolean }> {
    // Check cache
    if (cachedRate && (Date.now() - cachedRate.timestamp) < CACHE_DURATION_MS) {
        return { rate: cachedRate.rate, source: cachedRate.source, cached: true };
    }

    // Try CoinGecko (USDT → VND directly)
    try {
        const rate = await fetchCoinGeckoRate();
        if (rate > 0) {
            cachedRate = { rate, timestamp: Date.now(), source: 'coingecko' };
            console.log(`[ExchangeRate] CoinGecko USDT/VND: ${rate.toLocaleString()}`);
            return { rate, source: 'coingecko', cached: false };
        }
    } catch (err) {
        console.warn('[ExchangeRate] CoinGecko failed:', (err as Error).message);
    }

    // Try ExchangeRate API (USD → VND, free tier)
    try {
        const rate = await fetchExchangeRateApi();
        if (rate > 0) {
            cachedRate = { rate, timestamp: Date.now(), source: 'exchangerate-api' };
            console.log(`[ExchangeRate] ExchangeRate-API USD/VND: ${rate.toLocaleString()}`);
            return { rate, source: 'exchangerate-api', cached: false };
        }
    } catch (err) {
        console.warn('[ExchangeRate] ExchangeRate-API failed:', (err as Error).message);
    }

    // Fallback
    console.warn(`[ExchangeRate] All APIs failed, using fallback: ${FALLBACK_RATE}`);
    return { rate: FALLBACK_RATE, source: 'fallback', cached: false };
}

/**
 * CoinGecko Free API — USDT/VND
 * No API key needed. Rate limit: ~10-30 calls/min.
 * Returns USDT price in VND directly.
 */
async function fetchCoinGeckoRate(): Promise<number> {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: any = await res.json();
        // Response: { "tether": { "vnd": 26300 } }
        const rate = data?.tether?.vnd;

        if (typeof rate === 'number' && rate > 20000 && rate < 35000) {
            return Math.round(rate);
        }

        throw new Error(`Invalid rate: ${rate}`);
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * ExchangeRate-API — USD/VND (backup)
 * Free tier: 1500 requests/month, no API key.
 * USDT ≈ USD, so this is a close approximation.
 */
async function fetchExchangeRateApi(): Promise<number> {
    const url = 'https://open.er-api.com/v6/latest/USD';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: any = await res.json();
        // Response: { "rates": { "VND": 26300 } }
        const rate = data?.rates?.VND;

        if (typeof rate === 'number' && rate > 20000 && rate < 35000) {
            return Math.round(rate);
        }

        throw new Error(`Invalid rate: ${rate}`);
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Force refresh the cached rate.
 */
export async function refreshRate(): Promise<number> {
    cachedRate = null; // Clear cache
    const result = await getUsdtVndRate();
    return result.rate;
}

/**
 * Get the cached rate (for use in client-side/SSR without async).
 * Returns cached value or fallback.
 */
export function getCachedRate(): number {
    return cachedRate?.rate || FALLBACK_RATE;
}
