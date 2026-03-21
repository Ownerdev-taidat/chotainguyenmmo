import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { Star, CheckCircle, ArrowRight, Package, ShieldCheck, MessageSquare } from 'lucide-react';

export default async function AllShopsPage() {
    let shops: any[] = [];
    try {
        const rawShops = await prisma.shop.findMany({
            where: { status: 'ACTIVE' },
            orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }],
            include: {
                _count: { select: { products: { where: { status: 'ACTIVE' } } } },
                products: {
                    where: { status: 'ACTIVE' },
                    select: {
                        ratingAverage: true,
                        ratingCount: true,
                        soldCount: true,
                    },
                },
            },
        });

        // Compute aggregated stats from products
        shops = rawShops.map((shop) => {
            const products = shop.products || [];
            const productsWithRating = products.filter((p: any) => (p.ratingCount || 0) > 0);
            
            // Weighted average rating from products
            let avgRating = 0;
            let totalRatingCount = 0;
            if (productsWithRating.length > 0) {
                let weightedSum = 0;
                productsWithRating.forEach((p: any) => {
                    weightedSum += (p.ratingAverage || 0) * (p.ratingCount || 0);
                    totalRatingCount += (p.ratingCount || 0);
                });
                avgRating = totalRatingCount > 0 ? weightedSum / totalRatingCount : 0;
            }

            // Total sold across all products
            const totalSold = products.reduce((sum: number, p: any) => sum + (p.soldCount || 0), 0);

            return {
                id: shop.id,
                name: shop.name,
                slug: shop.slug,
                logoUrl: shop.logoUrl,
                verified: shop.verified,
                shortDescription: shop.shortDescription,
                responseRate: shop.responseRate || 0,
                _count: shop._count,
                // Computed stats
                computedRating: Math.round(avgRating * 10) / 10,
                computedRatingCount: totalRatingCount,
                computedSoldCount: totalSold,
                productCount: shop._count?.products || 0,
            };
        });
    } catch (e) {
        console.error('Failed to load shops:', e);
    }

    return (
        <>
            <Header />
            <main className="min-h-screen">
                <div className="max-w-container mx-auto px-4 py-8">
                    <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Gian hàng trên ChoTaiNguyen</h1>
                    <p className="text-brand-text-secondary mb-8">
                        Khám phá các gian hàng đang hoạt động trên nền tảng, mỗi gian hàng mang đến sản phẩm riêng biệt.
                    </p>
                    {shops.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 rounded-2xl bg-brand-surface-2 flex items-center justify-center mx-auto mb-4">
                                <Package className="w-8 h-8 text-brand-text-muted" />
                            </div>
                            <p className="text-brand-text-secondary">Chưa có gian hàng nào đang hoạt động.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {shops.map((shop) => (
                                <div key={shop.id} className="group bg-brand-surface border border-brand-border rounded-2xl p-5 hover:border-brand-primary/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center shrink-0 border border-brand-border overflow-hidden">
                                            {shop.logoUrl ? (
                                                <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xl font-bold gradient-text">{shop.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-semibold text-brand-text-primary truncate">{shop.name}</h3>
                                                {shop.verified && <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />}
                                            </div>
                                            <p className="text-xs text-brand-text-muted line-clamp-2 mb-3">{shop.shortDescription || 'Gian hàng trên ChoTaiNguyen'}</p>
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                                    <Package className="w-3.5 h-3.5 text-brand-text-muted" />
                                                    <span>{shop.productCount} sản phẩm</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-brand-text-muted" />
                                                    <span>{shop.computedSoldCount} đơn thành công</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                                    <Star className={`w-3.5 h-3.5 ${shop.computedRating > 0 ? 'text-brand-warning fill-brand-warning' : 'text-brand-text-muted'}`} />
                                                    <span>{shop.computedRating} ({shop.computedRatingCount})</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                                    <MessageSquare className="w-3.5 h-3.5 text-brand-text-muted" />
                                                    <span>Phản hồi {shop.responseRate}%</span>
                                                </div>
                                            </div>
                                            <Link href={`/shop/${shop.slug}`} className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-medium hover:gap-2.5 transition-all">
                                                Xem gian hàng <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
