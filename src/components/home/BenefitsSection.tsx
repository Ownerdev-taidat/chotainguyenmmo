'use client';

import { Zap, LayoutDashboard, Eye, Headphones } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function BenefitsSection() {
    const { t } = useI18n();

    const benefits = [
        { icon: Zap, titleKey: 'benefitFastTitle' as const, descKey: 'benefitFastDesc' as const },
        { icon: LayoutDashboard, titleKey: 'benefitManageTitle' as const, descKey: 'benefitManageDesc' as const },
        { icon: Eye, titleKey: 'benefitTransparentTitle' as const, descKey: 'benefitTransparentDesc' as const },
        { icon: Headphones, titleKey: 'benefitSellerTitle' as const, descKey: 'benefitSellerDesc' as const },
    ];

    return (
        <section className="section-padding bg-brand-surface/30">
            <div className="max-w-container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">{t('benefitsTitle')}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {benefits.map((b, i) => (
                        <div key={i} className="text-center group">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/15 to-brand-secondary/15 flex items-center justify-center mx-auto mb-4 group-hover:from-brand-primary/25 group-hover:to-brand-secondary/25 transition-all">
                                <b.icon className="w-7 h-7 text-brand-primary" />
                            </div>
                            <h3 className="text-base font-semibold text-brand-text-primary mb-2">{t(b.titleKey)}</h3>
                            <p className="text-sm text-brand-text-secondary leading-relaxed">{t(b.descKey)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
