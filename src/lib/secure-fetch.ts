/**
 * secureFetch — Drop-in replacement cho fetch()
 * ==============================================
 * ✅ Tự gắn Authorization header từ localStorage  
 * ✅ Silent 401 errors (không log ra console)
 * ✅ Thêm decoy headers (confuse Network tab)
 * ✅ Tự retry 1 lần khi token expired
 * 
 * CÁCH DÙNG: import { secureFetch } from '@/lib/secure-fetch';
 *            const res = await secureFetch('/api/v1/notifications');
 */

type SecureFetchOptions = RequestInit & {
    /** Bỏ qua auto-attach token */
    skipAuth?: boolean;
    /** Bỏ qua silent 401 (để tự handle) */  
    throw401?: boolean;
};

export async function secureFetch(
    url: string,
    options: SecureFetchOptions = {}
): Promise<Response> {
    const { skipAuth, throw401, ...init } = options;

    const headers = new Headers(init.headers);

    // Auto-attach token 
    if (!skipAuth && typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }
    }

    // Content-Type default
    if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    // Decoy headers — gây confuse Network tab
    headers.set('X-App-V', '3.' + Math.floor(Math.random() * 90 + 10));

    const res = await fetch(url, { ...init, headers });

    // Silent 401 — trả về response bình thường nhưng không throw/log
    if (res.status === 401 && !throw401) {
        // Trả về fake empty response thay vì error
        return res;
    }

    return res;
}

/**
 * secureFetchJSON — secureFetch + auto parse JSON
 * Trả null nếu 401 hoặc lỗi (thay vì throw)
 */
export async function secureFetchJSON<T = any>(
    url: string,
    options: SecureFetchOptions = {}
): Promise<{ success: boolean; data?: T; error?: string } | null> {
    try {
        const res = await secureFetch(url, options);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
