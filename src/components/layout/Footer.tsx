'use client';

import Link from 'next/link';
import { Facebook, MessageCircle, Youtube, Send } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function Footer() {
    const { t } = useI18n();

    return (
        <footer className="bg-brand-surface border-t border-brand-border mt-auto">
            <div className="max-w-container mx-auto px-4 py-12 md:py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                    {/* Brand */}
                    <div className="sm:col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <img src="/logokhongnen.png" alt="ChoTaiNguyen" style={{ height: '60px', width: 'auto' }} />
                        </div>
                        <p className="text-sm text-brand-text-secondary leading-relaxed mb-4">
                            {t('footerDesc')}
                        </p>
                        <div className="flex items-center gap-3">
                            {[Facebook, MessageCircle, Youtube, Send].map((Icon, i) => (
                                <a key={i} href="#" className="w-9 h-9 rounded-xl bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-text-muted hover:text-brand-primary hover:border-brand-primary/30 transition-all">
                                    <Icon className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Links */}
                    <div>
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-4">{t('footerLinks')}</h3>
                        <ul className="space-y-2.5">
                            {[
                                { labelKey: 'home' as const, href: '/' },
                                { labelKey: 'categories' as const, href: '/danh-muc' },
                                { labelKey: 'shops' as const, href: '/gian-hang' },
                                { labelKey: 'footerGuide' as const, href: '/huong-dan' },
                                { labelKey: 'support' as const, href: '/ho-tro' },
                            ].map((link, i) => (
                                <li key={i}>
                                    <Link href={link.href} className="text-sm text-brand-text-secondary hover:text-brand-primary transition-colors">
                                        {t(link.labelKey)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Policies */}
                    <div>
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-4">{t('footerPolicies')}</h3>
                        <ul className="space-y-2.5">
                            {[
                                'termsOfUse' as const,
                                'transactionPolicy' as const,
                                'complaintPolicy' as const,
                                'refundPolicy' as const,
                                'privacyPolicy' as const,
                            ].map((key, i) => (
                                <li key={i}>
                                    <Link href="/chinh-sach" className="text-sm text-brand-text-secondary hover:text-brand-primary transition-colors">
                                        {t(key)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Seller */}
                    <div>
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-4">{t('forSellers')}</h3>
                        <ul className="space-y-2.5">
                            {[
                                { labelKey: 'registerSelling' as const, href: '/dang-ky-ban-hang' },
                                { labelKey: 'sellerCenterFull' as const, href: '/seller' },
                                { labelKey: 'productRules' as const, href: '/chinh-sach' },
                                { labelKey: 'inventoryGuide' as const, href: '/huong-dan' },
                                { labelKey: 'withdrawGuide' as const, href: '/huong-dan' },
                            ].map((link, i) => (
                                <li key={i}>
                                    <Link href={link.href} className="text-sm text-brand-text-secondary hover:text-brand-primary transition-colors">
                                        {t(link.labelKey)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom */}
            <div className="border-t border-brand-border">
                <div className="max-w-container mx-auto px-4 py-4 text-center text-xs text-brand-text-muted">
                    © 2026 ChoTaiNguyen. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
