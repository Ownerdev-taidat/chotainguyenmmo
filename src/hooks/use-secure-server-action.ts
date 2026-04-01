'use client';

/**
 * useSecureServerAction — Hook wrap API calls với HMAC signature
 * ==============================================================
 * Thay thế fetch() trực tiếp, thêm signature + nonce + timestamp
 * 
 * CÁCH DÙNG:
 *   const { secureFetch, isDevToolsBlocked } = useSecureServerAction();
 *   const res = await secureFetch('/api/v1/orders', { method: 'POST', body: JSON.stringify({...}) });
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    generateRequestSignature,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    NONCE_HEADER,
    REQUEST_ID_HEADER,
} from '@/lib/secure-action-utils';

interface SecureActionOptions {
    isDevToolsDetected?: boolean; // Từ useAntiDebugFull
}

interface SecureFetchOptions extends RequestInit {
    skipSignature?: boolean; // Bỏ qua signature (cho request không nhạy cảm)
}

export function useSecureServerAction(options: SecureActionOptions = {}) {
    const { isDevToolsDetected = false } = options;
    const { token } = useAuth();

    /**
     * secureFetch — fetch() wrapper với HMAC signature
     * Tự động thêm: Authorization, signature, timestamp, nonce, fake headers
     */
    const secureFetch = useCallback(async (
        url: string,
        init: SecureFetchOptions = {}
    ): Promise<Response> => {
        // ⛔ Block nếu DevTools đang mở
        if (isDevToolsDetected) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Yêu cầu bị từ chối — vui lòng tắt Developer Tools',
                    errorCode: 'DEVTOOLS_BLOCKED',
                }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const method = (init.method || 'GET').toUpperCase();
        const body = typeof init.body === 'string' ? init.body : null;
        const headers = new Headers(init.headers);

        // Auth header
        const currentToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
        if (currentToken && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${currentToken}`);
        }

        // Content-Type
        if (body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        // HMAC Signature (cho request quan trọng)
        if (!init.skipSignature && currentToken) {
            try {
                const path = new URL(url, window.location.origin).pathname;
                const sig = await generateRequestSignature(method, path, body, currentToken);

                headers.set(SIGNATURE_HEADER, sig.signature);
                headers.set(TIMESTAMP_HEADER, sig.timestamp);
                headers.set(NONCE_HEADER, sig.nonce);
                headers.set(REQUEST_ID_HEADER, sig.requestId);
            } catch {
                // Signature generation failed — tiếp tục không signature
                console.warn('[SecureAction] Signature generation failed');
            }
        }

        // Fake decoy headers — gây confuse khi inspect Network tab
        headers.set('X-Client-Version', '3.' + Math.floor(Math.random() * 90 + 10));
        headers.set('X-Session-Hash', Math.random().toString(36).slice(2, 10));

        return fetch(url, {
            ...init,
            method,
            headers,
        });
    }, [token, isDevToolsDetected]);

    /**
     * Flag cho phía UI biết DevTools đang block actions
     */
    const isDevToolsBlocked = useMemo(() => isDevToolsDetected, [isDevToolsDetected]);

    return { secureFetch, isDevToolsBlocked };
}
