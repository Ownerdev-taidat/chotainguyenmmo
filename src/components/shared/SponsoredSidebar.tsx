'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Star, Megaphone, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useCurrency } from '@/lib/currency';

export default function SponsoredSidebar() {
    const { t } = useI18n();
    const { formatVnd: formatCurrency } = useCurrency();
    const [ads, setAds] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/v1/ads/sponsored')
            .then(r => r.json())
            .then(d => { if (d.success && d.data?.length > 0) setAds(d.data); })
            .catch(() => {});
    }, []);

    if (ads.length === 0) return null;

    return (
        <section className="max-w-container mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-brand-primary" />
                    <h2 className="text-base font-bold text-brand-text-primary">{t('sponsoredProducts')}</h2>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {ads.map((ad, i) => {
                    const p = ad.product;
                    const minPrice = p.variants?.length > 0
                        ? Math.min(...p.variants.map((v: any) => v.price))
                        : p.price;
                    return (
                        <Link key={i} href={`/san-pham/${p.slug}`}
                            className="card !p-0 overflow-hidden group hover:shadow-card-hover transition-all">
                            <div className="relative">
                                <div className="h-32 bg-brand-surface-2 flex items-center justify-center overflow-hidden">
                                    {p.images?.[0]?.url ? (
                                        <img src={p.images[0].url} alt={p.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    ) : (
                                        <Package className="w-8 h-8 text-brand-text-muted/20" />
                                    )}
                                </div>
                                <span className="absolute top-1.5 left-1.5 text-[9px] bg-brand-primary/90 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium">
                                    <Star className="w-2.5 h-2.5 fill-white" /> {t('sponsored')}
                                </span>
                            </div>
                            <div className="p-2.5">
                                <h4 className="text-xs font-medium text-brand-text-primary line-clamp-2 mb-1 leading-snug">{p.name}</h4>
                                <div className="text-sm font-bold text-brand-primary">{formatCurrency(minPrice)}</div>
                                <div className="text-[10px] text-brand-text-muted mt-0.5">
                                    {p.shop?.name} · {t('sold')} {p.soldCount}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
