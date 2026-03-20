import Link from 'next/link';
import { ArrowRight, ShoppingCart, Star, Zap, Eye } from 'lucide-react';
import prisma from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';

export default async function FeaturedProducts() {
    let products: any[] = [];
    try {
        products = await prisma.product.findMany({
            where: { status: 'ACTIVE' },
            orderBy: [{ soldCount: 'desc' }, { createdAt: 'desc' }],
            take: 8,
            include: {
                category: { select: { name: true, slug: true } },
                shop: { select: { name: true, slug: true, verified: true } },
                images: { take: 1, orderBy: { sortOrder: 'asc' } },
            },
        });
    } catch { }

    return (
        <section className="section-padding bg-brand-surface/30">
            <div className="max-w-container mx-auto px-4">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 md:mb-10 gap-3">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">Sản phẩm nổi bật</h2>
                        <p className="text-brand-text-secondary">
                            Những sản phẩm đang được quan tâm nhiều, cập nhật liên tục từ các gian hàng trên hệ thống.
                        </p>
                    </div>
                    <Link href="/danh-muc" className="hidden md:flex items-center gap-1.5 text-sm text-brand-primary font-medium hover:gap-2.5 transition-all shrink-0">
                        Xem tất cả <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {products.length === 0 ? (
                    <div className="text-center py-12 text-brand-text-muted">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Chưa có sản phẩm nào. Các sản phẩm sẽ hiện ở đây khi seller đăng bán.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
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
                                        <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white bg-brand-primary/90">Nổi bật</span>
                                    )}
                                    <div className="absolute inset-0 bg-brand-bg/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                        <Link href={`/san-pham/${p.slug}`} className="flex items-center gap-1.5 bg-brand-primary text-white text-sm font-medium px-4 py-2 rounded-xl hover:brightness-110 transition-all">
                                            <Eye className="w-4 h-4" /> Xem chi tiết
                                        </Link>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="text-[11px] text-brand-text-muted font-medium mb-1.5">{p.category?.name}</div>
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
                                        <span>Đã bán {p.soldCount}</span>
                                        <span className="flex items-center gap-1">
                                            {p.deliveryType === 'AUTO' ? (
                                                <><Zap className="w-3 h-3 text-brand-info" /><span className="text-brand-info">Tự động</span></>
                                            ) : (
                                                <span>Thủ công</span>
                                            )}
                                        </span>
                                        <span>Kho: {p.stockCountCached || 0}</span>
                                    </div>
                                    <Link href={`/san-pham/${p.slug}`} className="block w-full text-center bg-brand-primary/10 text-brand-primary text-sm font-medium py-2 rounded-xl hover:bg-brand-primary hover:text-white transition-all">
                                        Mua ngay
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-8 text-center md:hidden">
                    <Link href="/danh-muc" className="btn-secondary inline-flex items-center gap-2">
                        Xem tất cả sản phẩm <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
