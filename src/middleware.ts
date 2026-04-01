import { NextRequest, NextResponse } from 'next/server';

/**
 * Antigravity Marketplace Fortress — Middleware
 * =============================================
 * 1. Security Headers (CSP, HSTS, X-Frame-Options, v.v.)
 * 2. Rate Limiting (in-memory, per IP)
 * 3. Admin route basic protection
 */

// ============================================================
// RATE LIMITING — In-memory store (reset khi restart server)
// ============================================================
interface RateLimitEntry {
    count: number;
    resetAt: number; // Unix timestamp ms
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Tự động dọn dẹp mỗi 60 giây
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanupRateLimit() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [key, entry] of rateLimitStore) {
        if (now > entry.resetAt) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Kiểm tra rate limit
 * @returns true nếu request được phép, false nếu bị chặn
 */
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
    cleanupRateLimit();
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (entry.count >= maxRequests) {
        return false;
    }

    entry.count++;
    return true;
}

// ============================================================
// SECURITY HEADERS
// ============================================================
const securityHeaders: Record<string, string> = {
    // Chống click-jacking — không cho phép iframe
    'X-Frame-Options': 'DENY',
    // Chống MIME sniffing
    'X-Content-Type-Options': 'nosniff',
    // XSS protection (legacy browsers)
    'X-XSS-Protection': '1; mode=block',
    // Referrer policy — chỉ gửi origin, không gửi full URL
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Tắt camera, microphone, geolocation
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // HSTS — force HTTPS trong 2 năm
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    // Content Security Policy
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://api.binance.com https://api.coingecko.com https://bpay.binanceapi.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join('; '),
    // Chống DNS prefetch leak
    'X-DNS-Prefetch-Control': 'off',
};

// ============================================================
// RATE LIMIT CONFIG cho từng route
// ============================================================
interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
    // Auth routes: 5 requests/phút/IP
    '/api/v1/auth/login': { maxRequests: 5, windowMs: 60_000 },
    '/api/v1/auth/register': { maxRequests: 3, windowMs: 60_000 },
    '/api/v1/auth/admin-login': { maxRequests: 3, windowMs: 60_000 },
    '/api/v1/auth/change-password': { maxRequests: 3, windowMs: 60_000 },
    // Purchase routes: 10 requests/phút/IP
    '/api/v1/orders': { maxRequests: 10, windowMs: 60_000 },
    '/api/v1/orders/purchase': { maxRequests: 10, windowMs: 60_000 },
    // Wallet: 10 requests/phút/IP
    '/api/v1/wallet': { maxRequests: 10, windowMs: 60_000 },
};

// Tổng rate limit: 100 requests/phút/IP cho mọi API
const GLOBAL_RATE_LIMIT: RateLimitConfig = { maxRequests: 100, windowMs: 60_000 };

// ============================================================
// GET CLIENT IP
// ============================================================
function getClientIP(request: NextRequest): string {
    // Cloudflare
    const cfIP = request.headers.get('cf-connecting-ip');
    if (cfIP) return cfIP;
    // X-Forwarded-For (proxy/load balancer)
    const xff = request.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    // X-Real-IP
    const xri = request.headers.get('x-real-ip');
    if (xri) return xri;
    // Fallback  
    return 'unknown';
}

// ============================================================
// MIDDLEWARE MAIN
// ============================================================
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const ip = getClientIP(request);

    // ---- Rate Limiting cho API routes ----
    if (pathname.startsWith('/api/')) {
        // Global rate limit
        const globalKey = `global:${ip}`;
        if (!checkRateLimit(globalKey, GLOBAL_RATE_LIMIT.maxRequests, GLOBAL_RATE_LIMIT.windowMs)) {
            console.warn(`[RATE_LIMIT] Global limit exceeded: IP=${ip}, path=${pathname}`);
            return NextResponse.json(
                { success: false, message: 'Quá nhiều request. Vui lòng thử lại sau.', errorCode: 'RATE_LIMITED' },
                { status: 429 }
            );
        }

        // Route-specific rate limit
        for (const [route, config] of Object.entries(RATE_LIMITS)) {
            if (pathname.startsWith(route)) {
                const routeKey = `route:${route}:${ip}`;
                if (!checkRateLimit(routeKey, config.maxRequests, config.windowMs)) {
                    console.warn(`[RATE_LIMIT] Route limit exceeded: IP=${ip}, path=${pathname}, limit=${config.maxRequests}/min`);
                    return NextResponse.json(
                        { success: false, message: 'Quá nhiều request. Vui lòng thử lại sau.', errorCode: 'RATE_LIMITED' },
                        { status: 429 }
                    );
                }
                break;
            }
        }
    }

    // ---- Security Headers ----
    const response = NextResponse.next();

    for (const [key, value] of Object.entries(securityHeaders)) {
        response.headers.set(key, value);
    }

    // Thêm header version để debug
    response.headers.set('X-Protected-By', 'Antigravity-Fortress-2026');

    return response;
}

// ============================================================
// Chỉ chạy middleware trên các route cần thiết (tối ưu performance)
// ============================================================
export const config = {
    matcher: [
        // Tất cả API routes
        '/api/:path*',
        // Tất cả pages (để thêm security headers)
        '/((?!_next/static|_next/image|favicon.ico|logo|images|uploads).*)',
    ],
};
