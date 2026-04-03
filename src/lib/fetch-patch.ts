/**
 * Antigravity Auth Compatibility Layer 2026
 * ==========================================
 * Patch global fetch() để:
 * 1. Tự động gửi credentials: 'include' cho /api/* (httpOnly cookie)
 * 2. Xóa Authorization header rỗng/invalid (Bearer '') → fallback sang cookie
 * 3. Auto Content-Type cho JSON body
 * 
 * → 30+ file cũ dùng fetch('/api/v1/...') sẽ tự động dùng httpOnly cookie
 * → KHÔNG CẦN sửa từng file
 * 
 * Import 1 lần trong providers.tsx
 */

if (typeof window !== 'undefined') {
    const _origFetch = window.fetch.bind(window);

    window.fetch = function patchedFetch(
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

        // Chỉ patch cho internal API calls
        if (url.startsWith('/api/')) {
            init = init || {};

            // Tự động gửi httpOnly cookie
            if (!init.credentials) {
                init.credentials = 'include';
            }

            // ⚡ FIX: Xóa Authorization header rỗng/invalid
            // Nhiều file admin cũ gửi `Authorization: Bearer ` (token rỗng từ localStorage)
            // → Server nhận header rỗng → không fallback sang cookie → 401
            // Fix: xóa header rỗng → server tự đọc cookie
            const headers = new Headers(init.headers);
            const authHeader = headers.get('Authorization');
            if (authHeader) {
                const tokenValue = authHeader.replace(/^Bearer\s*/i, '').trim();
                if (!tokenValue) {
                    // Token rỗng → xóa header → server dùng cookie thay
                    headers.delete('Authorization');
                    init.headers = headers;
                }
            }

            // Auto Content-Type cho JSON body
            if (init.body && typeof init.body === 'string') {
                const h = new Headers(init.headers);
                if (!h.has('Content-Type')) {
                    h.set('Content-Type', 'application/json');
                    init.headers = h;
                }
            }
        }

        return _origFetch(input, init);
    };
}

export {};
