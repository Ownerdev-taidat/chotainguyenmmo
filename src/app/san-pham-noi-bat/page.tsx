'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Star, TrendingUp, Flame, ShoppingCart, Zap, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';

interface ApiProduct {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice?: number;
    soldCount: number;
    ratingAverage: number;
    ratingCount: number;
    stockCountCached: number;
    deliveryType: string;
    isFeatured: boolean;
    isHot: boolean;
    category?: { name: string; slug: string };
    shop?: { name: string; slug: string; verified: boolean; logoUrl?: string };
    images?: { url: string }[];
}

const PRODUCTS_PER_PAGE = 60;

export default function FeaturedProductsPage() {
    const { t } = useI18n();

    // Hot/Featured products
    const [hotProducts, setHotProducts] = useState<ApiProduct[]>([]);
    // Best selling
    const [bestSelling, setBestSelling] = useState<ApiProduct[]>([]);
    // Top rated
    const [topRated, setTopRated] = useState<ApiProduct[]>([]);
    // All products with pagination
    const [allProducts, setAllProducts] = useState<ApiProduct[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch showcase sections (hot, bestselling, top rated)
    useEffect(() => {
        // Hot / Featured
        fetch('/api/v1/products?limit=8&featured=true&sort=homepage')
            .then(r => r.json())
            .then(d => { if (d.success) setHotProducts(d.data.products || []); })
            .catch(() => {});

        // Best selling
        fetch('/api/v1/products?limit=8&sort=bestselling')
            .then(r => r.json())
            .then(d => { if (d.success) setBestSelling(d.data.products || []); })
            .catch(() => {});

        // Top rated
        fetch('/api/v1/products?limit=8&sort=rating')
            .then(r => r.json())
            .then(d => { if (d.success) setTopRated(d.data.products || []); })
            .catch(() => {});
    }, []);

    // Fetch all products with pagination
    const fetchAll = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/products?page=${p}&limit=${PRODUCTS_PER_PAGE}&sort=homepage`);
            const data = await res.json();
            if (data.success) {
                setAllProducts(data.data.products || []);
                setTotalPages(data.data.pagination.totalPages || 1);
                setTotal(data.data.pagination.total || 0);
            }
        } catch {}
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(page); }, [page, fetchAll]);

    const goToPage = (p: number) => {
        if (p < 1 || p > totalPages) return;
        setPage(p);
        document.getElementById('tat-ca-san-pham')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg">
                {/* Hero Banner */}
                <div className="bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-primary/80 py-12">
                    <div className="max-w-container mx-auto px-4 text-center">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                            🔥 {t('featuredProductsTitle')}
                        </h1>
                        <p className="text-white/80 max-w-2xl mx-auto">
                            {t('featuredProductsSubtitle')}
                        </p>
                    </div>
                </div>

                <div className="max-w-container mx-auto px-4 py-10 space-y-14">
                    {/* Hot Products */}
                    {hotProducts.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                                <Flame className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-brand-text-primary">🔥 Hot</h2>
                                <p className="text-sm text-brand-text-muted">{t('featuredProductsSubtitle')}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                            {hotProducts.map((p) => <ProductAPICard key={p.id} product={p} />)}
                        </div>
                    </section>
                    )}

                    {/* Best Selling */}
                    {bestSelling.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-brand-text-primary">{t('bestSelling')}</h2>
                                <p className="text-sm text-brand-text-muted">Top {t('productCount').toLowerCase()}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                            {bestSelling.map((p) => <ProductAPICard key={p.id} product={p} />)}
                        </div>
                    </section>
                    )}

                    {/* Top Rated */}
                    {topRated.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
                                <Star className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-brand-text-primary">⭐ Top Rated</h2>
                                <p className="text-sm text-brand-text-muted">{t('featuredProductsSubtitle')}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                            {topRated.map((p) => <ProductAPICard key={p.id} product={p} />)}
                        </div>
                    </section>
                    )}

                    {/* All Products — paginated */}
                    <section id="tat-ca-san-pham">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-brand-text-primary">{t('viewAllBtn').replace(' →', '')} ({total})</h2>
                                <p className="text-sm text-brand-text-muted">{PRODUCTS_PER_PAGE} {t('productCount').toLowerCase()} / {t('productCount').toLowerCase().includes('page') ? '' : 'page'}</p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
                            </div>
                        ) : allProducts.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {allProducts.map((p) => <ProductAPICard key={p.id} product={p} />)}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-brand-text-muted">
                                {t('noProducts')}
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <button onClick={() => goToPage(page - 1)} disabled={page === 1} className="p-2 rounded-lg border border-brand-border hover:bg-brand-surface-2 disabled:opacity-30 transition-all">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                    let p: number;
                                    if (totalPages <= 7) p = i + 1;
                                    else if (page <= 4) p = i + 1;
                                    else if (page >= totalPages - 3) p = totalPages - 6 + i;
                                    else p = page - 3 + i;
                                    return (
                                        <button key={p} onClick={() => goToPage(p)} className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${page === p ? 'bg-brand-primary text-white' : 'border border-brand-border text-brand-text-secondary hover:bg-brand-surface-2'}`}>
                                            {p}
                                        </button>
                                    );
                                })}
                                <button onClick={() => goToPage(page + 1)} disabled={page === totalPages} className="p-2 rounded-lg border border-brand-border hover:bg-brand-surface-2 disabled:opacity-30 transition-all">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </section>
                </div>
            </main>
            <Footer />
        </>
    );
}

// Mini product card for API data (similar to ProductCard but for ApiProduct interface)
function ProductAPICard({ product }: { product: ApiProduct }) {
    const { t } = useI18n();
    const [imgError, setImgError] = useState(false);
    const imgUrl = product.images?.[0]?.url;

    return (
        <div className="group bg-brand-surface border border-brand-border rounded-2xl overflow-hidden hover:border-brand-primary/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
            <div className="relative h-40 bg-gradient-to-br from-brand-surface-2 to-brand-surface-3 flex items-center justify-center overflow-hidden">
                {imgUrl && !imgError ? (
                    <img src={imgUrl} alt={product.name} className="w-20 h-20 object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300" onError={() => setImgError(true)} />
                ) : (
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                        <ShoppingCart className="w-8 h-8 text-brand-primary/60" />
                    </div>
                )}
                <div className="absolute inset-0 bg-brand-bg/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <Link href={`/san-pham/${product.slug}`} className="flex items-center gap-1.5 bg-brand-primary text-white text-sm font-medium px-4 py-2 rounded-xl hover:brightness-110 transition-all">
                        <Eye className="w-4 h-4" /> {t('viewDetail')}
                    </Link>
                </div>
            </div>
            <div className="p-4">
                <div className="text-[11px] text-brand-text-muted font-medium mb-1.5">{product.category?.name || ''}</div>
                <Link href={`/san-pham/${product.slug}`}>
                    <h3 className="text-sm font-semibold text-brand-text-primary line-clamp-2 hover:text-brand-primary transition-colors mb-2 leading-snug min-h-[2.5em]">{product.name}</h3>
                </Link>
                <div className="flex items-center gap-2 text-[11px] text-brand-text-muted mb-3">
                    <span className="flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-[8px] text-white font-bold">{product.shop?.name?.charAt(0) || '?'}</span>
                        <span className="truncate max-w-[100px]">{product.shop?.name || ''}</span>
                    </span>
                    <span className="flex items-center gap-0.5 text-brand-warning">
                        <Star className="w-3 h-3 fill-brand-warning" />{product.ratingAverage || 0}
                    </span>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold text-brand-primary">{formatCurrency(product.price)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-brand-text-muted mb-3">
                    <span>{t('sold')} {product.soldCount}</span>
                    <span className="flex items-center gap-1">
                        {product.deliveryType === 'AUTO' ? (
                            <><Zap className="w-3 h-3 text-brand-info" /><span className="text-brand-info">{t('autoDelivery')}</span></>
                        ) : (
                            <span>{t('manualDelivery')}</span>
                        )}
                    </span>
                    <span>{t('inStock')}: {product.stockCountCached}</span>
                </div>
                <Link href={`/san-pham/${product.slug}`} className="block w-full text-center bg-brand-primary/10 text-brand-primary text-sm font-medium py-2 rounded-xl hover:bg-brand-primary hover:text-white transition-all">
                    {t('buyNow')}
                </Link>
            </div>
        </div>
    );
}
