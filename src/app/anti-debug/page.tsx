'use client';

/**
 * Anti-Debug Redirect Page
 * ========================
 * Trang hiển thị khi Level 2 redirect user ra khỏi site
 * ⚠️ KHÔNG dùng <html>/<body> vì đã có trong root layout → tránh Error #418
 */

import React from 'react';
import Link from 'next/link';
import { Shield, Home, ArrowLeft } from 'lucide-react';

export default function AntiDebugPage() {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f23 100%)',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            color: '#fff',
            zIndex: 99999,
        }}>
            <div style={{
                maxWidth: 500,
                width: '90%',
                textAlign: 'center',
                padding: '48px 32px',
            }}>
                {/* Icon */}
                <div style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(255, 80, 80, 0.12), rgba(255, 40, 40, 0.04))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 32px',
                    border: '1px solid rgba(255, 80, 80, 0.15)',
                }}>
                    <Shield style={{
                        width: 48,
                        height: 48,
                        color: '#ff5555',
                    }} />
                </div>

                {/* Title */}
                <h1 style={{
                    fontSize: 28,
                    fontWeight: 800,
                    margin: '0 0 12px',
                    background: 'linear-gradient(135deg, #ff5555, #ff8888)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    Hệ thống bảo mật
                </h1>

                <p style={{
                    fontSize: 16,
                    color: 'rgba(255, 255, 255, 0.5)',
                    lineHeight: 1.7,
                    margin: '0 0 40px',
                }}>
                    Phiên làm việc đã bị tạm dừng do phát hiện công cụ phát triển.
                    Vui lòng đóng Developer Tools và quay lại trang chủ để tiếp tục mua hàng.
                </p>

                {/* Buttons */}
                <div style={{
                    display: 'flex',
                    gap: 12,
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                }}>
                    <Link
                        href="/"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '14px 28px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            borderRadius: 14,
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 600,
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                            border: 'none',
                        }}
                    >
                        <Home style={{ width: 18, height: 18 }} />
                        Quay về trang chủ
                    </Link>

                    <button
                        onClick={() => window.history.back()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '14px 28px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: 14,
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <ArrowLeft style={{ width: 18, height: 18 }} />
                        Quay lại
                    </button>
                </div>

                {/* Footer */}
                <p style={{
                    marginTop: 48,
                    fontSize: 12,
                    color: 'rgba(255, 255, 255, 0.25)',
                }}>
                    Protected by Antigravity Fortress 2026 • ChoTaiNguyen
                </p>
            </div>
        </div>
    );
}
