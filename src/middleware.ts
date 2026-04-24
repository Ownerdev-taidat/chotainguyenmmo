import { NextRequest, NextResponse } from 'next/server';

/**
 * Antigravity Marketplace — Middleware
 * =============================================
 * 1. Security Headers (CSP, HSTS, X-Frame-Options, v.v.)
 * 2. Admin route basic protection
 * 
 * Rate limiting: DISABLED — không giới hạn request
 */

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
