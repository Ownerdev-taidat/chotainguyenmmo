'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Star, CheckCircle, Package, ShieldCheck, MessageSquare } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface ShopData {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    shortDescription?: string;
    verified: boolean;
    productCount?: number;
    successfulOrdersCount?: number;
    ratingAverage?: number;
    ratingCount?: number;
    responseRate?: number;
    _count?: { products: number };
}

export default function FeaturedShops() {
    const { t } = useI18n();
    const [shops, setShops] = useState<ShopData[]>([]);

    useEffect(() => {
        fetch('/api/v1/shops?limit=4&sort=orders')
            .then(r => r.json())
            .then(d => { if (d.success) setShops(d.data?.shops || d.data || []); })
            .catch(() => {});
    }, []);

    if (shops.length === 0) return null;

    return (
        <section className="section-padding">
            <div className="max-w-container mx-auto px-4">
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">{t('featuredShopsTitle')}</h2>
                        <p className="text-brand-text-secondary">
                            {t('featuredShopsSubtitle')}
                        </p>
                    </div>
                    <Link href="/gian-hang" className="hidden md:flex items-center gap-1.5 text-sm text-brand-primary font-medium hover:gap-2.5 transition-all shrink-0">
                        {t('viewAllBtn')} <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {shops.map((shop) => (
                        <div key={shop.id} className="group bg-brand-surface border border-brand-border rounded-2xl p-5 hover:border-brand-primary/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center shrink-0 border border-brand-border overflow-hidden">
                                    {shop.logoUrl ? (
                                        <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xl font-bold gradient-text">{shop.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-semibold text-brand-text-primary truncate">{shop.name}</h3>
                                        {shop.verified && <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />}
                                    </div>
                                    <p className="text-xs text-brand-text-muted line-clamp-2 mb-3">{shop.shortDescription || t('shopDefaultDesc')}</p>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                            <Package className="w-3.5 h-3.5 text-brand-text-muted" />
                                            <span>{shop._count?.products || shop.productCount || 0} {t('productsCount')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                            <ShieldCheck className="w-3.5 h-3.5 text-brand-text-muted" />
                                            <span>{shop.successfulOrdersCount || 0} {t('successfulOrders')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                            <Star className="w-3.5 h-3.5 text-brand-warning fill-brand-warning" />
                                            <span>{shop.ratingAverage || 0} ({shop.ratingCount || 0})</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                            <MessageSquare className="w-3.5 h-3.5 text-brand-text-muted" />
                                            <span>{t('responseRate')} {shop.responseRate || 0}%</span>
                                        </div>
                                    </div>
                                    <Link href={`/shop/${shop.slug}`} className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-medium hover:gap-2.5 transition-all">
                                        {t('viewShop')} <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
