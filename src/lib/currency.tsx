'use client';

import { useI18n, type Locale } from '@/lib/i18n';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';

// ══════════════════════════════════════
// CURRENCY FORMATTING UTILITY
// ══════════════════════════════════════
//
// Vietnamese (vi): shows VND → 50.000đ
// English (en):    shows USD → $1.90
//
// Conversion uses live USDT/VND rate from CoinGecko.
// The rate is fetched once on mount and cached for 5 minutes.

const DEFAULT_RATE = 25000;

/**
 * Format a VND amount based on locale.
 * - vi: 50.000đ
 * - en: $1.90
 */
export function formatCurrency(amountVnd: number, locale: Locale, rate: number = DEFAULT_RATE): string {
    if (locale === 'en') {
        const usd = amountVnd / rate;
        if (usd >= 1) {
            return `$${usd.toFixed(2)}`;
        }
        // Small amounts: show more precision
        return `$${usd.toFixed(4)}`;
    }
    return amountVnd.toLocaleString('vi-VN') + 'đ';
}

/**
 * Format a VND amount to a short human-readable string.
 * - vi: 1.5M đ, 200K đ
 * - en: $57.69, $7.69
 */
export function formatCurrencyShort(amountVnd: number, locale: Locale, rate: number = DEFAULT_RATE): string {
    if (locale === 'en') {
        const usd = amountVnd / rate;
        return `$${usd.toFixed(2)}`;
    }
    if (amountVnd >= 1000000000) return `${(amountVnd / 1000000000).toFixed(1)} tỷ`;
    if (amountVnd >= 1000000) return `${(amountVnd / 1000000).toFixed(0)} triệu`;
    if (amountVnd >= 1000) return `${(amountVnd / 1000).toFixed(0)}K đ`;
    return amountVnd.toLocaleString('vi-VN') + 'đ';
}

/**
 * Get the currency symbol for the current locale.
 */
export function getCurrencySymbol(locale: Locale): string {
    return locale === 'en' ? '$' : 'đ';
}

/**
 * Get the currency label for display.
 */
export function getCurrencyLabel(locale: Locale): string {
    return locale === 'en' ? 'USD' : 'VNĐ';
}

// ══════════════════════════════════════
// REACT CONTEXT FOR LIVE RATE
// ══════════════════════════════════════

interface CurrencyContextType {
    rate: number;
    rateSource: string;
    formatVnd: (amountVnd: number) => string;
    formatVndShort: (amountVnd: number) => string;
    symbol: string;
    label: string;
    locale: Locale;
}

const CurrencyContext = createContext<CurrencyContextType>({
    rate: DEFAULT_RATE,
    rateSource: 'default',
    formatVnd: (n) => n.toLocaleString('vi-VN') + 'đ',
    formatVndShort: (n) => n.toLocaleString('vi-VN') + 'đ',
    symbol: 'đ',
    label: 'VNĐ',
    locale: 'vi',
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const { locale } = useI18n();
    const [rate, setRate] = useState(DEFAULT_RATE);
    const [rateSource, setRateSource] = useState('loading');

    // Fetch live rate on mount + every 5 minutes
    useEffect(() => {
        let mounted = true;
        const fetchRate = async () => {
            try {
                const res = await fetch('/api/v1/exchange-rate');
                const data = await res.json();
                if (data.success && mounted) {
                    setRate(data.data.rate);
                    setRateSource(data.data.source);
                }
            } catch {
                // Keep last rate or default
            }
        };
        fetchRate();
        const interval = setInterval(fetchRate, 5 * 60 * 1000);
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    const formatVnd = useCallback((amountVnd: number) => {
        return formatCurrency(amountVnd, locale, rate);
    }, [locale, rate]);

    const formatVndShort = useCallback((amountVnd: number) => {
        return formatCurrencyShort(amountVnd, locale, rate);
    }, [locale, rate]);

    const symbol = getCurrencySymbol(locale);
    const label = getCurrencyLabel(locale);

    return (
        <CurrencyContext.Provider value={{ rate, rateSource, formatVnd, formatVndShort, symbol, label, locale }}>
            {children}
        </CurrencyContext.Provider>
    );
}

/**
 * Hook to get currency formatting functions that respect locale + live rate.
 * 
 * Usage:
 *   const { formatVnd, symbol } = useCurrency();
 *   <span>{formatVnd(50000)}</span> // → "50.000đ" (vi) or "$1.90" (en)
 */
export function useCurrency() {
    return useContext(CurrencyContext);
}
