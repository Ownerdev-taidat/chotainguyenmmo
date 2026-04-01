/**
 * secureFetch — Antigravity Secure Fetch 2026
 * =============================================
 * ✅ Dùng httpOnly cookie auth (credentials: 'include')
 * ✅ KHÔNG đọc token từ localStorage  
 * ✅ Silent 401 errors (không log ra console)
 * ✅ Auto Content-Type cho JSON body
 * ✅ Decoy headers confuse Network tab
 * 
 * CÁCH DÙNG: import { secureFetch } from '@/lib/secure-fetch';
 *            const res = await secureFetch('/api/v1/notifications');
 */

type SecureFetchOptions = RequestInit & {
    /** Bỏ qua silent 401 (để tự handle) */  
    throw401?: boolean;
};

export async function secureFetch(
    url: string,
    options: SecureFetchOptions = {}
): Promise<Response> {
    const { throw401, ...init } = options;

    const headers = new Headers(init.headers);

    // Content-Type default cho JSON body
    if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    // Decoy header — confuse Network tab
    headers.set('X-App-V', '3.' + Math.floor(Math.random() * 90 + 10));

    // credentials: 'include' → browser tự gửi httpOnly cookie
    // KHÔNG cần đọc localStorage.getItem('token') nữa!
    const res = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
    });

    return res;
}

/**
 * secureFetchJSON — secureFetch + auto parse JSON
 * Trả null nếu !ok hoặc lỗi (thay vì throw)
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
