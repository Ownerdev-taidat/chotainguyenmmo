'use client';

import { useState, useEffect } from 'react';
import { X, Bell, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface Announcement {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'important';
}

export default function AnnouncementPopup() {
    const { t } = useI18n();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const res = await fetch('/api/v1/announcements');
                if (!res.ok) return;
                const data = await res.json();
                if (data.success && data.data.length > 0) {
                    // Filter out dismissed announcements
                    const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
                    const active = data.data.filter((a: Announcement) => !dismissed.includes(a.id));
                    if (active.length > 0) {
                        setAnnouncements(active);
                        setShow(true);
                    }
                }
            } catch {}
        };

        // Small delay to not block page load
        const timer = setTimeout(fetchAnnouncements, 1500);
        return () => clearTimeout(timer);
    }, []);

    if (!show || announcements.length === 0) return null;

    const current = announcements[currentIdx];
    if (!current) return null;

    const handleDismiss = () => {
        if (currentIdx < announcements.length - 1) {
            setCurrentIdx(prev => prev + 1);
        } else {
            setShow(false);
        }
    };

    const handleDontShowAgain = () => {
        const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
        dismissed.push(current.id);
        localStorage.setItem('dismissed_announcements', JSON.stringify(dismissed));
        handleDismiss();
    };

    const typeStyles = {
        info: { bg: 'bg-brand-info/10', border: 'border-brand-info/30', icon: <Info className="w-6 h-6 text-brand-info" />, color: 'text-brand-info' },
        warning: { bg: 'bg-brand-warning/10', border: 'border-brand-warning/30', icon: <AlertTriangle className="w-6 h-6 text-brand-warning" />, color: 'text-brand-warning' },
        important: { bg: 'bg-brand-danger/10', border: 'border-brand-danger/30', icon: <AlertCircle className="w-6 h-6 text-brand-danger" />, color: 'text-brand-danger' },
    };
    const style = typeStyles[current.type] || typeStyles.info;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className={`relative bg-brand-surface border-2 ${style.border} rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up`}>
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
                        {style.icon}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <Bell className="w-3.5 h-3.5 text-brand-text-muted" />
                            <span className="text-[10px] text-brand-text-muted uppercase tracking-wider font-medium">{t('notifications')}</span>
                        </div>
                        <h2 className={`text-lg font-bold ${style.color}`}>{current.title}</h2>
                    </div>
                </div>

                {/* Message */}
                <div className="bg-brand-surface-2 rounded-xl p-4 mb-5">
                    <p className="text-sm text-brand-text-secondary whitespace-pre-wrap leading-relaxed">{current.message}</p>
                </div>

                {/* Counter */}
                {announcements.length > 1 && (
                    <p className="text-[10px] text-brand-text-muted text-center mb-3">
                        {currentIdx + 1} / {announcements.length}
                    </p>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleDontShowAgain}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-brand-surface-2 text-brand-text-muted hover:bg-brand-surface-3 transition-all"
                    >
                        {t('dontShowAgain')}
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium btn-primary"
                    >
                        {currentIdx < announcements.length - 1 ? t('next') : t('close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
