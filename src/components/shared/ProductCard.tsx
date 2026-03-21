'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, ShoppingCart, Heart, Zap, Eye } from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { useI18n } from '@/lib/i18n';
import type { Product } from '@/lib/mock-data';

interface ProductCardProps {
    product: Product;
    compact?: boolean;
}

export default function ProductCard({ product, compact = false }: ProductCardProps) {
    const [imgError, setImgError] = useState(false);
    const { t } = useI18n();
    const { formatVnd: formatCurrency } = useCurrency();
    const badgeColors: Record<string, string> = {
        'Bán chạy': 'bg-brand-danger/90',
        'Nổi bật': 'bg-brand-primary/90',
        'Mới': 'bg-brand-success/90',
        'Uy tín': 'bg-brand-secondary/90',
        'Tự động': 'bg-brand-info/20 text-brand-info',
        'Còn hàng': 'bg-brand-success/20 text-brand-success',
        'Thủ công': 'bg-brand-warning/20 text-brand-warning',
    };

    return (
        <div className="group bg-brand-surface border border-brand-border rounded-2xl overflow-hidden hover:border-brand-primary/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
            {/* Image Area */}
            <div className="relative h-40 bg-gradient-to-br from-brand-surface-2 to-brand-surface-3 flex items-center justify-center overflow-hidden">
                {product.images?.[0] && !imgError ? (
                    <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-20 h-20 object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                        <ShoppingCart className="w-8 h-8 text-brand-primary/60" />
                    </div>
                )}

                {/* Badges */}
                {(product.badges?.length ?? 0) > 0 && (
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                        {product.badges.slice(0, 2).map((badge, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${badgeColors[badge] || 'bg-brand-surface-3 text-brand-text-secondary'}`}>
                                {badge}
                            </span>
                        ))}
                    </div>
                )}

                {/* Wishlist */}
                <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-brand-bg/60 backdrop-blur-sm flex items-center justify-center text-brand-text-muted hover:text-brand-danger hover:bg-brand-bg/80 opacity-0 group-hover:opacity-100 transition-all">
                    <Heart className="w-4 h-4" />
                </button>

                {/* Quick View Overlay */}
                <div className="absolute inset-0 bg-brand-bg/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <Link
                        href={`/san-pham/${product.slug}`}
                        className="flex items-center gap-1.5 bg-brand-primary text-white text-sm font-medium px-4 py-2 rounded-xl hover:brightness-110 transition-all"
                    >
                        <Eye className="w-4 h-4" /> {t('viewDetail')}
                    </Link>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Category */}
                <div className="text-[11px] text-brand-text-muted font-medium mb-1.5">{product.categoryName}</div>

                {/* Title */}
                <Link href={`/san-pham/${product.slug}`}>
                    <h3 className="text-sm font-semibold text-brand-text-primary line-clamp-2 hover:text-brand-primary transition-colors mb-2 leading-snug min-h-[2.5em]">
                        {product.name}
                    </h3>
                </Link>

                {/* Seller & Rating */}
                <div className="flex items-center gap-2 text-[11px] text-brand-text-muted mb-3">
                    <span className="flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-[8px] text-white font-bold">
                            {product.shopName.charAt(0)}
                        </span>
                        <span className="truncate max-w-[100px]">{product.shopName}</span>
                    </span>
                    <span className="flex items-center gap-0.5 text-brand-warning">
                        <Star className="w-3 h-3 fill-brand-warning" />
                        {product.ratingAverage}
                    </span>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold text-brand-primary">{formatCurrency(product.price)}</span>
                    {product.compareAtPrice && (
                        <span className="text-xs text-brand-text-muted line-through">{formatCurrency(product.compareAtPrice)}</span>
                    )}
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-[11px] text-brand-text-muted mb-3">
                    <span>{t('sold')} {product.soldCount}</span>
                    <span className="flex items-center gap-1">
                        {product.deliveryType === 'auto' ? (
                            <>
                                <Zap className="w-3 h-3 text-brand-info" />
                                <span className="text-brand-info">{t('autoDelivery')}</span>
                            </>
                        ) : (
                            <span>{t('manualDelivery')}</span>
                        )}
                    </span>
                    <span>{t('inStock')}: {product.stockCount}</span>
                </div>

                {/* Action */}
                <Link
                    href={`/san-pham/${product.slug}`}
                    className="block w-full text-center bg-brand-primary/10 text-brand-primary text-sm font-medium py-2 rounded-xl hover:bg-brand-primary hover:text-white transition-all"
                >
                    {t('buyNow')}
                </Link>
            </div>
        </div>
    );
}
