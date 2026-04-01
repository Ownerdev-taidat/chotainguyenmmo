'use client';

/**
 * ProtectionEngine — Component tổng mount vào root
 * ================================================
 * Kết hợp: useAntiDebugFull + AntiDebugOverlay + ContentProtection
 * Tự động detect role → whitelist Admin/Seller
 * 
 * ENV toggle: NEXT_PUBLIC_ANTI_DEBUG_ENABLED=true/false
 */

import React, { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useAntiDebugFull } from '@/hooks/use-anti-debug-full';
import AntiDebugOverlay from '@/components/AntiDebugOverlay';
import ContentProtection from '@/components/shared/ContentProtection';

function ProtectionEngineInner() {
    const { user } = useAuth();

    // ENV toggle — mặc định BẬT
    const isEnabled = process.env.NEXT_PUBLIC_ANTI_DEBUG_ENABLED !== 'false';

    // Anti-DevTools Detection
    const antiDebug = useAntiDebugFull({
        enabled: isEnabled,
        checkInterval: 400,
        userRole: user?.role || '',
    });

    // Whitelist check cho content protection
    const isWhitelisted = antiDebug.isWhitelisted || !isEnabled;

    return (
        <>
            {/* Anti-DevTools Overlay */}
            <AntiDebugOverlay
                isDetected={antiDebug.isDetected}
                level={antiDebug.level}
                isWhitelisted={antiDebug.isWhitelisted}
            />

            {/* Content Protection (right-click, copy, print, watermark) */}
            <ContentProtection
                isWhitelisted={isWhitelisted}
                username={user?.username}
            />
        </>
    );
}

// Wrap trong Suspense vì useSearchParams cần Suspense boundary
export default function ProtectionEngine() {
    return (
        <Suspense fallback={null}>
            <ProtectionEngineInner />
        </Suspense>
    );
}
