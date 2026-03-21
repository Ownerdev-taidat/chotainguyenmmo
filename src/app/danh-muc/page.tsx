'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/shared/ProductCard';
import { ArrowRight, UserCircle, AppWindow, Brain, Mail, Share2, Globe, Layers, MoreHorizontal } from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
    UserCircle, AppWindow, Brain, Mail, Share2, Globe, Layers, MoreHorizontal,
};

interface ApiCategory {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    _count: { products: number };
}

export default function AllCategoriesPage() {
    const [categories, setCategories] = useState<ApiCategory[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        // Fetch real categories from API
        fetch('/api/v1/categories')
            .then(r => r.json())
            .then(d => { if (d.success) setCategories(d.data || []); })
            .catch(() => {});

        // Fetch products and map to ProductCard format
        fetch('/api/v1/products?limit=20')
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    const mapped = (d.data?.products || []).map((p: any) => ({
                        ...p,
                        categoryName: p.category?.name || '',
                        shopName: p.shop?.name || '',
                        shopVerified: p.shop?.verified || false,
                        images: (p.images || []).map((img: any) => typeof img === 'string' ? img : img.url),
                        badges: p.badges || [],
                        ratingAverage: p.ratingAverage || 0,
                        soldCount: p.soldCount || 0,
                        stockCount: p.stockCount || 0,
                        deliveryType: p.deliveryType || 'auto',
                    }));
                    setProducts(mapped);
                }
            })
            .catch(() => {});
    }, []);

    return (
        <>
            <Header />
            <main className="min-h-screen">
                <div className="max-w-container mx-auto px-4 py-8">
                    <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Tất cả danh mục</h1>
                    <p className="text-brand-text-secondary mb-8">
                        Tìm nhanh sản phẩm theo nhóm tài nguyên số bạn cần.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                        {categories.map((cat) => {
                            const Icon = iconMap[cat.icon || ''] || Layers;
                            return (
                                <Link
                                    key={cat.id}
                                    href={`/danh-muc/${cat.slug}`}
                                    className="group bg-brand-surface border border-brand-border rounded-2xl p-5 hover:border-brand-primary/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 flex items-center gap-4"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary/15 to-brand-secondary/15 flex items-center justify-center shrink-0 group-hover:from-brand-primary/25 group-hover:to-brand-secondary/25 transition-all">
                                        <Icon className="w-6 h-6 text-brand-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-brand-text-primary mb-0.5 group-hover:text-brand-primary transition-colors">
                                            {cat.name}
                                        </h3>
                                        <p className="text-xs text-brand-text-muted">{cat._count?.products || 0} sản phẩm</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-brand-text-muted group-hover:text-brand-primary group-hover:translate-x-1 transition-all shrink-0" />
                                </Link>
                            );
                        })}
                    </div>

                    <h2 className="text-xl font-bold text-brand-text-primary mb-6">Tất cả sản phẩm</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
