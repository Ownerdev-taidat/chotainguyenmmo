'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Anti-Debug Page — DISABLED (Light Mode)
 * Redirect về trang chủ
 */
export default function AntiDebugPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/');
    }, [router]);

    return null;
}
