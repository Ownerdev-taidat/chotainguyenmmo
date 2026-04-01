'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard, Package, Database, ShoppingBag, AlertTriangle,
    TrendingUp, Wallet, Settings, LogOut, ChevronLeft, Bell, Store, Menu, X, FileSpreadsheet, Clock, Megaphone, MessageSquare, FileText, Globe
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { secureFetch } from '@/lib/secure-fetch';

const sellerMenuKeys = [
    { icon: LayoutDashboard, key: 'sellerOverview' as const, href: '/seller' },
    { icon: Package, key: 'sellerProducts' as const, href: '/seller/san-pham' },
    { icon: ShoppingBag, key: 'sellerOrders' as const, href: '/seller/don-hang' },
    { icon: MessageSquare, key: 'sellerMessages' as const, href: '/seller/tin-nhan' },
    { icon: AlertTriangle, key: 'sellerComplaints' as const, href: '/seller/khieu-nai' },
    { icon: TrendingUp, key: 'sellerRevenue' as const, href: '/seller/doanh-thu' },
    { icon: FileText, key: 'sellerInvoices' as const, href: '/seller/hoa-don' },
    { icon: Wallet, key: 'sellerWithdraw' as const, href: '/seller/rut-tien' },
    { icon: Megaphone, key: 'sellerAds' as const, href: '/seller/quang-cao' },
    { icon: Settings, key: 'sellerSettings' as const, href: '/seller/cai-dat' },
];

function SidebarContent({ pathname, user, onClose, onLogout, unreadCount, t }: { pathname: string; user: { fullName: string; username: string } | null; onClose?: () => void; onLogout: () => void; unreadCount: number; t: (k: any) => string }) {
    return (
        <>
            <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <img src="/logokhongnen.png" alt="ChoTaiNguyen" className="h-9 w-auto" />
                    <div>
                        <div className="text-base font-bold text-brand-text-primary">Seller Center</div>
                        <div className="text-[10px] text-brand-text-muted">ChoTaiNguyen</div>
                    </div>
                </Link>
                {onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-surface-2 lg:hidden">
                        <X className="w-5 h-5 text-brand-text-muted" />
                    </button>
                )}
            </div>
            <div className="p-5 border-b border-brand-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center border border-brand-border">
                        <Store className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary">{user?.fullName || 'Shop'}</div>
                        <div className="text-xs text-brand-success flex items-center gap-1">● {t('sellerActive')}</div>
                    </div>
                </div>
            </div>
            <nav className="flex-1 p-3 overflow-y-auto">
                <div className="space-y-1">
                    {sellerMenuKeys.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/seller' && pathname.startsWith(item.href));
                        const isChat = item.href === '/seller/tin-nhan';
                        return (
                            <Link key={item.href} href={item.href} onClick={onClose}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2'
                                    }`}>
                                <item.icon className="w-5 h-5" />
                                <span className="flex-1">{t(item.key)}</span>
                                {isChat && unreadCount > 0 && (
                                    <span className="min-w-[20px] h-[20px] rounded-full bg-brand-danger text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>
            <div className="p-3 border-t border-brand-border space-y-2">
                <div className="bg-brand-danger/5 border border-brand-danger/20 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-brand-danger leading-relaxed">
                        {t('sellerWarning')}
                    </p>
                </div>
                <Link href="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-brand-primary hover:text-white hover:bg-brand-primary transition-all">
                    <ChevronLeft className="w-4 h-4" /> {t('backHome')}
                </Link>
                <button onClick={onLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-brand-danger hover:bg-brand-surface-2 transition-all w-full">
                    <LogOut className="w-4 h-4" /> {t('logout')}
                </button>
            </div>
        </>
    );
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, isLoading } = useAuth();
    const { t, locale, setLocale } = useI18n();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [sellerStatus, setSellerStatus] = useState<'loading' | 'active' | 'pending' | 'none' | 'kyc_required'>('loading');
    const [sellerRevenue, setSellerRevenue] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);

    const handleLogout = () => { logout(); router.push('/dang-nhap'); };

    // Fetch unread message count
    useEffect(() => {
        if (sellerStatus !== 'active') return;
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
    }, [sellerStatus]);

    // Server-side verification of seller status
    useEffect(() => {
        if (!user || isLoading) return;

        // Admins/Super Admins can always access seller center
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
            setSellerStatus('active');
            return;
        }

        // Verify seller status with the server
        fetch(`/api/v1/seller/register?userId=${user.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.isActiveSeller) {
                    setSellerStatus('active');
                } else if (data.data?.status === 'PENDING') {
                    setSellerStatus('pending');
                } else if (data.data?.status === 'KYC_REQUIRED') {
                    setSellerStatus('kyc_required');
                } else {
                    setSellerStatus('none');
                }
            })
            .catch(() => {
                // On error, fall back to role check
                setSellerStatus(user.role === 'SELLER' ? 'active' : 'none');
            });
    }, [user, isLoading]);

    // Fetch seller revenue
    useEffect(() => {
        if (sellerStatus !== 'active') return;
        secureFetch('/api/v1/seller/stats')
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.success) setSellerRevenue(d.data.revenueMonth || 0); })
            .catch(() => {});
    }, [sellerStatus]);

    // Loading state
    if (isLoading || sellerStatus === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg">
                <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    // Not logged in
    if (!user) {
        router.push('/dang-nhap');
        return null;
    }

    // Pending approval
    if (sellerStatus === 'pending') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
                <div className="max-w-md w-full card text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-warning/10 flex items-center justify-center mx-auto">
                        <Clock className="w-8 h-8 text-brand-warning" />
                    </div>
                    <h1 className="text-xl font-bold text-brand-text-primary">{t('sellerPending')}</h1>
                    <p className="text-sm text-brand-text-muted">
                        {t('sellerPendingDesc')}
                    </p>
                    <div className="space-y-3">
                        <Link href="/dang-ky-ban-hang" className="btn-primary w-full flex items-center justify-center gap-2">
                            <Store className="w-4 h-4" /> {t('sellerViewStatus')}
                        </Link>
                        <Link href="/" className="btn-secondary w-full text-sm">
                            {t('backHome')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // KYC required
    if (sellerStatus === 'kyc_required') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
                <div className="max-w-md w-full card text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-warning/10 flex items-center justify-center mx-auto">
                        <Store className="w-8 h-8 text-brand-warning" />
                    </div>
                    <h1 className="text-xl font-bold text-brand-text-primary">{t('sellerNeedKyc')}</h1>
                    <p className="text-sm text-brand-text-muted">
                        {t('sellerNeedKycDesc')}
                    </p>
                    <div className="space-y-3">
                        <Link href="/dang-ky-ban-hang" className="btn-primary w-full flex items-center justify-center gap-2">
                            <Store className="w-4 h-4" /> {t('sellerAddKyc')}
                        </Link>
                        <Link href="/" className="btn-secondary w-full text-sm">
                            {t('backHome')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Not a seller — no application exists
    if (sellerStatus === 'none') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
                <div className="max-w-md w-full card text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto">
                        <Store className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h1 className="text-xl font-bold text-brand-text-primary">{t('sellerNoShop')}</h1>
                    <p className="text-sm text-brand-text-muted">
                        {t('sellerNoShopDesc')}
                    </p>
                    <div className="space-y-4">
                        <Link href="/dang-ky-ban-hang" className="btn-primary w-full flex items-center justify-center gap-2">
                            <Store className="w-4 h-4" /> {t('sellerRegisterShop')}
                        </Link>
                        <Link href="/" className="btn-secondary w-full text-sm">
                            {t('backHome')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-bg flex">
            <aside className="hidden lg:flex w-[270px] bg-brand-surface border-r border-brand-border flex-col shrink-0 sticky top-0 h-screen">
                <SidebarContent pathname={pathname} user={user} onLogout={handleLogout} unreadCount={unreadCount} t={t} />
            </aside>

            {drawerOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
                    <aside className="absolute left-0 top-0 h-full w-[280px] bg-brand-surface border-r border-brand-border flex flex-col shadow-card-hover">
                        <SidebarContent pathname={pathname} user={user} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} unreadCount={unreadCount} t={t} />
                    </aside>
                </div>
            )}

            <div className="flex-1 min-w-0">
                <header className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur-xl border-b border-brand-border px-4 md:px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setDrawerOpen(true)} className="lg:hidden p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all">
                                <Menu className="w-5 h-5" />
                            </button>
                            <h2 className="text-lg font-semibold text-brand-text-primary hidden lg:block">{t('sellerDashboard')}</h2>
                            <span className="text-sm font-semibold text-brand-text-primary lg:hidden">Seller</span>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="bg-brand-surface-2 border border-brand-border rounded-xl px-2 md:px-3 py-1.5 text-xs md:text-sm">
                                <span className="text-brand-text-muted hidden md:inline">{t('sellerRevenueLabel')}: </span>
                                <span className="text-brand-success font-semibold">{sellerRevenue.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <button
                                onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
                                className="p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all"
                                title={locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
                            >
                                <Globe className="w-5 h-5" />
                            </button>
                            <button className="relative p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-1 right-1 w-2 h-2 bg-brand-danger rounded-full" />
                            </button>
                        </div>
                    </div>
                </header>
                <main className="p-4 md:p-6">{children}</main>
            </div>
        </div>
    );
}
