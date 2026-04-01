'use client';

/**
 * AntiDebugOverlay — Overlay glassmorphism khi detect DevTools
 * ============================================================
 * Hiển thị khi useAntiDebugFull().isDetected === true
 * 
 * Level 1: Blur body + overlay cảnh báo đẹp
 * Level 2: Redirect sau 3s về /anti-debug
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, X, AlertTriangle } from 'lucide-react';

interface AntiDebugOverlayProps {
    isDetected: boolean;
    level: 1 | 2 | 3;
    isWhitelisted: boolean;
}

export default function AntiDebugOverlay({ isDetected, level, isWhitelisted }: AntiDebugOverlayProps) {
    const router = useRouter();
    const [countdown, setCountdown] = useState(3);

    // Level 2: Redirect countdown
    useEffect(() => {
        if (!isDetected || isWhitelisted || level !== 2) return;

        setCountdown(3);
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    router.push('/anti-debug');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isDetected, level, isWhitelisted, router]);

    // Blur body khi detected
    useEffect(() => {
        if (isDetected && !isWhitelisted) {
            document.body.style.filter = 'blur(30px)';
            document.body.style.pointerEvents = 'none';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.filter = '';
            document.body.style.pointerEvents = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.body.style.filter = '';
            document.body.style.pointerEvents = '';
            document.body.style.userSelect = '';
        };
    }, [isDetected, isWhitelisted]);

    if (!isDetected || isWhitelisted) return null;

    return (
        <div
            id="antigravity-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                pointerEvents: 'all',
            }}
        >
            <div
                style={{
                    maxWidth: 440,
                    width: '90%',
                    background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.95), rgba(20, 20, 30, 0.98))',
                    border: '1px solid rgba(255, 100, 100, 0.2)',
                    borderRadius: 24,
                    padding: '40px 32px',
                    textAlign: 'center',
                    boxShadow: '0 25px 80px rgba(255, 50, 50, 0.15), 0 0 60px rgba(255, 50, 50, 0.05)',
                    animation: 'antigravity-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                {/* Shield Icon with pulse animation */}
                <div
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(255, 80, 80, 0.15), rgba(255, 40, 40, 0.05))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        animation: 'antigravity-pulse 2s ease-in-out infinite',
                    }}
                >
                    <Shield
                        style={{
                            width: 40,
                            height: 40,
                            color: '#ff5555',
                            filter: 'drop-shadow(0 0 10px rgba(255, 85, 85, 0.5))',
                        }}
                    />
                </div>

                {/* Title */}
                <h2
                    style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#fff',
                        margin: '0 0 8px',
                        letterSpacing: '-0.02em',
                    }}
                >
                    🛡️ Phát hiện công cụ phát triển
                </h2>

                {/* Message */}
                <p
                    style={{
                        fontSize: 14,
                        color: 'rgba(255, 255, 255, 0.6)',
                        margin: '0 0 24px',
                        lineHeight: 1.6,
                    }}
                >
                    Vui lòng tắt Developer Tools (F12) để tiếp tục sử dụng website.
                    Hệ thống bảo mật đang hoạt động để bảo vệ giao dịch của bạn.
                </p>

                {/* Warning box */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'rgba(255, 180, 50, 0.08)',
                        border: '1px solid rgba(255, 180, 50, 0.15)',
                        borderRadius: 12,
                        padding: '12px 16px',
                        marginBottom: level === 2 ? 20 : 0,
                    }}
                >
                    <AlertTriangle
                        style={{ width: 18, height: 18, color: '#ffb432', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', textAlign: 'left' }}>
                        Các chức năng mua hàng đã bị tạm khóa cho đến khi DevTools được đóng.
                    </span>
                </div>

                {/* Level 2: Countdown redirect */}
                {level === 2 && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            marginTop: 4,
                            padding: '10px 16px',
                            background: 'rgba(255, 50, 50, 0.08)',
                            borderRadius: 10,
                            border: '1px solid rgba(255, 50, 50, 0.15)',
                        }}
                    >
                        <X style={{ width: 16, height: 16, color: '#ff5555' }} />
                        <span style={{ fontSize: 13, color: '#ff8888' }}>
                            Chuyển hướng sau {countdown} giây...
                        </span>
                    </div>
                )}
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes antigravity-slide-up {
                    from { opacity: 0; transform: translateY(30px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes antigravity-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 85, 85, 0.2); }
                    50% { box-shadow: 0 0 0 15px rgba(255, 85, 85, 0); }
                }
            `}</style>
        </div>
    );
}
