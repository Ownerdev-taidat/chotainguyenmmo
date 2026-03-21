'use client';

import { Star, Quote } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function TestimonialsSection() {
    const { t } = useI18n();

    const testimonials = [
        { name: 'Minh Tuấn', roleKey: 'buyer' as const, avatar: 'MT', rating: 5, contentKey: 'testimonial1' as const },
        { name: 'Hoàng Lan', roleKey: 'seller' as const, avatar: 'HL', rating: 5, contentKey: 'testimonial2' as const },
        { name: 'Thành Đạt', roleKey: 'buyer' as const, avatar: 'TĐ', rating: 5, contentKey: 'testimonial3' as const },
    ];

    return (
        <section className="section-padding bg-brand-surface/30">
            <div className="max-w-container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">{t('testimonialsTitle')}</h2>
                    <p className="text-brand-text-secondary">
                        {t('testimonialsSubtitle')}
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {testimonials.map((item, i) => (
                        <div key={i} className="bg-brand-surface border border-brand-border rounded-2xl p-6 relative">
                            <Quote className="w-8 h-8 text-brand-primary/20 absolute top-4 right-4" />
                            <div className="flex items-center gap-1.5 mb-4">
                                {[...Array(item.rating)].map((_, j) => (
                                    <Star key={j} className="w-4 h-4 text-brand-warning fill-brand-warning" />
                                ))}
                            </div>
                            <p className="text-sm text-brand-text-secondary leading-relaxed mb-6">
                                &ldquo;{t(item.contentKey)}&rdquo;
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                    <span className="text-white text-sm font-semibold">{item.avatar}</span>
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-brand-text-primary">{item.name}</div>
                                    <div className="text-xs text-brand-text-muted">{t(item.roleKey)}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
