'use client';

/**
 * useAntiDebugFull — DISABLED (Light Mode)
 * ==========================================
 * Không detect DevTools, không block keyboard
 * Trả về defaults an toàn
 */

export interface AntiDebugState {
    isDetected: boolean;
    detectionCount: number;
    level: 'none' | 'warning' | 'critical';
    isWhitelisted: boolean;
}

export function useAntiDebugFull(_options?: any): AntiDebugState {
    return {
        isDetected: false,
        detectionCount: 0,
        level: 'none',
        isWhitelisted: true,
    };
}
