/**
 * Antigravity Auth Compatibility Layer 2026
 * ==========================================
 * Patch global fetch() để tự động gửi credentials: 'include'
 * cho tất cả request tới /api/v1/* 
 * 
 * → 30+ file cũ dùng fetch('/api/v1/...') sẽ tự động gửi httpOnly cookie
 * → KHÔNG CẦN sửa từng file
 * 
 * Import 1 lần trong providers.tsx hoặc layout.tsx
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

            // Auto Content-Type cho JSON body
            if (init.body && typeof init.body === 'string') {
                const headers = new Headers(init.headers);
                if (!headers.has('Content-Type')) {
                    headers.set('Content-Type', 'application/json');
                }
                init.headers = headers;
            }
        }

        return _origFetch(input, init);
    };
}

export {};
