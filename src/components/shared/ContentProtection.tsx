'use client';

/**
 * ContentProtection — Chống copy, chống print, chống kéo ảnh
 * ===========================================================
 * Mount 1 lần trong root Provider, áp dụng cho toàn bộ trang public
 * WHITELIST: Admin, Seller → không áp dụng
 */

import React, { useEffect } from 'react';

interface ContentProtectionProps {
    isWhitelisted: boolean;
    username?: string;
}

export default function ContentProtection({ isWhitelisted, username }: ContentProtectionProps) {

    useEffect(() => {
        if (isWhitelisted) return;

        // ---- 1. Block right-click context menu ----
        const handleContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Cho phép right-click trên input/textarea (để paste)
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            e.preventDefault();
        };

        // ---- 2. Block text selection trên product/price areas ----
        const handleSelectStart = (e: Event) => {
            const target = e.target as HTMLElement;
            // Cho phép select trên input/textarea
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            // Cho phép select trên Seller Center
            if (target.closest('[data-allow-select]')) return;
            e.preventDefault();
        };

        // ---- 3. Block image drag ----
        const handleDragStart = (e: DragEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
                e.preventDefault();
            }
        };

        // ---- 4. Block copy (Ctrl+C trên nội dung nhạy cảm) ----
        const handleCopy = (e: ClipboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            // Cho phép copy trên delivery content (khi mua hàng xong)
            if (target.closest('[data-allow-copy]')) return;
            e.preventDefault();
        };

        // ---- 5. Anti-print ----
        const handleBeforePrint = () => {
            document.body.style.display = 'none';
        };
        const handleAfterPrint = () => {
            document.body.style.display = '';
        };

        // ---- 6. Keyboard: Block Ctrl+A (select all), Ctrl+P (print) ----
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+P (print)
            if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
            }
        };

        // Mount listeners
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('selectstart', handleSelectStart);
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('copy', handleCopy);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);

        // ---- 7. CSS: Thêm anti-print + anti-select global styles ----
        const styleEl = document.createElement('style');
        styleEl.id = 'antigravity-content-protection';
        styleEl.textContent = `
            @media print {
                body { display: none !important; }
                html::after {
                    content: 'Protected by Antigravity Fortress';
                    display: block;
                    text-align: center;
                    padding: 100px;
                    font-size: 24px;
                    color: #999;
                }
            }
            img {
                -webkit-user-drag: none !important;
                user-drag: none !important;
            }
        `;
        document.head.appendChild(styleEl);

        // ---- 8. Dynamic Watermark (Canvas-based) ----
        let watermarkEl: HTMLDivElement | null = null;
        const watermarkText = username || 'CTN-' + Math.random().toString(36).slice(2, 8);

        const createWatermark = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 300;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '14px Inter, Arial, sans-serif';
            ctx.fillStyle = 'rgba(128, 128, 128, 0.04)';
            ctx.textAlign = 'center';

            // Xoay 45 độ
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText(watermarkText, 0, 0);
            ctx.fillText(new Date().toLocaleDateString('vi-VN'), 0, 20);

            watermarkEl = document.createElement('div');
            watermarkEl.id = 'antigravity-watermark';
            watermarkEl.style.cssText = `
                position: fixed;
                inset: 0;
                z-index: 9998;
                pointer-events: none;
                background-image: url(${canvas.toDataURL()});
                background-repeat: repeat;
                opacity: 1;
            `;
            document.body.appendChild(watermarkEl);
        };

        createWatermark();

        // Cleanup
        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('selectstart', handleSelectStart);
            document.removeEventListener('dragstart', handleDragStart);
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
            styleEl.remove();
            watermarkEl?.remove();
        };
    }, [isWhitelisted, username]);

    return null; // Component không render gì
}
