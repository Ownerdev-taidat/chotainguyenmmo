'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard, Wallet, ShoppingBag, AlertTriangle, Heart,
    Bell, User, Shield, LogOut, ChevronLeft, ChevronRight, Menu, X,
    Home, Grid3X3, Store, HelpCircle, Search, PlusCircle, Key,
    Star, BookOpen, MessageSquare, HelpingHand, Globe
} from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { useI18n } from '@/lib/i18n';
import { secureFetch } from '@/lib/secure-fetch';

const userMenuKeys = [
    { icon: LayoutDashboard, key: 'dashOverview' as const, href: '/dashboard' },
    { icon: User, key: 'dashProfile' as const, href: '/dashboard/ho-so' },
    { icon: Shield, key: 'dashSecurity' as const, href: '/dashboard/bao-mat' },
    { icon: ShoppingBag, key: 'dashOrderHistory' as const, href: '/dashboard/don-hang' },
    { icon: MessageSquare, key: 'dashMessages' as const, href: '/dashboard/tin-nhan' },
    { icon: Key, key: 'dashApiKeys' as const, href: '/dashboard/api-keys' },
];

const sidebarLinkKeys = [
    { icon: Home, key: 'dashHome' as const, href: '/' },
    { icon: Grid3X3, key: 'dashCategories' as const, href: '/danh-muc' },
    { icon: Star, key: 'dashFeatured' as const, href: '/san-pham-noi-bat' },
    { icon: Store, key: 'dashShops' as const, href: '/gian-hang' },
    { icon: BookOpen, key: 'dashGuide' as const, href: '/huong-dan' },
    { icon: HelpingHand, key: 'dashFaqs' as const, href: '/faqs' },
    { icon: HelpCircle, key: 'dashSupport' as const, href: '/ho-tro' },
    { icon: Search, key: 'dashSearch' as const, href: '/san-pham' },
    { icon: Store, key: 'dashSellerCenter' as const, href: '/seller' },
];

function SidebarContent({ user, onClose, onLogout, t }: { user: { fullName: string; username: string; email: string } | null; onClose?: () => void; onLogout: () => void; t: (k: any) => string }) {
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase();

    return (
        <>
            {/* Brand */}
            <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <img src="/logokhongnen.png" alt="ChoTaiNguyen" className="h-9 w-auto" />
                    <div>
                        <div className="text-base font-bold text-brand-text-primary">ChoTaiNguyen</div>
                        <div className="text-[10px] text-brand-text-muted">{t('dashPanel')}</div>
                    </div>
                </Link>
                {onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-surface-2 lg:hidden">
                        <X className="w-5 h-5 text-brand-text-muted" />
                    </button>
                )}
            </div>

            {/* User Info */}
            <div className="p-5 border-b border-brand-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">{user ? getInitials(user.fullName) : '?'}</span>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary">{user?.fullName || t('guest')}</div>
                        <div className="text-xs text-brand-text-muted">@{user?.username || ''}</div>
                    </div>
                </div>
            </div>

            {/* Site Navigation - chỉ hiển thị link quay về trang chính */}
            <nav className="flex-1 p-3 overflow-y-auto">
                <div className="px-4 py-1.5 text-[10px] font-semibold text-brand-text-muted uppercase tracking-wider">
                    {t('navigation')}
                </div>
                <div className="space-y-0.5">
                    {sidebarLinkKeys.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all"
                        >
                            <item.icon className="w-5 h-5" />
                            {t(item.key)}
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Bottom */}
            <div className="p-3 border-t border-brand-border">
                <button onClick={onLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-brand-danger hover:bg-brand-surface-2 transition-all w-full">
                    <LogOut className="w-4 h-4" /> {t('logout')}
                </button>
            </div>
        </>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { formatVnd } = useCurrency();
    const { t, locale, setLocale } = useI18n();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const tabsRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const handleLogout = () => {
        logout();
        router.push('/dang-nhap');
    };

    // Fetch unread message count
    useEffect(() => {
        if (!user) return;
        const fetchUnread = () => {
            secureFetch('/api/v1/conversations')
                .then(r => r.ok ? r.json() : null)
                .then(d => {
                    if (d?.success && d.data) {
                        const total = d.data.reduce((sum: number, c: any) => sum + (c.unread || 0), 0);
                        setUnreadCount(total);
                    }
                })
                .catch(() => {});
        };
        fetchUnread();
        const interval = setInterval(fetchUnread, 5000);
        return () => clearInterval(interval);
    }, [user]);

    // Check scroll state for tab arrows
    const checkScroll = () => {
        const el = tabsRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };

    useEffect(() => {
        checkScroll();
        const el = tabsRef.current;
        if (el) {
            el.addEventListener('scroll', checkScroll, { passive: true });
            window.addEventListener('resize', checkScroll);
        }
        return () => {
            if (el) el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, []);

    // Scroll active tab into view
    useEffect(() => {
        const el = tabsRef.current;
        if (!el) return;
        const activeTab = el.querySelector('[data-active="true"]') as HTMLElement;
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [pathname]);

    const scrollTabs = (direction: 'left' | 'right') => {
        const el = tabsRef.current;
        if (!el) return;
        el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-brand-bg flex">
            {/* Desktop Sidebar — giờ chỉ chứa điều hướng site */}
            <aside className="hidden lg:flex w-[220px] bg-brand-surface border-r border-brand-border flex-col shrink-0 sticky top-0 h-screen">
                <SidebarContent user={user} onLogout={handleLogout} t={t} />
            </aside>

            {/* Mobile Drawer Overlay */}
            {drawerOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
                    <aside className="absolute left-0 top-0 h-full w-[260px] bg-brand-surface border-r border-brand-border flex flex-col shadow-card-hover animate-slide-up">
                        <SidebarContent user={user} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} t={t} />
                    </aside>
                </div>
            )}

            {/* Main */}
            <div className="flex-1 min-w-0">
                {/* Horizontal Tab Bar — thay thế "Tổng quan tài khoản" */}
                <header className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur-xl border-b border-brand-border">
                    {/* Top row: mobile menu + wallet + notifications */}
                    <div className="flex items-center justify-between px-4 lg:px-6 py-2.5">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setDrawerOpen(true)}
                                className="lg:hidden p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <Link href="/" className="lg:hidden flex items-center gap-2">
                                <img src="/logokhongnen.png" alt="ChoTaiNguyen" className="h-7 w-auto" />
                                <span className="text-sm font-bold text-brand-text-primary">ChoTaiNguyen</span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-brand-success/10 border border-brand-success/20 rounded-xl overflow-hidden">
                                <Link href="/dashboard/vi" className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-brand-success/20 transition-all">
                                    <Wallet className="w-4 h-4 text-brand-success" />
                                    <span className="text-brand-success font-semibold">
                                        {formatVnd(user?.walletBalance || 0)}
                                    </span>
                                </Link>
                                <Link href="/dashboard/nap-tien" className="flex items-center gap-0.5 bg-brand-primary hover:bg-brand-primary/90 text-white px-2 py-1.5 text-[10px] font-medium transition-all">
                                    <PlusCircle className="w-3 h-3" /> {t('topDeposit')}
                                </Link>
                            </div>
                            <Link href="/dashboard/thong-bao" className="relative p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all">
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-brand-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{unreadCount > 99 ? '99+' : unreadCount}</span>
                                )}
                            </Link>
                            <button
                                onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
                                className="p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all"
                                title={locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
                            >
                                <Globe className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Horizontal scrollable tabs */}
                    <div className="relative">
                        {/* Left scroll arrow */}
                        {canScrollLeft && (
                            <button
                                onClick={() => scrollTabs('left')}
                                className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-r from-brand-bg/95 to-transparent"
                            >
                                <ChevronLeft className="w-4 h-4 text-brand-text-muted" />
                            </button>
                        )}

                        <div
                            ref={tabsRef}
                            className="flex gap-1 overflow-x-auto scrollbar-hide px-4 lg:px-6 pb-2"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {userMenuKeys.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        data-active={isActive}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                                            isActive
                                                ? 'bg-brand-primary text-white shadow-sm'
                                                : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2'
                                        }`}
                                    >
                                    <item.icon className="w-4 h-4" />
                                        {t(item.key)}
                                        {item.href === '/dashboard/tin-nhan' && unreadCount > 0 && (
                                            <span className="min-w-[18px] h-[18px] rounded-full bg-brand-danger text-white text-[10px] font-bold flex items-center justify-center px-1">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Right scroll arrow */}
                        {canScrollRight && (
                            <button
                                onClick={() => scrollTabs('right')}
                                className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-l from-brand-bg/95 to-transparent"
                            >
                                <ChevronRight className="w-4 h-4 text-brand-text-muted" />
                            </button>
                        )}
                    </div>
                </header>

                <main className="p-4 md:p-6">{children}</main>
            </div>
        </div>
    );
}
