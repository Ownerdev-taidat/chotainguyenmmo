'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency';
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

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/v1/products/${slug}`);
                const data = await res.json();
                if (data.success && data.data) {
                    setProduct(data.data);
                    if (data.data.variants?.length > 0) setSelectedVariant(data.data.variants[0].id);
                } else {
                    setError(data.message || 'Không tìm thấy sản phẩm');
                }
            } catch {
                setError('Lỗi tải sản phẩm');
            }
            setLoading(false);
        })();
    }, [slug]);

    const handleBuyClick = () => {
        if (!user) { router.push('/dang-nhap'); return; }
        setShowConfirm(true);
    };

    const handleConfirmPurchase = async () => {
        setPurchasing(true);
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/orders/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ productId: product?.id, variantId: selectedVariant, quantity }),
            });
            const data = await res.json();
            setShowConfirm(false);
            if (data.success && data.data) {
                updateUser({ walletBalance: data.data.newBalance });
                setPurchaseResult({ success: true, message: data.message, order: data.data.order, newBalance: data.data.newBalance });
            } else {
                setPurchaseResult({ success: false, message: data.message });
            }
        } catch {
            setShowConfirm(false);
            setPurchaseResult({ success: false, message: 'Không thể kết nối server' });
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
                    <h1 className="text-xl font-bold text-brand-text-primary">Không tìm thấy sản phẩm</h1>
                    <p className="text-sm text-brand-text-muted">{error}</p>
                    <Link href="/" className="btn-primary">Về trang chủ</Link>
                </div>
                <Footer />
            </>
        );
    }

    const tabs = [
        { id: 'description', label: 'Mô tả' },
        { id: 'reviews', label: 'Đánh giá' },
        { id: 'policy', label: 'Chính sách' },
    ];

    return (
        <>
            <Header />
            <main className="min-h-screen">
                <div className="max-w-container mx-auto px-4 py-6">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-brand-text-muted mb-6">
                        <Link href="/" className="hover:text-brand-primary transition-colors">Trang chủ</Link>
                        <ChevronRight className="w-3 h-3" />
                        <Link href="/danh-muc" className="hover:text-brand-primary transition-colors">Danh mục</Link>
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
                            {/* Trust Badges — under image */}
                            <div className="flex items-center gap-4 mt-3 text-xs text-brand-text-muted">
                                <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-brand-info" />{product.deliveryType === 'AUTO' ? 'Giao ngay' : 'Xử lý thủ công'}</span>
                                {currentWarranty > 0 && <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-brand-success" />BH {currentWarranty} ngày</span>}
                                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-brand-warning" />KN trong 24h</span>
                            </div>
                        </div>

                        {/* Product Info */}
                        <div>
                            {/* Title + Seller */}
                            <h1 className="text-lg md:text-xl font-bold text-brand-text-primary mb-1">{product.name}</h1>
                            <Link href={`/shop/${product.shop.slug}`} className="inline-flex items-center gap-1.5 mb-3 group">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                    <span className="text-[9px] text-white font-bold">{product.shop.name.charAt(0)}</span>
                                </div>
                                <span className="text-xs text-brand-text-secondary group-hover:text-brand-primary transition-colors">{product.shop.name}</span>
                                {product.shop.verified && <CheckCircle className="w-3.5 h-3.5 text-brand-primary" />}
                            </Link>

                            {/* Variants */}
                            {product.variants.length > 0 && (
                                <div className="mb-3">
                                    <label className="text-xs text-brand-text-muted mb-1.5 block">Chọn gói</label>
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
                                                {v.warrantyDays > 0 && <span className="text-[10px] text-brand-text-muted ml-1">({v.warrantyDays}d BH)</span>}
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
                                <span>Đã bán: <b className="text-brand-text-primary">{product.soldCount}</b></span>
                                <span>Tồn kho: <b className="text-brand-success">{product.stockCountCached}</b></span>
                                <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-brand-warning fill-brand-warning" /><b className="text-brand-text-primary">{product.ratingAverage || 0}</b></span>
                                <span className="flex items-center gap-0.5">{product.deliveryType === 'AUTO' ? <><Zap className="w-3 h-3 text-brand-info" /><b className="text-brand-info">Tự động</b></> : <b>Thủ công</b>}</span>
                            </div>

                            {/* Description */}
                            {product.shortDescription && (
                                <p className="text-xs text-brand-text-secondary leading-relaxed mb-3">{product.shortDescription}</p>
                            )}

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
                                    Tổng: <span className="text-brand-primary font-bold">{formatCurrency(currentPrice * quantity)}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={handleBuyClick} className="btn-primary flex-1 flex items-center justify-center gap-2 !py-3">
                                    <ShoppingCart className="w-4 h-4" /> {user ? 'Mua ngay' : 'Đăng nhập để mua'}
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
                                <button className="btn-secondary !px-3"><Heart className="w-4 h-4" /></button>
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
                                    <p>{product.shortDescription || 'Chưa có mô tả chi tiết.'}</p>
                                </div>
                            )}

                            {activeTab === 'reviews' && (
                                <p className="text-sm text-brand-text-muted text-center py-8">Chưa có đánh giá nào cho sản phẩm này.</p>
                            )}
                            {activeTab === 'policy' && (
                                <div className="space-y-4 text-sm text-brand-text-secondary">
                                    {currentWarranty > 0 && (
                                        <div>
                                            <h4 className="font-medium text-brand-text-primary mb-1">Bảo hành</h4>
                                            <p>Sản phẩm được bảo hành {currentWarranty} ngày kể từ ngày mua.</p>
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-medium text-brand-text-primary mb-1">Khiếu nại</h4>
                                        <p>Người dùng có thể gửi khiếu nại trong 24 giờ kể từ khi nhận hàng.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Seller Info */}
                    <div className="card mb-12">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center border border-brand-border">
                                <span className="text-xl font-bold gradient-text">{product.shop.name.charAt(0)}</span>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-brand-text-primary">{product.shop.name}</h3>
                                    {product.shop.verified && <CheckCircle className="w-4 h-4 text-brand-primary" />}
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-brand-text-muted">
                                    <span>{product.shop.productCount || 0} sản phẩm</span>
                                    <span>⭐ {product.shop.ratingAverage || 0}</span>
                                </div>
                            </div>
                            <Link href={`/shop/${product.shop.slug}`} className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1.5">
                                <Store className="w-4 h-4" /> Xem gian hàng
                            </Link>
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

                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">Xác nhận mua hàng</h2>

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
                                <span className="text-brand-text-muted">Đơn giá</span>
                                <span className="text-brand-text-primary font-medium">{formatCurrency(currentPrice)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-brand-text-muted">Số lượng</span>
                                <span className="text-brand-text-primary font-medium">x{quantity}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-brand-text-muted">Giao hàng</span>
                                <span className="text-brand-info font-medium">{product.deliveryType === 'AUTO' ? '⚡ Tự động' : '📦 Thủ công'}</span>
                            </div>
                            <div className="border-t border-brand-border mt-3 pt-3 flex justify-between">
                                <span className="text-sm font-semibold text-brand-text-primary">Tổng thanh toán</span>
                                <span className="text-lg font-bold text-brand-primary">{formatCurrency(currentPrice * quantity)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm mb-5 bg-brand-success/5 border border-brand-success/10 rounded-xl px-4 py-2.5">
                            <span className="text-brand-text-muted">Số dư ví hiện tại</span>
                            <span className="text-brand-success font-bold">{formatCurrency(user?.walletBalance || 0)}</span>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(false)} disabled={purchasing} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button onClick={handleConfirmPurchase} disabled={purchasing} className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2">
                                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                                {purchasing ? 'Đang xử lý...' : 'Xác nhận mua'}
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
                                    <h2 className="text-xl font-bold text-brand-text-primary">Mua hàng thành công!</h2>
                                    <p className="text-sm text-brand-text-muted mt-1">Mã đơn: <span className="font-mono font-semibold text-brand-primary">{purchaseResult.order?.orderCode}</span></p>
                                </div>

                                {purchaseResult.order?.deliveredContent && (
                                    <div className="bg-brand-surface-2 border border-brand-border rounded-xl p-4 mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-semibold text-brand-text-primary">📦 Thông tin sản phẩm</h3>
                                            <button onClick={() => handleCopyContent(purchaseResult.order!.deliveredContent!)} className="flex items-center gap-1 text-xs text-brand-primary hover:underline">
                                                <Copy className="w-3 h-3" /> {copied ? 'Đã copy!' : 'Copy'}
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
                                        Sản phẩm giao thủ công — shop sẽ gửi trong vòng 24 giờ.
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-sm bg-brand-surface-2 rounded-xl px-4 py-3 mb-5">
                                    <span className="text-brand-text-muted">Số dư ví còn lại</span>
                                    <span className="text-brand-success font-bold">{formatCurrency(purchaseResult.newBalance || 0)}</span>
                                </div>

                                <div className="flex gap-3">
                                    <Link href="/dashboard/don-hang" className="btn-secondary flex-1 !py-3 text-center flex items-center justify-center gap-2">
                                        <Package className="w-4 h-4" /> Xem đơn hàng
                                    </Link>
                                    <button onClick={() => setPurchaseResult(null)} className="btn-primary flex-1 !py-3">Tiếp tục mua sắm</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-5">
                                    <div className="w-16 h-16 rounded-full bg-brand-danger/10 flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle className="w-8 h-8 text-brand-danger" />
                                    </div>
                                    <h2 className="text-xl font-bold text-brand-text-primary">Mua hàng thất bại</h2>
                                    <p className="text-sm text-brand-danger mt-2">{purchaseResult.message}</p>
                                </div>
                                <div className="flex gap-3">
                                    <Link href="/dashboard/nap-tien" className="btn-secondary flex-1 !py-3 text-center">Nạp tiền</Link>
                                    <button onClick={() => setPurchaseResult(null)} className="btn-primary flex-1 !py-3">Thử lại</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
