'use client';

import { useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/shared/ProductCard';
import { products, categories } from '@/lib/mock-data';
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react';

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [sortBy, setSortBy] = useState('newest');
    const [showFilters, setShowFilters] = useState(false);

    const category = categories.find(c => c.slug === slug);
    const categoryProducts = category
        ? products.filter(p => p.categoryId === category.id)
        : products;

    const displayProducts = [...categoryProducts].sort((a, b) => {
        if (sortBy === 'price-low') return a.price - b.price;
        if (sortBy === 'price-high') return b.price - a.price;
        if (sortBy === 'best-selling') return b.soldCount - a.soldCount;
        if (sortBy === 'rating') return b.ratingAverage - a.ratingAverage;
        return 0;
    });

    return (
        <>
            <Header />
            <main className="min-h-screen">
                <div className="max-w-container mx-auto px-4 py-6">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-brand-text-muted mb-6">
                        <Link href="/" className="hover:text-brand-primary transition-colors">Trang chủ</Link>
                        <span>/</span>
                        <Link href="/danh-muc" className="hover:text-brand-primary transition-colors">Danh mục</Link>
                        {category && (
                            <>
                                <span>/</span>
                                <span className="text-brand-text-primary">{category.name}</span>
                            </>
                        )}
                    </nav>

                    <div className="flex gap-6">
                        {/* Filter Sidebar - Desktop */}
                        <aside className="hidden lg:block w-72 shrink-0">
                            <div className="card sticky top-32 space-y-6">
                                <h3 className="text-sm font-semibold text-brand-text-primary">Bộ lọc</h3>

                                {/* Categories */}
                                <div>
                                    <h4 className="text-xs font-medium text-brand-text-muted mb-3 uppercase tracking-wider">Danh mục</h4>
                                    <div className="space-y-2">
                                        {categories.map(cat => (
                                            <Link
                                                key={cat.id}
                                                href={`/danh-muc/${cat.slug}`}
                                                className={`flex items-center justify-between text-sm py-1.5 px-2 rounded-lg transition-colors ${category?.id === cat.id
                                                    ? 'bg-brand-primary/10 text-brand-primary font-medium'
                                                    : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2'
                                                    }`}
                                            >
                                                <span>{cat.name}</span>
                                                <span className="text-xs text-brand-text-muted">{cat.productCount}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>

                                {/* Price Range */}
                                <div>
                                    <h4 className="text-xs font-medium text-brand-text-muted mb-3 uppercase tracking-wider">Khoảng giá</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="number" placeholder="Từ" className="input-field !py-2 text-sm" />
                                        <input type="number" placeholder="Đến" className="input-field !py-2 text-sm" />
                                    </div>
                                </div>

                                {/* Delivery Type */}
                                <div>
                                    <h4 className="text-xs font-medium text-brand-text-muted mb-3 uppercase tracking-wider">Giao hàng</h4>
                                    <div className="space-y-2">
                                        {['Tự động', 'Thủ công'].map((type, i) => (
                                            <label key={i} className="flex items-center gap-2 text-sm text-brand-text-secondary cursor-pointer">
                                                <input type="checkbox" className="rounded border-brand-border bg-brand-surface-2 text-brand-primary focus:ring-brand-primary/30" />
                                                {type}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Rating */}
                                <div>
                                    <h4 className="text-xs font-medium text-brand-text-muted mb-3 uppercase tracking-wider">Đánh giá</h4>
                                    <div className="space-y-2">
                                        {['4 sao trở lên', '3 sao trở lên', '2 sao trở lên'].map((r, i) => (
                                            <label key={i} className="flex items-center gap-2 text-sm text-brand-text-secondary cursor-pointer">
                                                <input type="radio" name="rating" className="border-brand-border bg-brand-surface-2 text-brand-primary focus:ring-brand-primary/30" />
                                                {r}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Stock */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm text-brand-text-secondary cursor-pointer">
                                        <input type="checkbox" className="rounded border-brand-border bg-brand-surface-2 text-brand-primary focus:ring-brand-primary/30" />
                                        Chỉ hiển thị còn hàng
                                    </label>
                                </div>
                            </div>
                        </aside>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
                                <div>
                                    <h1 className="text-xl font-bold text-brand-text-primary">
                                        {category ? category.name : 'Tất cả sản phẩm'}
                                    </h1>
                                    <p className="text-sm text-brand-text-muted mt-1">
                                        {displayProducts.length} sản phẩm
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Mobile Filter */}
                                    <button
                                        onClick={() => setShowFilters(true)}
                                        className="lg:hidden btn-secondary !px-3 !py-2 text-sm flex items-center gap-1.5"
                                    >
                                        <SlidersHorizontal className="w-4 h-4" /> Lọc
                                    </button>

                                    {/* Sort */}
                                    <div className="relative">
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            className="input-field !py-2 text-sm pr-8 appearance-none cursor-pointer min-w-[120px] sm:min-w-[160px]"
                                        >
                                            <option value="newest">Mới nhất</option>
                                            <option value="best-selling">Bán chạy</option>
                                            <option value="price-low">Giá thấp → cao</option>
                                            <option value="price-high">Giá cao → thấp</option>
                                            <option value="rating">Đánh giá cao</option>
                                        </select>
                                        <ChevronDown className="w-4 h-4 text-brand-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Product Grid */}
                            {displayProducts.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-5">
                                    {displayProducts.map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                            ) : (
                                <div className="card text-center py-16">
                                    <div className="text-4xl mb-4">📦</div>
                                    <h3 className="text-lg font-semibold text-brand-text-primary mb-2">Chưa có sản phẩm phù hợp</h3>
                                    <p className="text-sm text-brand-text-secondary">Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc để xem thêm kết quả khác.</p>
                                </div>
                            )}

                            {/* Pagination */}
                            <div className="flex items-center justify-center gap-2 mt-8">
                                {[1, 2, 3, '...', 10].map((page, i) => (
                                    <button
                                        key={i}
                                        className={`min-w-[40px] h-10 rounded-xl text-sm font-medium transition-all ${page === 1
                                            ? 'bg-brand-primary text-white shadow-glow-primary'
                                            : 'bg-brand-surface border border-brand-border text-brand-text-secondary hover:border-brand-primary/30'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />

            {/* Mobile Filter Drawer */}
            {showFilters && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setShowFilters(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-[320px] bg-brand-surface border-l border-brand-border p-4 md:p-6 overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Bộ lọc</h3>
                            <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-brand-surface-2 rounded-lg">
                                <X className="w-5 h-5 text-brand-text-muted" />
                            </button>
                        </div>
                        <p className="text-sm text-brand-text-muted">Các bộ lọc sẽ hiển thị ở đây trên mobile.</p>
                    </div>
                </div>
            )}
        </>
    );
}
