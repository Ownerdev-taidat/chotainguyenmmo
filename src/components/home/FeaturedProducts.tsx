'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ShoppingCart, Star, Zap, Eye, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { useI18n } from '@/lib/i18n';

const PRODUCTS_PER_PAGE = 60;

interface ApiProduct {
    id: string;
    name: string;
    slug: string;
    price: number;
    soldCount: number;
    ratingAverage: number;
    stockCountCached: number;
    deliveryType: string;
    isFeatured: boolean;
    category?: { name: string; slug: string };
    shop?: { name: string; slug: string; verified: boolean };
    images?: { url: string }[];
}

export default function FeaturedProducts() {
    const { t, tCat } = useI18n();
    const [products, setProducts] = useState<ApiProduct[]>([]);
    const { formatVnd: formatCurrency } = useCurrency();
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchProducts = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/products?page=${p}&limit=${PRODUCTS_PER_PAGE}&sort=homepage`);
            const data = await res.json();
            if (data.success) {
                setProducts(data.data.products || []);
                setTotalPages(data.data.pagination.totalPages || 1);
                setTotal(data.data.pagination.total || 0);
            }
        } catch { }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchProducts(page);

        // Auto-refresh every 12 hours to re-rank products based on latest ratings
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;
        const interval = setInterval(() => fetchProducts(page), TWELVE_HOURS);
        return () => clearInterval(interval);
    }, [page, fetchProducts]);

    const goToPage = (p: number) => {
        if (p < 1 || p > totalPages) return;
        setPage(p);
        // Scroll to section top
        document.getElementById('san-pham-noi-bat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push('...');
            for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                pages.push(i);
            }
            if (page < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <section className="section-padding bg-brand-surface/30">
            <div className="max-w-container mx-auto px-4">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 md:mb-10 gap-3">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">{t('featuredProductsTitle')}</h2>
                        <p className="text-brand-text-secondary">
                            {t('featuredProductsSubtitle')}
                        </p>
                    </div>
                    <Link href="/danh-muc" className="flex items-center gap-1 text-sm text-brand-primary font-medium hover:gap-2 transition-all shrink-0">
                        {t('viewAllBtn')} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {loading && products.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-8 h-8 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-brand-text-muted">{t('loadingProducts')}</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-12 text-brand-text-muted">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>{t('noProducts')}</p>
                    </div>
                ) : (
                    <>
                        <div className={`grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                            {products.map((p) => (
                                <div key={p.id} className="group bg-brand-surface border border-brand-border rounded-2xl overflow-hidden hover:border-brand-primary/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
                                    <div className="relative h-40 bg-gradient-to-br from-brand-surface-2 to-brand-surface-3 flex items-center justify-center overflow-hidden">
                                        {p.images?.[0]?.url ? (
                                            <img src={p.images[0].url} alt={p.name} className="w-20 h-20 object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                                                <ShoppingCart className="w-8 h-8 text-brand-primary/60" />
                                            </div>
                                        )}
                                        {p.isFeatured && (
                                            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white bg-brand-primary/90">{t('featured')}</span>
                                        )}
                                        <div className="absolute inset-0 bg-brand-bg/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                            <Link href={`/san-pham/${p.slug}`} className="flex items-center gap-1.5 bg-brand-primary text-white text-sm font-medium px-4 py-2 rounded-xl hover:brightness-110 transition-all">
                                                <Eye className="w-4 h-4" /> {t('viewDetail')}
                                            </Link>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="text-[11px] text-brand-text-muted font-medium mb-1.5">{tCat(p.category?.slug || '', p.category?.name || '')}</div>
                                        <Link href={`/san-pham/${p.slug}`}>
                                            <h3 className="text-sm font-semibold text-brand-text-primary line-clamp-2 hover:text-brand-primary transition-colors mb-2 leading-snug min-h-[2.5em]">{p.name}</h3>
                                        </Link>
                                        <div className="flex items-center gap-2 text-[11px] text-brand-text-muted mb-3">
                                            <span className="flex items-center gap-1">
                                                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-[8px] text-white font-bold">{p.shop?.name?.charAt(0)}</span>
                                                <span className="truncate max-w-[100px]">{p.shop?.name}</span>
                                            </span>
                                            <span className="flex items-center gap-0.5 text-brand-warning">
                                                <Star className="w-3 h-3 fill-brand-warning" />{p.ratingAverage || 0}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-2 mb-3">
                                            <span className="text-lg font-bold text-brand-primary">{formatCurrency(p.price)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-brand-text-muted mb-3">
                                            <span>{t('sold')} {p.soldCount}</span>
                                            <span className="flex items-center gap-1">
                                                {p.deliveryType === 'AUTO' ? (
                                                    <><Zap className="w-3 h-3 text-brand-info" /><span className="text-brand-info">{t('autoDelivery')}</span></>
                                                ) : (
                                                    <span>{t('manualDelivery')}</span>
                                                )}
                                            </span>
                                            <span>{t('inStock')}: {p.stockCountCached || 0}</span>
                                        </div>
                                        <Link href={`/san-pham/${p.slug}`} className="block w-full text-center bg-brand-primary/10 text-brand-primary text-sm font-medium py-2 rounded-xl hover:bg-brand-primary hover:text-white transition-all">
                                            {t('buyNow')}
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <button
                                    onClick={() => goToPage(page - 1)}
                                    disabled={page === 1}
                                    className="p-2 rounded-xl border border-brand-border hover:bg-brand-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4 text-brand-text-secondary" />
                                </button>

                                {getPageNumbers().map((p, i) => (
                                    p === '...' ? (
                                        <span key={`dots-${i}`} className="px-2 text-brand-text-muted">...</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => goToPage(p)}
                                            className={`min-w-[36px] h-9 rounded-xl text-sm font-medium transition-all ${
                                                p === page
                                                    ? 'bg-brand-primary text-white shadow-sm'
                                                    : 'border border-brand-border text-brand-text-secondary hover:bg-brand-surface-2'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                ))}

                                <button
                                    onClick={() => goToPage(page + 1)}
                                    disabled={page === totalPages}
                                    className="p-2 rounded-xl border border-brand-border hover:bg-brand-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight className="w-4 h-4 text-brand-text-secondary" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
