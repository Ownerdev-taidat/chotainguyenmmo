'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import {
    CheckCircle, Star, Package, ShieldCheck, MessageSquare, Calendar,
    ChevronDown, Loader2, AlertCircle, Store, ExternalLink, AlertTriangle, User
} from 'lucide-react';
import { useCurrency } from '@/lib/currency';

function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return 'Hôm nay';
    if (days < 30) return `${days} ngày trước`;
    if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
    return `${Math.floor(days / 365)} năm trước`;
}

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const { formatVnd: formatCurrency } = useCurrency();
    const [shop, setShop] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/v1/shops/${slug}`)
            .then(r => r.json())
            .then(d => { if (d.success) setShop(d.data); else setError(d.message); })
            .catch(() => setError('Không thể tải thông tin gian hàng'))
            .finally(() => setLoading(false));
    }, [slug]);

    if (loading) return (
        <><Header /><div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-primary" /></div><Footer /></>
    );

    if (error || !shop) return (
        <><Header /><div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <AlertCircle className="w-12 h-12 text-brand-danger" />
            <p className="text-brand-text-secondary">{error || 'Gian hàng không tồn tại'}</p>
            <Link href="/" className="btn-primary">Về trang chủ</Link>
        </div><Footer /></>
    );

    const products = shop.products || [];

    return (
        <>
            <Header />
            <main className="min-h-screen">
                {/* Banner */}
                <div className="relative h-36 md:h-48 bg-gradient-to-r from-brand-primary/20 via-brand-secondary/10 to-brand-primary/20">
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-bg to-transparent" />
                </div>

                <div className="max-w-container mx-auto px-4 -mt-12 relative z-10">
                    {/* Shop Header: Owner Profile (LEFT) + Shop Stats (RIGHT) */}
                    <div className="grid lg:grid-cols-3 gap-6 mb-8">
                        {/* Seller Profile Card — LEFT */}
                        <div className="card flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 border-2 border-brand-border flex items-center justify-center mb-2">
                                {shop.owner?.avatarUrl ? (
                                    <img src={shop.owner.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <User className="w-8 h-8 text-brand-text-muted" />
                                )}
                            </div>
                            <h3 className="text-sm font-bold text-brand-text-primary">@{shop.owner?.username || 'N/A'}</h3>
                            <p className="text-[10px] text-brand-success mb-3 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-brand-success rounded-full inline-block" />
                                {shop.owner?.lastLoginAt ? `Online ${timeAgo(shop.owner.lastLoginAt)}` : 'Offline'}
                            </p>
                            <div className="w-full space-y-1.5 text-xs mb-3">
                                <div className="flex justify-between py-1 border-b border-brand-border">
                                    <span className="text-brand-text-muted">Tham gia</span>
                                    <span className="font-medium text-brand-text-primary">{new Date(shop.joinedAt).toLocaleDateString('vi-VN')}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-brand-border">
                                    <span className="text-brand-text-muted">Tổng đơn</span>
                                    <span className="font-medium text-brand-text-primary">{shop.successfulOrdersCount}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-brand-border">
                                    <span className="text-brand-text-muted">Đánh giá</span>
                                    <span className="font-medium text-brand-text-primary">{shop.ratingAverage || 0} ⭐ ({shop.ratingCount || 0})</span>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full">
                                <Link href={`/shop/${slug}`} className="btn-primary flex-1 !py-2 text-xs flex items-center justify-center gap-1">
                                    <Store className="w-3.5 h-3.5" /> Gian hàng
                                </Link>
                                <button
                                    onClick={() => {
                                        const ownerId = shop.owner?.id || shop.ownerId;
                                        if (ownerId) {
                                            window.location.href = `/dashboard/tin-nhan?shop=${ownerId}`;
                                        }
                                    }}
                                    className="btn-secondary flex-1 !py-2 text-xs flex items-center justify-center gap-1"
                                >
                                    <MessageSquare className="w-3.5 h-3.5" /> Nhắn tin
                                </button>
                            </div>
                        </div>

                        {/* Shop Info — RIGHT */}
                        <div className="lg:col-span-2 card">
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shrink-0">
                                    {shop.logoUrl ? (
                                        <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover rounded-2xl" />
                                    ) : (
                                        <span className="text-2xl font-bold text-white">{shop.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h1 className="text-lg font-bold text-brand-text-primary truncate">{shop.name}</h1>
                                        {shop.verified && (
                                            <span className="badge-primary flex items-center gap-1 text-[10px] shrink-0">
                                                <CheckCircle className="w-3 h-3" /> Đã xác minh
                                            </span>
                                        )}
                                    </div>
                                    {shop.shortDescription && (
                                        <p className="text-xs text-brand-text-secondary mb-3">{shop.shortDescription}</p>
                                    )}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { icon: Package, label: 'Sản phẩm', value: shop.productCount },
                                            { icon: ShieldCheck, label: 'Đơn thành công', value: shop.successfulOrdersCount },
                                            { icon: Star, label: 'Đánh giá', value: `${shop.ratingAverage || 0} ⭐` },
                                            { icon: MessageSquare, label: 'Phản hồi', value: `${shop.responseRate || 0}%` },
                                        ].map((s, i) => (
                                            <div key={i} className="bg-brand-surface-2 rounded-lg py-2 px-2 text-center">
                                                <div className="text-xs font-bold text-brand-text-primary">{s.value}</div>
                                                <div className="text-[10px] text-brand-text-muted">{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Warning for buyers */}
                    <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-xl px-4 py-3 mb-6 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
                        <p className="text-xs text-brand-text-secondary">
                            <strong className="text-brand-warning">Cảnh báo:</strong> Giao dịch ngoài sàn ChoTaiNguyen có nguy cơ bị lừa đảo. Sàn <strong>hoàn toàn không chịu trách nhiệm</strong> cho các giao dịch ngoài hệ thống. Hãy luôn mua hàng qua sàn để được bảo vệ quyền lợi.
                        </p>
                    </div>

                    {/* Products */}
                    <div className="mb-12">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-brand-text-primary">Sản phẩm ({products.length})</h2>
                        </div>
                        {products.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {products.map((p: any) => {
                                    const minPrice = p.variants?.length > 0
                                        ? Math.min(...p.variants.map((v: any) => v.price))
                                        : p.price;
                                    return (
                                        <Link key={p.id} href={`/san-pham/${p.slug}`} className="card !p-0 overflow-hidden group hover:shadow-card-hover transition-all">
                                            <div className="h-36 bg-brand-surface-2 flex items-center justify-center overflow-hidden">
                                                {p.images?.[0]?.url ? (
                                                    <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                ) : (
                                                    <Package className="w-10 h-10 text-brand-text-muted/30" />
                                                )}
                                            </div>
                                            <div className="p-3">
                                                <h3 className="text-xs font-medium text-brand-text-primary line-clamp-2 mb-1">{p.name}</h3>
                                                <div className="text-sm font-bold text-brand-primary">{formatCurrency(minPrice)}</div>
                                                <div className="flex items-center gap-2 mt-1 text-[10px] text-brand-text-muted">
                                                    <span>Đã bán {p.soldCount}</span>
                                                    <span>Kho: {p.stockCountCached}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="card text-center py-12">
                                <Package className="w-10 h-10 text-brand-text-muted/30 mx-auto mb-3" />
                                <h3 className="text-sm font-semibold text-brand-text-primary mb-1">Chưa có sản phẩm</h3>
                                <p className="text-xs text-brand-text-secondary">Gian hàng chưa đăng sản phẩm nào.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
