'use client';

/**
 * Antigravity Protection Engine — useAntiDebugFull
 * =================================================
 * Hook chống DevTools 6 lớp cho marketplace Next.js 15
 * 
 * CÁCH DÙNG: Chỉ cần gọi useAntiDebugFull() trong root Provider
 * 
 * WHITELIST: Admin, Seller, trang /seller/*, /admin/*
 * ENV: ANTI_DEBUG_ENABLED=true/false (tắt hoàn toàn khi false)
 * 
 * 6 LAYERS:
 * L1: Performance timing (debugger statement attack)
 * L2: Window dimension detection 
 * L3: Console override detection
 * L4: Element inspect trick (getter trap)
 * L5: Keyboard shortcut blocking
 * L6: Continuous monitor (400ms interval, vote-based)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// ============================================================
// TYPES
// ============================================================
export interface AntiDebugState {
    isDetected: boolean;     // DevTools đang mở?
    detectionCount: number;  // Số lần phát hiện
    isWhitelisted: boolean;  // User được whitelist?
    level: 1 | 2 | 3;       // Level response hiện tại
}

interface AntiDebugOptions {
    enabled?: boolean;       // Bật/tắt protection (mặc định true)
    checkInterval?: number;  // ms giữa các lần check (mặc định 400)
    userRole?: string;       // Role từ auth context
}

// ============================================================
// DETECTION LAYERS
// ============================================================

/**
 * Layer 1: Performance Timing Attack
 * Đặt debugger statement → đo thời gian chạy. 
 * Nếu DevTools mở, debugger sẽ pause ~100ms+
 */
function detectByTiming(): boolean {
    try {
        const start = performance.now();
        // eslint-disable-next-line no-debugger
        debugger;
        const elapsed = performance.now() - start;
        return elapsed > 50; // > 50ms = DevTools đang mở
    } catch {
        return false;
    }
}

/**
 * Layer 2: Window Dimension Detection
 * DevTools mở → window.outer > inner (do panel chiếm chỗ)
 */
function detectByDimension(): boolean {
    try {
        const widthDiff = Math.abs(window.outerWidth - window.innerWidth);
        const heightDiff = Math.abs(window.outerHeight - window.innerHeight);
        // Threshold cao hơn 160 để tránh false positive (zoom, OS UI)
        return widthDiff > 160 || heightDiff > 160;
    } catch {
        return false;
    }
}

/**
 * Layer 3: Console Override Detection
 * Kiểm tra xem console methods có bị override bởi DevTools extension
 */
function detectByConsole(): boolean {
    try {
        const img = new Image();
        let detected = false;
        Object.defineProperty(img, 'id', {
            get: () => {
                detected = true;
                return 'probe';
            },
        });
        // console.log/dir sẽ inspect element → trigger getter nếu DevTools mở
        console.dir(img);
        console.clear();
        return detected;
    } catch {
        return false;
    }
}

/**
 * Layer 4: Element Inspect Trick
 * Tạo element với getter trap — chỉ fire khi DevTools inspect DOM
 */
function detectByElement(): boolean {
    try {
        let detected = false;
        const el = document.createElement('div');
        Object.defineProperty(el, 'id', {
            get: () => {
                detected = true;
                return '';
            },
            configurable: true,
        });
        console.log('%c', el as unknown as string);
        console.clear();
        return detected;
    } catch {
        return false;
    }
}

// ============================================================
// KEYBOARD BLOCKER (Layer 5)
// ============================================================
function setupKeyboardBlocking(): () => void {
    const handler = (e: KeyboardEvent) => {
        // F12
        if (e.key === 'F12') {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspect)
        if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // Ctrl+U (View Source)
        if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        // Ctrl+S (Save page)
        if (e.ctrlKey && (e.key === 's' || e.key === 'S') && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
}

// ============================================================
// MAIN HOOK
// ============================================================
export function useAntiDebugFull(options: AntiDebugOptions = {}): AntiDebugState {
    const {
        enabled = true,
        checkInterval = 400,
        userRole = '',
    } = options;

    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [state, setState] = useState<AntiDebugState>({
        isDetected: false,
        detectionCount: 0,
        isWhitelisted: false,
        level: 1,
    });

    const detectionCountRef = useRef(0);
    const levelDecidedRef = useRef(false);
    const levelRef = useRef<1 | 2 | 3>(1);

    // ---- Whitelist Logic ----
    const isWhitelisted = useCallback((): boolean => {
        // Admin & Seller roles → bypass hoàn toàn
        const upperRole = userRole.toUpperCase();
        if (['ADMIN', 'SUPER_ADMIN', 'SELLER'].includes(upperRole)) return true;

        // Seller Center & Admin panel → bypass hoàn toàn
        if (pathname.startsWith('/seller') || pathname.startsWith('/admin')) return true;

        // Cookie bypass
        if (typeof document !== 'undefined' && document.cookie.includes('admin_ctn=true')) return true;

        // Query param bypass (?dev=ctn — chỉ giá trị chính xác)
        if (searchParams.get('dev') === 'ctn') return true;

        return false;
    }, [userRole, pathname, searchParams]);

    useEffect(() => {
        // Nếu feature tắt hoặc user được whitelist → không chạy
        if (!enabled || isWhitelisted()) {
            setState(prev => ({ ...prev, isWhitelisted: true, isDetected: false }));
            return;
        }

        // ---- Layer 5: Keyboard blocking ----
        const cleanupKeyboard = setupKeyboardBlocking();

        // ---- Layer 6: Continuous Monitor (400ms interval) ----
        const intervalId = setInterval(() => {
            // Vote-based detection — cần ≥2 layers đồng ý mới confirm  
            let votes = 0;

            // Layer 1: Timing — BỎ QUA trong continuous check vì debugger statement 
            // gây lag. Chỉ dùng Layer 1 khi lần đầu mount.

            // Layer 2: Dimension
            if (detectByDimension()) votes++;

            // Layer 3: Console  
            if (detectByConsole()) votes++;

            // Layer 4: Element
            if (detectByElement()) votes++;

            const isDevToolsOpen = votes >= 1; // Chỉ cần 1 layer (3,4 rất chính xác)

            if (isDevToolsOpen) {
                detectionCountRef.current++;

                // Quyết định level 1 lần duy nhất
                if (!levelDecidedRef.current) {
                    levelDecidedRef.current = true;
                    // 60% Level 1, 40% Level 2
                    levelRef.current = Math.random() < 0.6 ? 1 : 2;
                }

                setState({
                    isDetected: true,
                    detectionCount: detectionCountRef.current,
                    isWhitelisted: false,
                    level: levelRef.current,
                });
            } else {
                // Reset khi DevTools đóng
                setState(prev => ({
                    ...prev,
                    isDetected: false,
                }));
                levelDecidedRef.current = false;
            }
        }, checkInterval);

        // ---- Layer 1: Initial timing check khi mount ----
        // Chạy 1 lần duy nhất (không lặp vì debugger gây lag)
        if (detectByTiming()) {
            detectionCountRef.current++;
            levelRef.current = 1;
            levelDecidedRef.current = true;
            setState({
                isDetected: true,
                detectionCount: detectionCountRef.current,
                isWhitelisted: false,
                level: 1,
            });
        }

        // ---- Cleanup ----
        return () => {
            clearInterval(intervalId);
            cleanupKeyboard();
        };
    }, [enabled, checkInterval, isWhitelisted]);

    return state;
}
