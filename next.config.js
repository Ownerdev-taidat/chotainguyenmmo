/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: ['localhost'],
        unoptimized: true,
    },
    // Ẩn header "X-Powered-By: Next.js" — không lộ framework
    poweredByHeader: false,
    // Security headers (backup cho middleware.ts)
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'X-DNS-Prefetch-Control', value: 'off' },
                ],
            },
        ];
    },
};

module.exports = nextConfig;

