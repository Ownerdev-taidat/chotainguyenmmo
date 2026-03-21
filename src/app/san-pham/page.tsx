'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/shared/ProductCard';
import type { Product } from '@/lib/mock-data';
import { Search, SlidersHorizontal } from 'lucide-react';

function SearchResults() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';
    const categorySlug = searchParams.get('category') || '';

    const [products, setProducts] = useState<Product[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState(searchParams.get('sort') || 'newest');

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (categorySlug) params.set('category', categorySlug);
        params.set('sort', sort);
        params.set('limit', '40');

        fetch(`/api/v1/products?${params.toString()}`)
            .then(r => r.json())
            .then(d => {
                if (d.success && d.data?.products) {
                    // Map API products to ProductCard's Product interface
                    const mapped: Product[] = d.data.products.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        slug: p.slug,
                        shortDescription: p.shortDescription || '',
                        description: p.description || '',
                        price: p.price,
                        compareAtPrice: p.originalPrice || undefined,
                        categoryId: p.categoryId || '',
                        categoryName: p.category?.name || '',
                        shopId: p.shopId || '',
                        shopName: p.shop?.name || '',
                        shopVerified: p.shop?.verified || false,
                        images: p.images?.map((img: any) => typeof img === 'string' ? img : img.url) || [],
                        status: p.status || 'ACTIVE',
                        deliveryType: p.autoDelivery ? 'auto' : 'manual',
                        stockCount: p.stock ?? 0,
                        soldCount: p.soldCount || 0,
                        ratingAverage: p.ratingAverage || 0,
                        ratingCount: p.ratingCount || 0,
                        isFeatured: p.isFeatured || false,
                        isHot: p.isHot || false,
                        badges: p.autoDelivery ? ['Tự động'] : [],
                        complaintWindowHours: p.complaintWindowHours || 72,
                        warrantyPolicy: p.warrantyPolicy || '',
                        supportPolicy: p.supportPolicy || '',
                        createdAt: p.createdAt || '',
                        updatedAt: p.updatedAt || '',
                    }));
                    setProducts(mapped);
                    setTotal(d.data.pagination?.total || mapped.length);
                } else {
                    setProducts([]);
                    setTotal(0);
                }
            })
            .catch(() => { setProducts([]); setTotal(0); })
            .finally(() => setLoading(false));
    }, [query, categorySlug, sort]);

    const sortOptions = [
        { key: 'rating', label: 'Phổ biến' },
        { key: 'newest', label: 'Mới nhất' },
        { key: 'price_asc', label: 'Giá thấp' },
        { key: 'price_desc', label: 'Giá cao' },
        { key: 'bestselling', label: 'Bán chạy' },
    ];

    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                    {/* Search Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <Search className="w-6 h-6 text-brand-primary" />
                            <h1 className="text-2xl font-bold text-brand-text-primary">
                                {query ? `Kết quả tìm kiếm: "${query}"` : 'Tất cả sản phẩm'}
                            </h1>
                        </div>
                        <p className="text-sm text-brand-text-muted">
                            Tìm thấy <span className="font-semibold text-brand-primary">{total}</span> sản phẩm
                        </p>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex items-center gap-3 mb-6 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-brand-text-muted">
                            <SlidersHorizontal className="w-4 h-4" />
                            <span>Sắp xếp:</span>
                        </div>
                        {sortOptions.map((opt) => (
                            <button
                                key={opt.key}
                                onClick={() => setSort(opt.key)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                    sort === opt.key
                                        ? 'border-brand-primary text-brand-primary bg-brand-primary/5'
                                        : 'border-brand-border text-brand-text-secondary hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Results */}
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
                        </div>
                    ) : products.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {products.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <Search className="w-16 h-16 text-brand-text-muted/30 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-brand-text-primary mb-2">Không tìm thấy sản phẩm</h3>
                            <p className="text-sm text-brand-text-muted">
                                Thử tìm kiếm với từ khóa khác hoặc <a href="/san-pham" className="text-brand-primary hover:underline">xem tất cả sản phẩm</a>.
                            </p>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
            </div>
        }>
            <SearchResults />
        </Suspense>
    );
}
