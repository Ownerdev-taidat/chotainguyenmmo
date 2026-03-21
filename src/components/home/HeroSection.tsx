'use client';

import { useState, useEffect } from 'react';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import {
    ArrowRight, Package, Store, ShoppingBag, Activity,
    Wallet, TrendingUp, ShieldCheck, BarChart3, Sparkles
} from 'lucide-react';

interface HeroSectionProps {
    isLoggedIn?: boolean;
}

export default function HeroSection({ isLoggedIn = false }: HeroSectionProps) {
    const { user } = useAuth();
    const { t, tCat } = useI18n();

    // Use server-side cookie for initial render, client auth for user details
    const showCompact = isLoggedIn;

    // Fetch real category data with product counts
    const [categories, setCategories] = useState<{ id: string; name: string; slug: string; _count: { products: number } }[]>([]);
    useEffect(() => {
        fetch('/api/v1/categories')
            .then(r => r.json())
            .then(d => { if (d.success) setCategories(d.data || []); })
            .catch(() => {});
    }, []);
    // ─── Compact Hero for logged-in users (only after mount) ───
    if (showCompact) {
        return (
            <>
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/5 via-brand-secondary/3 to-transparent" />
                <div className="max-w-container mx-auto px-4 py-3 md:py-6 relative z-10">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
                        {/* Welcome message */}
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white shrink-0">
                                <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                            </div>
                            <div>
                                <h2 className="text-base md:text-lg font-bold text-brand-text-primary">
                                    {t('welcomeBack')} <span className="gradient-text">{user?.fullName || user?.username || 'bạn'}</span>! 👋
                                </h2>
                                <p className="text-xs md:text-sm text-brand-text-secondary">{t('welcomeBackMsg')}</p>
                            </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center gap-2">
                            <Link href="/danh-muc" className="btn-primary !px-3 !py-1.5 md:!px-4 md:!py-2 text-xs md:text-sm flex items-center justify-center gap-1.5" style={{ minWidth: '90px' }}>
                                <Package className="w-3.5 h-3.5 md:w-4 md:h-4" /> {t('explore')}
                            </Link>
                            <Link href="/dashboard" className="btn-secondary !px-3 !py-1.5 md:!px-4 md:!py-2 text-xs md:text-sm flex items-center justify-center gap-1.5" style={{ minWidth: '110px' }}>
                                {t('dashboard')}
                            </Link>
                        </div>
                    </div>

                    {/* Compact stats row */}
                    <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-3 md:gap-6 mt-3 md:mt-4 pt-3 md:pt-4 border-t border-brand-border/50">
                        {[
                            { icon: Package, value: '25,000+', label: t('productCount') },
                            { icon: Store, value: '1,200+', label: t('shopCount') },
                            { icon: ShoppingBag, value: '80,000+', label: t('transactionCount') },
                            { icon: Activity, value: '99.9%', label: t('uptime') },
                        ].map((stat, i) => (
                            <div key={i} className="flex items-center gap-1.5 md:gap-2" style={{ minWidth: '130px' }}>
                                <stat.icon className="w-3 h-3 md:w-3.5 md:h-3.5 text-brand-primary" />
                                <span className="text-xs md:text-sm font-bold text-brand-text-primary">{stat.value}</span>
                                <span className="text-[10px] md:text-xs text-brand-text-muted">{stat.label}</span>
                            </div>
                        ))}
                    </div>

                </div>
            </section>

            {/* Category pills — hidden on mobile, shown on md+ */}
            <div className="max-w-container mx-auto px-4 mt-4 hidden md:block">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {categories.slice(0, 6).map((cat) => (
                        <Link
                            key={cat.slug}
                            href={`/danh-muc/${cat.slug}`}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-surface border border-brand-border rounded-full hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all shrink-0 group"
                        >
                            <span className="text-sm font-medium text-brand-text-secondary group-hover:text-brand-primary transition-colors">{tCat(cat.slug, cat.name)}</span>
                            <span className="text-[10px] text-brand-text-muted bg-brand-surface-2 px-1.5 py-0.5 rounded-full">{cat._count?.products || 0}</span>
                        </Link>
                    ))}
                    <Link href="/danh-muc" className="flex items-center gap-1 px-4 py-2 text-sm text-brand-primary font-medium hover:gap-2 transition-all shrink-0">
                        {t('allCategories')} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>
        </>
        );
    }

    // ─── Full Hero (default for SSR + guests) ───
    return (
        <section className="relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/5 via-transparent to-transparent" />
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-primary/5 rounded-full blur-[120px]" />
            <div className="absolute top-40 right-1/4 w-80 h-80 bg-brand-secondary/5 rounded-full blur-[120px]" />

            <div className="max-w-container mx-auto px-4 py-16 md:py-24 relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <div>
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-sm text-brand-primary font-medium mb-6">
                            <Activity className="w-4 h-4" />
                            {t('heroBadge')}
                        </div>

                        {/* Title */}
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-text-primary leading-tight mb-6">
                            {t('heroTitlePart1')}{' '}
                            <span className="gradient-text">{t('heroTitlePart2')}</span>{' '}
                            {t('heroTitlePart3')}{' '}
                            <span className="gradient-text">ChoTaiNguyen</span>
                        </h1>

                        {/* Description */}
                        <p className="text-base md:text-lg text-brand-text-secondary leading-relaxed mb-8 max-w-xl">
                            {t('heroDesc')}
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-wrap gap-3 mb-10">
                            <Link href="/danh-muc" className="btn-primary flex items-center gap-2">
                                {t('exploreNow')} <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link href="/dang-ky-ban-hang" className="btn-secondary flex items-center gap-2">
                                <Store className="w-4 h-4" /> {t('becomeSeller')}
                            </Link>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { icon: Package, value: '25,000+', label: t('productCount') },
                                { icon: Store, value: '1,200+', label: t('shopCount') },
                                { icon: ShoppingBag, value: '80,000+', label: t('transactionCount') },
                                { icon: Activity, value: '99.9%', label: t('uptime') },
                            ].map((stat, i) => (
                                <div key={i} className="text-center sm:text-left">
                                    <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                                        <stat.icon className="w-4 h-4 text-brand-primary" />
                                        <span className="text-xl font-bold text-brand-text-primary">{stat.value}</span>
                                    </div>
                                    <span className="text-xs text-brand-text-muted">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Visual - Dashboard Mockup */}
                    <div className="hidden lg:block relative">
                        {/* Main Card */}
                        <div className="bg-brand-surface border border-brand-border rounded-3xl p-6 shadow-card relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-semibold text-brand-text-primary">{t('dashboardOverview')}</h3>
                                <span className="badge-success">{t('active')}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-brand-surface-2 rounded-xl p-4">
                                    <Wallet className="w-5 h-5 text-brand-primary mb-2" />
                                    <div className="text-lg font-bold text-brand-text-primary">2,450,000đ</div>
                                    <div className="text-xs text-brand-text-muted">{t('walletBalance')}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-4">
                                    <TrendingUp className="w-5 h-5 text-brand-success mb-2" />
                                    <div className="text-lg font-bold text-brand-text-primary">156</div>
                                    <div className="text-xs text-brand-text-muted">{t('ordersCompleted')}</div>
                                </div>
                            </div>
                            {/* Mini Chart Bars */}
                            <div className="flex items-end gap-1.5 h-20 mb-4">
                                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 rounded-t-md bg-gradient-to-t from-brand-primary/40 to-brand-primary/80"
                                        style={{ height: `${h}%` }}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center justify-between text-xs text-brand-text-muted">
                                <span>{t('last7days')}</span>
                                <span className="text-brand-success font-medium">+12.5%</span>
                            </div>
                        </div>

                        {/* Floating Card 1 */}
                        <div className="absolute -top-4 -right-4 bg-brand-surface border border-brand-border rounded-xl p-3 shadow-card animate-float z-20">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-brand-success/20 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-brand-success" />
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-brand-text-primary">{t('autoDeliveryCard')}</div>
                                    <div className="text-[10px] text-brand-text-muted">{t('autoDeliveryDesc')}</div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Card 2 */}
                        <div className="absolute -bottom-4 -left-4 bg-brand-surface border border-brand-border rounded-xl p-3 shadow-card animate-float-delayed z-20">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center">
                                    <BarChart3 className="w-4 h-4 text-brand-primary" />
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-brand-text-primary">+2,450 {t('ordersCount')}</div>
                                    <div className="text-[10px] text-brand-text-muted">{t('ordersThisMonth')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
