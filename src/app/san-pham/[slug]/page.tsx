'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency';
import { useI18n } from '@/lib/i18n';
import {
    Star, Heart, ShoppingCart, Zap, Clock, Shield, CheckCircle,
    ChevronRight, Package, MessageSquare, Minus, Plus, Store,
    Loader2, AlertCircle, CheckCircle2, X, Copy, ExternalLink
} from 'lucide-react';

interface ProductData {
    id: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    price: number;
    compareAtPrice: number | null;
    status: string;
    deliveryType: string;
    soldCount: number;
    stockCountCached: number;
    ratingAverage: number;
    ratingCount: number;
    isFeatured: boolean;
    category: { name: string; slug: string };
    shop: { name: string; slug: string; verified: boolean; logoUrl: string | null; productCount: number; ratingAverage: number; ownerId: string };
    images: { url: string; sortOrder: number }[];
    variants: { id: string; name: string; price: number; warrantyDays: number; isActive: boolean }[];
}

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const router = useRouter();
    const { user, updateUser } = useAuth();
    const { formatVnd: formatCurrency } = useCurrency();
    const { t } = useI18n();

    const [product, setProduct] = useState<ProductData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('description');

    // Purchase states
    const [showConfirm, setShowConfirm] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [purchaseResult, setPurchaseResult] = useState<{ success: boolean; message: string; order?: { orderCode: string; deliveredContent?: string; status: string }; newBalance?: number } | null>(null);
    const [copied, setCopied] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [favLoading, setFavLoading] = useState(false);

    // Voucher states
    const [voucherCode, setVoucherCode] = useState('');
    const [voucherApplying, setVoucherApplying] = useState(false);
    const [voucherResult, setVoucherResult] = useState<{ valid: boolean; discount: number; message: string } | null>(null);

    // API key state
    const [userApiKey, setUserApiKey] = useState<string | null>(null);

    // Review states
    const [reviews, setReviews] = useState<{ id: string; rating: number; comment: string | null; userName: string; userAvatar: string | null; createdAt: string }[]>([]);
    const [reviewStats, setReviewStats] = useState<{ avgRating: number; totalReviews: number }>({ avgRating: 0, totalReviews: 0 });
    const [reviewableOrders, setReviewableOrders] = useState<{ id: string; orderCode: string; createdAt: string }[]>([]);
    const [reviewForm, setReviewForm] = useState<{ orderId: string; rating: number; comment: string }>({ orderId: '', rating: 5, comment: '' });
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewMsg, setReviewMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Fetch user API key
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const token = localStorage.getItem('token') || '';
                const res = await fetch('/api/v1/api-keys?auto=1', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.newKey) {
                    setUserApiKey(data.newKey);
                } else if (data.success && data.data?.length > 0) {
                    setUserApiKey(data.data[0].keyPrefix + '...');
                }
            } catch { }
        })();
    }, [user]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/v1/products/${slug}`);
                const data = await res.json();
                if (data.success && data.data) {
                    setProduct(data.data);
                    if (data.data.variants?.length > 0) setSelectedVariant(data.data.variants[0].id);
                    // Check if favorited
                    if (user) {
                        try {
                            const token = localStorage.getItem('token') || '';
                            const favRes = await fetch('/api/v1/favorites', {
                                headers: { Authorization: `Bearer ${token}` },
                            });
                            const favData = await favRes.json();
                            if (favData.success) {
                                setIsFavorited(favData.data.some((f: any) => f.productId === data.data.id));
                            }
                        } catch { }
                    }
                } else {
                    setError(data.message || t('pdpNotFound'));
                }
            } catch {
                setError(t('pdpError'));
            }
            setLoading(false);
        })();
    }, [slug]);

    const toggleFavorite = async () => {
        if (!user) { router.push('/dang-nhap'); return; }
        if (favLoading || !product) return;
        setFavLoading(true);
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ productId: product.id }),
            });
            const data = await res.json();
            if (data.success) {
                setIsFavorited(data.favorited);
            }
        } catch { }
        setFavLoading(false);
    };

    // Fetch reviews when switching to reviews tab
    const fetchReviews = async (pid: string) => {
        try {
            const res = await fetch(`/api/v1/reviews?productId=${pid}`);
            const data = await res.json();
            if (data.success) {
                setReviews(data.data.reviews);
                setReviewStats({ avgRating: data.data.avgRating, totalReviews: data.data.totalReviews });
                return data.data.myReviewedOrderIds || [];
            }
        } catch { }
        return [];
    };

    // Fetch user's reviewable orders for this product
    const fetchReviewableOrders = async (pid: string, reviewedIds: string[]) => {
        if (!user) return;
        try {
            const token = localStorage.getItem('token') || '';
            // Fetch all user orders (completed/paid/delivered)
            const res = await fetch('/api/v1/orders?limit=50', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success && data.data) {
                const orders = data.data.orders || [];
                const reviewedSet = new Set(reviewedIds);
                // Filter: orders containing this product, completed status, not yet reviewed
                const eligible = orders.filter((o: any) =>
                    ['COMPLETED', 'PAID', 'DELIVERED'].includes(o.status) &&
                    !reviewedSet.has(o.id) &&
                    o.items?.some((item: any) => item.productId === pid || item.product?.slug === product?.slug)
                );
                setReviewableOrders(eligible.map((o: any) => ({ id: o.id, orderCode: o.orderCode, createdAt: o.createdAt })));
            }
        } catch { }
    };

    useEffect(() => {
        if (activeTab === 'reviews' && product) {
            (async () => {
                const reviewedIds = await fetchReviews(product.id);
                await fetchReviewableOrders(product.id, reviewedIds);
            })();
        }
    }, [activeTab, product]);

    const handleSubmitReview = async () => {
        if (!reviewForm.orderId || !product) return;
        setReviewSubmitting(true);
        setReviewMsg(null);
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    orderId: reviewForm.orderId,
                    productId: product.id,
                    rating: reviewForm.rating,
                    comment: reviewForm.comment.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setReviewMsg({ type: 'success', text: 'Đánh giá thành công! Cảm ơn bạn.' });
                setReviewForm({ orderId: '', rating: 5, comment: '' });
                // Remove the reviewed order from reviewable list
                setReviewableOrders(prev => prev.filter(o => o.id !== reviewForm.orderId));
                // Refresh reviews
                fetchReviews(product.id);
            } else {
                setReviewMsg({ type: 'error', text: data.message || 'Lỗi khi gửi đánh giá' });
            }
        } catch {
            setReviewMsg({ type: 'error', text: 'Lỗi kết nối' });
        }
        setReviewSubmitting(false);
    };

    const handleBuyClick = () => {
        if (!user) { router.push('/dang-nhap'); return; }
        setShowConfirm(true);
    };

    const handleApplyVoucher = async () => {
        if (!voucherCode.trim() || !product) return;
        setVoucherApplying(true);
        setVoucherResult(null);
        try {
            const res = await fetch(`/api/v1/vouchers/validate?code=${encodeURIComponent(voucherCode.trim())}&shopId=${product.shop.ownerId}&productId=${product.id}`);
            const data = await res.json();
            if (data.success && data.data) {
                const v = data.data;
                let discount = 0;
                const subtotal = currentPrice * quantity;
                if (v.discountType === 'PERCENT') {
                    discount = Math.floor(subtotal * v.discountValue / 100);
                    if (v.maxDiscount && discount > v.maxDiscount) discount = v.maxDiscount;
                } else {
                    discount = v.discountValue;
                }
                if (discount > subtotal) discount = subtotal;
                setVoucherResult({ valid: true, discount, message: `Giảm ${discount.toLocaleString()}đ` });
            } else {
                setVoucherResult({ valid: false, discount: 0, message: data.message || 'Mã không hợp lệ' });
            }
        } catch {
            setVoucherResult({ valid: false, discount: 0, message: 'Lỗi kiểm tra mã' });
        }
        setVoucherApplying(false);
    };

    const handleConfirmPurchase = async () => {
        setPurchasing(true);
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/orders/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    productId: product?.id,
                    variantId: selectedVariant,
                    quantity,
                    voucherCode: voucherResult?.valid ? voucherCode.trim() : undefined,
                }),
            });
            const data = await res.json();
            setShowConfirm(false);
            setVoucherCode('');
            setVoucherResult(null);
            if (data.success && data.data) {
                updateUser({ walletBalance: data.data.newBalance });
                setPurchaseResult({ success: true, message: data.message, order: data.data.order, newBalance: data.data.newBalance });
            } else {
                setPurchaseResult({ success: false, message: data.message });
            }
        } catch {
            setShowConfirm(false);
            setPurchaseResult({ success: false, message: t('purchaseConnectError') });
        }
        setPurchasing(false);
    };

    const handleCopyContent = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const currentPrice = selectedVariant
        ? product?.variants.find(v => v.id === selectedVariant)?.price || product?.price || 0
        : product?.price || 0;

    const currentWarranty = selectedVariant
        ? product?.variants.find(v => v.id === selectedVariant)?.warrantyDays || 0
        : 0;

    if (loading) {
        return (
            <>
                <Header />
                <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-primary" /></div>
                <Footer />
            </>
        );
    }

    if (error || !product) {
        return (
            <>
                <Header />
                <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                    <AlertCircle className="w-12 h-12 text-brand-danger" />
                    <h1 className="text-xl font-bold text-brand-text-primary">{t('pdpNotFound')}</h1>
                    <p className="text-sm text-brand-text-muted">{error}</p>
                    <Link href="/" className="btn-primary">{t('pdpBackHome')}</Link>
                </div>
                <Footer />
            </>
        );
    }

    const tabs = [
        { id: 'description', label: t('pdpTabDescription') },
        { id: 'reviews', label: t('pdpTabReviews') },
        { id: 'policy', label: t('pdpTabPolicy') },
    ];

    return (
        <>
            <Header />
            <main className="min-h-screen">
                <div className="max-w-container mx-auto px-4 py-6">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-brand-text-muted mb-6">
                        <Link href="/" className="hover:text-brand-primary transition-colors">{t('pdpBreadcrumbHome')}</Link>
                        <ChevronRight className="w-3 h-3" />
                        <Link href="/danh-muc" className="hover:text-brand-primary transition-colors">{t('pdpBreadcrumbCategories')}</Link>
                        <ChevronRight className="w-3 h-3" />
                        <Link href={`/danh-muc/${product.category.slug}`} className="hover:text-brand-primary transition-colors">{product.category.name}</Link>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-brand-text-primary truncate max-w-[200px]">{product.name}</span>
                    </nav>

                    {/* Product Main */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-8">
                        {/* Gallery + Trust Badges */}
                        <div>
                            <div className="card !p-0 overflow-hidden rounded-xl">
                                <div className="h-[340px] bg-brand-surface-2 flex items-center justify-center">
                                    {product.images?.[0]?.url ? (
                                        <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-24 h-24 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                                            <Package className="w-12 h-12 text-brand-primary/40" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            {product.images.length > 1 && (
                                <div className="flex gap-2 mt-2">
                                    {product.images.map((img, i) => (
                                        <div key={i} className={`w-14 h-14 rounded-lg border ${i === 0 ? 'border-brand-primary' : 'border-brand-border'} overflow-hidden cursor-pointer hover:border-brand-primary/50 transition-all`}>
                                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>

                        {/* Product Info */}
                        <div>
                            {/* Title + Seller */}
                            <h1 className="text-lg md:text-xl font-bold text-brand-text-primary mb-1">{product.name}</h1>
                            <Link href={`/shop/${product.shop.slug}`} className="inline-flex items-center gap-1.5 mb-3 group">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center overflow-hidden">
                                    {product.shop.logoUrl ? (
                                        <img src={product.shop.logoUrl} alt={product.shop.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[9px] text-white font-bold">{product.shop.name.charAt(0)}</span>
                                    )}
                                </div>
                                <span className="text-xs text-brand-text-secondary group-hover:text-brand-primary transition-colors">{product.shop.name}</span>
                                {product.shop.verified && <CheckCircle className="w-3.5 h-3.5 text-brand-primary" />}
                            </Link>

                            {/* Variants */}
                            {product.variants.length > 0 && (
                                <div className="mb-3">
                                    <label className="text-xs text-brand-text-muted mb-1.5 block">{t('pdpSelectPackage')}</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {product.variants.filter(v => v.isActive).map(v => (
                                            <button
                                                key={v.id}
                                                onClick={() => setSelectedVariant(v.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedVariant === v.id
                                                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                                                    : 'border-brand-border text-brand-text-secondary hover:border-brand-primary/40'}`}
                                            >
                                                {v.name} — {formatCurrency(v.price)}
                                                {v.warrantyDays > 0 && <span className="text-[10px] text-brand-text-muted ml-1">({v.warrantyDays}d {t('pdpWarrantyShort')})</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Price */}
                            <div className="flex items-baseline gap-2 mb-3">
                                <span className="text-2xl font-bold text-brand-primary">{formatCurrency(currentPrice)}</span>
                                {product.compareAtPrice && product.compareAtPrice > currentPrice && (
                                    <>
                                        <span className="text-sm text-brand-text-muted line-through">{formatCurrency(product.compareAtPrice)}</span>
                                        <span className="badge-danger text-[10px]">-{Math.round((1 - currentPrice / product.compareAtPrice) * 100)}%</span>
                                    </>
                                )}
                            </div>

                            {/* Meta inline */}
                            <div className="flex items-center gap-3 text-xs text-brand-text-muted mb-3 flex-wrap">
                                <span>{t('pdpSoldCount')}: <b className="text-brand-text-primary">{product.soldCount}</b></span>
                                <span>{t('pdpStock')}: <b className="text-brand-success">{product.stockCountCached}</b></span>
                                <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-brand-warning fill-brand-warning" /><b className="text-brand-text-primary">{product.ratingAverage || 0}</b></span>
                                <span className="flex items-center gap-0.5">{product.deliveryType === 'AUTO' ? <><Zap className="w-3 h-3 text-brand-info" /><b className="text-brand-info">{t('pdpAutoDelivery')}</b></> : <b>{t('pdpManualDelivery')}</b>}</span>
                            </div>

                            {/* Warranty & Delivery Info Banner */}
                            <div className="bg-gradient-to-r from-brand-success/5 to-brand-info/5 border border-brand-success/15 rounded-xl p-4 mb-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {currentWarranty > 0 && (
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-brand-success/10 flex items-center justify-center shrink-0">
                                                <Shield className="w-5 h-5 text-brand-success" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-brand-success">{t('pdpWarranty')} {currentWarranty} {t('pdpWarrantyDays')}</div>
                                                <div className="text-[11px] text-brand-text-muted">{t('pdpWarrantyDesc').replace('{days}', String(currentWarranty))}</div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-brand-info/10 flex items-center justify-center shrink-0">
                                            <Zap className="w-5 h-5 text-brand-info" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-brand-info">{product.deliveryType === 'AUTO' ? t('pdpInstantDelivery') : t('pdpManualProcess')}</div>
                                            <div className="text-[11px] text-brand-text-muted">{product.deliveryType === 'AUTO' ? 'Nhận hàng ngay sau khi thanh toán' : 'Seller sẽ giao hàng thủ công'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-brand-warning/10 flex items-center justify-center shrink-0">
                                            <Clock className="w-5 h-5 text-brand-warning" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-brand-warning">{t('pdpComplaintTime')}</div>
                                            <div className="text-[11px] text-brand-text-muted">Hỗ trợ khiếu nại trong thời gian bảo hành</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quantity & Buy */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex items-center border border-brand-border rounded-lg">
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 text-brand-text-muted hover:text-brand-text-primary transition-colors">
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="px-3 text-sm font-semibold text-brand-text-primary min-w-[32px] text-center">{quantity}</span>
                                    <button onClick={() => setQuantity(quantity + 1)} className="p-2 text-brand-text-muted hover:text-brand-text-primary transition-colors">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="text-sm text-brand-text-muted">
                                    {t('pdpTotal')}: <span className="text-brand-primary font-bold">{formatCurrency(currentPrice * quantity)}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={handleBuyClick} className="btn-primary flex-1 flex items-center justify-center gap-2 !py-3">
                                    <ShoppingCart className="w-4 h-4" /> {user ? t('pdpBuyNow') : t('pdpLoginToBuy')}
                                </button>
                                <button
                                    onClick={() => {
                                        const params = new URLSearchParams({
                                            shop: product.shop.ownerId,
                                            productId: product.id,
                                            productName: product.name,
                                            productPrice: String(currentPrice),
                                        });
                                        if (product.images?.[0]?.url) params.set('productImage', product.images[0].url);
                                        router.push(`/dashboard/tin-nhan?${params.toString()}`);
                                    }}
                                    className="btn-secondary !px-3"
                                    title="Nhắn tin seller"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                </button>
                                <button onClick={toggleFavorite} disabled={favLoading} className={`btn-secondary !px-3 transition-all ${isFavorited ? '!bg-red-50 !border-red-200 !text-red-500 hover:!bg-red-100' : ''}`} title={isFavorited ? 'Bỏ yêu thích' : 'Thêm yêu thích'}>
                                    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mb-12">
                        <div className="flex gap-1 border-b border-brand-border mb-6 overflow-x-auto">
                            {tabs.map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id ? 'text-brand-primary border-brand-primary' : 'text-brand-text-muted border-transparent hover:text-brand-text-secondary'}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="card">
                            {activeTab === 'description' && (
                                <div className="prose prose-sm max-w-none text-brand-text-secondary leading-relaxed">
                                    <p>{product.shortDescription || t('pdpNoDescription')}</p>
                                </div>
                            )}

                            {activeTab === 'reviews' && (
                                <div className="space-y-6">
                                    {/* Review Stats */}
                                    <div className="flex items-center gap-6 pb-5 border-b border-brand-border">
                                        <div className="text-center">
                                            <div className="text-4xl font-bold text-brand-primary">{reviewStats.avgRating || 0}</div>
                                            <div className="flex items-center gap-0.5 mt-1 justify-center">
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <Star key={s} className={`w-4 h-4 ${s <= Math.round(reviewStats.avgRating) ? 'text-brand-warning fill-brand-warning' : 'text-brand-border'}`} />
                                                ))}
                                            </div>
                                            <div className="text-xs text-brand-text-muted mt-1">{reviewStats.totalReviews} đánh giá</div>
                                        </div>
                                        <div className="flex-1">
                                            {[5, 4, 3, 2, 1].map(star => {
                                                const count = reviews.filter(r => r.rating === star).length;
                                                const pct = reviewStats.totalReviews > 0 ? (count / reviewStats.totalReviews) * 100 : 0;
                                                return (
                                                    <div key={star} className="flex items-center gap-2 text-xs">
                                                        <span className="w-8 text-right text-brand-text-muted">{star} ⭐</span>
                                                        <div className="flex-1 h-2 bg-brand-surface-2 rounded-full overflow-hidden">
                                                            <div className="h-full bg-brand-warning rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className="w-8 text-brand-text-muted">{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Review Form — only if user has reviewable orders */}
                                    {user && reviewableOrders.length > 0 && (
                                        <div className="bg-brand-surface-2 rounded-xl p-4 border border-brand-border">
                                            <h4 className="text-sm font-semibold text-brand-text-primary mb-3">✍️ Viết đánh giá</h4>

                                            <div className="mb-3">
                                                <label className="text-xs text-brand-text-muted block mb-1">Chọn đơn hàng</label>
                                                <select
                                                    value={reviewForm.orderId}
                                                    onChange={e => setReviewForm(f => ({ ...f, orderId: e.target.value }))}
                                                    className="w-full bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text-primary"
                                                >
                                                    <option value="">-- Chọn đơn hàng --</option>
                                                    {reviewableOrders.map(o => (
                                                        <option key={o.id} value={o.id}>
                                                            #{o.orderCode} — {new Date(o.createdAt).toLocaleDateString('vi-VN')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="mb-3">
                                                <label className="text-xs text-brand-text-muted block mb-1">Đánh giá sao</label>
                                                <div className="flex items-center gap-1">
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <button key={s} onClick={() => setReviewForm(f => ({ ...f, rating: s }))} className="p-1 transition-transform hover:scale-110">
                                                            <Star className={`w-7 h-7 ${s <= reviewForm.rating ? 'text-brand-warning fill-brand-warning' : 'text-brand-border hover:text-brand-warning/50'}`} />
                                                        </button>
                                                    ))}
                                                    <span className="ml-2 text-sm font-medium text-brand-text-secondary">{reviewForm.rating}/5</span>
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <label className="text-xs text-brand-text-muted block mb-1">Nhận xét (tùy chọn)</label>
                                                <textarea
                                                    value={reviewForm.comment}
                                                    onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                                                    placeholder="Chia sẻ trải nghiệm của bạn..."
                                                    className="w-full bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-muted resize-none h-20"
                                                />
                                            </div>

                                            {reviewMsg && (
                                                <div className={`text-sm px-3 py-2 rounded-lg mb-3 ${reviewMsg.type === 'success' ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-danger/10 text-brand-danger'}`}>
                                                    {reviewMsg.text}
                                                </div>
                                            )}

                                            <button
                                                onClick={handleSubmitReview}
                                                disabled={!reviewForm.orderId || reviewSubmitting}
                                                className="btn-primary !py-2 !px-6 text-sm disabled:opacity-50"
                                            >
                                                {reviewSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Review List */}
                                    {reviews.length > 0 ? (
                                        <div className="space-y-4">
                                            {reviews.map(r => (
                                                <div key={r.id} className="flex gap-3 pb-4 border-b border-brand-border/50 last:border-0">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shrink-0">
                                                        <span className="text-white text-xs font-bold">{r.userName?.charAt(0) || '?'}</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-medium text-brand-text-primary">{r.userName}</span>
                                                            <span className="text-[10px] text-brand-text-muted">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-0.5 mb-1.5">
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'text-brand-warning fill-brand-warning' : 'text-brand-border'}`} />
                                                            ))}
                                                        </div>
                                                        {r.comment && (
                                                            <p className="text-sm text-brand-text-secondary leading-relaxed">{r.comment}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-brand-text-muted text-center py-6">Chưa có đánh giá nào cho sản phẩm này.</p>
                                    )}
                                </div>
                            )}
                            {activeTab === 'policy' && (
                                <div className="space-y-4 text-sm text-brand-text-secondary">
                                    {currentWarranty > 0 && (
                                        <div>
                                            <h4 className="font-medium text-brand-text-primary mb-1">{t('pdpWarrantyTitle')}</h4>
                                            <p>{t('pdpWarrantyDesc').replace('{days}', String(currentWarranty))}</p>
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-medium text-brand-text-primary mb-1">{t('pdpComplaintTitle')}</h4>
                                        <p>{t('pdpComplaintDesc')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Seller Info */}
                    <div className="card mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center border border-brand-border overflow-hidden">
                                {product.shop.logoUrl ? (
                                    <img src={product.shop.logoUrl} alt={product.shop.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xl font-bold gradient-text">{product.shop.name.charAt(0)}</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-brand-text-primary">{product.shop.name}</h3>
                                    {product.shop.verified && <CheckCircle className="w-4 h-4 text-brand-primary" />}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-brand-text-muted">
                                    <span>{product.shop.productCount || 0} {t('pdpProducts')}</span>
                                    <span>⭐ {product.shop.ratingAverage || 0}</span>
                                </div>
                            </div>
                            <Link href={`/shop/${product.shop.slug}`} className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1.5">
                                <Store className="w-4 h-4" /> {t('pdpViewShop')}
                            </Link>
                        </div>
                    </div>

                    {/* API Integration Section — Redesigned */}
                    <div className="card mb-12 border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-brand-text-primary">⚡ API Integration</h3>
                                <p className="text-xs text-brand-text-secondary">Tích hợp sản phẩm này vào website/app của bạn — Copy & dùng ngay!</p>
                            </div>
                        </div>

                        {/* API Key Display */}
                        {user && userApiKey && (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-emerald-500" />
                                    <div>
                                        <span className="text-xs font-semibold text-emerald-600">API Key của bạn:</span>
                                        <code className="ml-2 text-xs font-mono text-brand-text-primary bg-white/50 px-2 py-0.5 rounded">{userApiKey}</code>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(userApiKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    {copied ? 'Đã copy!' : 'Copy'}
                                </button>
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* GET — View Product */}
                            <div className="bg-white/60 dark:bg-brand-surface-2 rounded-xl p-4 border border-brand-border">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500 text-white font-bold tracking-wider">GET</span>
                                    <span className="text-xs font-semibold text-brand-text-primary">Xem thông tin sản phẩm</span>
                                </div>
                                <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 overflow-x-auto">
                                    <div className="text-gray-400 mb-1"># Xem sản phẩm</div>
                                    <div>curl -X GET \</div>
                                    <div className="ml-4">&quot;{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/public/products?slug=<span className="text-yellow-300">{product.slug}</span>&quot; \</div>
                                    <div className="ml-4">-H &quot;x-api-key: <span className="text-cyan-300">{userApiKey || 'YOUR_API_KEY'}</span>&quot;</div>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText(`curl -X GET "${window.location.origin}/api/v1/public/products?slug=${product.slug}" -H "x-api-key: ${userApiKey || 'YOUR_API_KEY'}"`)}
                                    className="mt-2 flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-600 font-medium"
                                >
                                    <Copy className="w-3 h-3" /> Copy lệnh curl
                                </button>
                            </div>

                            {/* POST — Purchase */}
                            <div className="bg-white/60 dark:bg-brand-surface-2 rounded-xl p-4 border border-brand-border">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500 text-white font-bold tracking-wider">POST</span>
                                    <span className="text-xs font-semibold text-brand-text-primary">Mua hàng qua API</span>
                                </div>
                                <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-green-400 overflow-x-auto">
                                    <div className="text-gray-400 mb-1"># Mua sản phẩm</div>
                                    <div>curl -X POST \</div>
                                    <div className="ml-4">&quot;{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/public/products&quot; \</div>
                                    <div className="ml-4">-H &quot;Content-Type: application/json&quot; \</div>
                                    <div className="ml-4">-H &quot;x-api-key: <span className="text-cyan-300">{userApiKey || 'YOUR_API_KEY'}</span>&quot; \</div>
                                    <div className="ml-4">-d &apos;{'{'}&quot;productSlug&quot;:&quot;<span className="text-yellow-300">{product.slug}</span>&quot;,&quot;quantity&quot;:<span className="text-purple-300">1</span>{'}'}\&apos;</div>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText(`curl -X POST "${window.location.origin}/api/v1/public/products" -H "Content-Type: application/json" -H "x-api-key: ${userApiKey || 'YOUR_API_KEY'}" -d '{"productSlug":"${product.slug}","quantity":1}'`)}
                                    className="mt-2 flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-600 font-medium"
                                >
                                    <Copy className="w-3 h-3" /> Copy lệnh curl
                                </button>
                            </div>

                            {/* Auth info */}
                            {!user && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <p className="text-xs text-brand-text-secondary">
                                        <Link href="/dang-nhap" className="text-brand-primary hover:underline font-semibold">Đăng nhập</Link> để nhận API Key miễn phí và sử dụng API ngay!
                                    </p>
                                </div>
                            )}
                            {user && (
                                <div className="flex items-center gap-2 text-[10px] text-brand-text-muted">
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Quản lý API Keys tại <Link href="/dashboard/api-keys" className="text-indigo-500 hover:underline font-medium">Dashboard → API Keys</Link> • <Link href="/api-docs" className="text-indigo-500 hover:underline font-medium">Xem tài liệu API</Link></span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <Footer />

            {/* Purchase Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !purchasing && setShowConfirm(false)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => !purchasing && setShowConfirm(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2">
                            <X className="w-5 h-5 text-brand-text-muted" />
                        </button>

                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">{t('purchaseConfirmTitle')}</h2>

                        <div className="bg-brand-surface-2 rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                                    <Package className="w-6 h-6 text-brand-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-brand-text-primary truncate">{product.name}</div>
                                    <div className="text-xs text-brand-text-muted">{product.shop.name}</div>
                                </div>
                            </div>
                            <div className="flex justify-between text-sm border-t border-brand-border pt-3">
                                <span className="text-brand-text-muted">{t('purchaseUnitPrice')}</span>
                                <span className="text-brand-text-primary font-medium">{formatCurrency(currentPrice)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-brand-text-muted">{t('purchaseQuantity')}</span>
                                <span className="text-brand-text-primary font-medium">x{quantity}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-brand-text-muted">{t('purchaseDelivery')}</span>
                                <span className="text-brand-info font-medium">{product.deliveryType === 'AUTO' ? t('purchaseAutoDelivery') : t('purchaseManualDelivery')}</span>
                            </div>
                            <div className="border-t border-brand-border mt-3 pt-3 flex justify-between">
                                <span className="text-sm font-semibold text-brand-text-primary">{t('purchaseTotal')}</span>
                                <span className="text-lg font-bold text-brand-primary">{formatCurrency(currentPrice * quantity)}</span>
                            </div>
                        </div>

                        {/* Voucher Input */}
                        <div className="mb-4">
                            <label className="text-xs font-semibold text-brand-text-secondary mb-1.5 block">🎫 Mã giảm giá (nếu có)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={voucherCode}
                                    onChange={e => { setVoucherCode(e.target.value.toUpperCase()); setVoucherResult(null); }}
                                    placeholder="Nhập mã voucher..."
                                    className="input-field flex-1 !py-2 text-sm font-mono uppercase"
                                    disabled={purchasing}
                                />
                                <button
                                    onClick={handleApplyVoucher}
                                    disabled={!voucherCode.trim() || voucherApplying || purchasing}
                                    className="btn-secondary !py-2 !px-4 text-xs font-semibold disabled:opacity-50"
                                >
                                    {voucherApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Áp dụng'}
                                </button>
                            </div>
                            {voucherResult && (
                                <div className={`mt-1.5 text-xs font-medium flex items-center gap-1 ${voucherResult.valid ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {voucherResult.valid ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                    {voucherResult.message}
                                </div>
                            )}
                            {voucherResult?.valid && (
                                <div className="mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex justify-between items-center">
                                    <span className="text-xs text-emerald-600 font-medium">Thanh toán sau giảm:</span>
                                    <span className="text-sm font-bold text-emerald-600">{formatCurrency(Math.max(0, currentPrice * quantity - voucherResult.discount))}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-sm mb-5 bg-brand-success/5 border border-brand-success/10 rounded-xl px-4 py-2.5">
                            <span className="text-brand-text-muted">{t('purchaseWalletBalance')}</span>
                            <span className="text-brand-success font-bold">{formatCurrency(user?.walletBalance || 0)}</span>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(false)} disabled={purchasing} className="btn-secondary flex-1 !py-3">{t('purchaseCancel')}</button>
                            <button onClick={handleConfirmPurchase} disabled={purchasing} className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2">
                                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                                {purchasing ? t('purchaseProcessing') : t('purchaseConfirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Result Modal */}
            {purchaseResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPurchaseResult(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6 animate-slide-up">
                        <button onClick={() => setPurchaseResult(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2">
                            <X className="w-5 h-5 text-brand-text-muted" />
                        </button>

                        {purchaseResult.success ? (
                            <>
                                <div className="text-center mb-5">
                                    <div className="w-16 h-16 rounded-full bg-brand-success/10 flex items-center justify-center mx-auto mb-3">
                                        <CheckCircle2 className="w-8 h-8 text-brand-success" />
                                    </div>
                                    <h2 className="text-xl font-bold text-brand-text-primary">{t('purchaseSuccess')}</h2>
                                    <p className="text-sm text-brand-text-muted mt-1">{t('purchaseOrderCode')}: <span className="font-mono font-semibold text-brand-primary">{purchaseResult.order?.orderCode}</span></p>
                                </div>

                                {purchaseResult.order?.deliveredContent && (
                                    <div className="bg-brand-surface-2 border border-brand-border rounded-xl p-4 mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-semibold text-brand-text-primary">{t('purchaseProductInfo')}</h3>
                                            <button onClick={() => handleCopyContent(purchaseResult.order!.deliveredContent!)} className="flex items-center gap-1 text-xs text-brand-primary hover:underline">
                                                <Copy className="w-3 h-3" /> {copied ? t('purchaseCopied') : t('purchaseCopy')}
                                            </button>
                                        </div>
                                        <pre className="text-xs text-brand-text-secondary bg-brand-bg rounded-lg p-3 whitespace-pre-wrap font-mono border border-brand-border/50">
                                            {purchaseResult.order.deliveredContent}
                                        </pre>
                                    </div>
                                )}

                                {purchaseResult.order?.status === 'paid' && (
                                    <div className="flex items-center gap-2 bg-brand-warning/10 border border-brand-warning/20 text-brand-warning text-sm rounded-xl px-4 py-3 mb-4">
                                        <Clock className="w-4 h-4 shrink-0" />
                                        {t('purchaseManualNote')}
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-sm bg-brand-surface-2 rounded-xl px-4 py-3 mb-5">
                                    <span className="text-brand-text-muted">{t('purchaseRemainingBalance')}</span>
                                    <span className="text-brand-success font-bold">{formatCurrency(purchaseResult.newBalance || 0)}</span>
                                </div>

                                <div className="flex gap-3">
                                    <Link href="/dashboard/don-hang" className="btn-secondary flex-1 !py-3 text-center flex items-center justify-center gap-2">
                                        <Package className="w-4 h-4" /> {t('purchaseViewOrders')}
                                    </Link>
                                    <button onClick={() => setPurchaseResult(null)} className="btn-primary flex-1 !py-3">{t('purchaseContinueShopping')}</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-5">
                                    <div className="w-16 h-16 rounded-full bg-brand-danger/10 flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle className="w-8 h-8 text-brand-danger" />
                                    </div>
                                    <h2 className="text-xl font-bold text-brand-text-primary">{t('purchaseFailed')}</h2>
                                    <p className="text-sm text-brand-danger mt-2">{purchaseResult.message}</p>
                                </div>
                                <div className="flex gap-3">
                                    <Link href="/dashboard/nap-tien" className="btn-secondary flex-1 !py-3 text-center">{t('purchaseDepositMore')}</Link>
                                    <button onClick={() => setPurchaseResult(null)} className="btn-primary flex-1 !py-3">{t('purchaseRetry')}</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
