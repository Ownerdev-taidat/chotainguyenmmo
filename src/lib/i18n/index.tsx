'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import vi, { type TranslationKeys, categoryNameMapVI } from './vi';
import en, { categoryNameMapEN } from './en';

export type Locale = 'vi' | 'en';

interface I18nContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: TranslationKeys) => string;
    tCat: (slug: string, fallbackName: string) => string;
}

const translations: Record<Locale, Record<string, string>> = { vi, en };

const I18nContext = createContext<I18nContextType>({
    locale: 'vi',
    setLocale: () => {},
    t: (key) => vi[key] || key,
    tCat: (_slug, fallback) => fallback,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('vi');
    const [ready, setReady] = useState(false);

    // Initialize: check localStorage first, then IP-based detection
    useEffect(() => {
        const saved = localStorage.getItem('ctn_locale');
        if (saved === 'vi' || saved === 'en') {
            setLocaleState(saved);
            setReady(true);
            return;
        }

        // Auto-detect via IP geolocation
        detectCountry().then((isVietnam) => {
            const detectedLocale: Locale = isVietnam ? 'vi' : 'en';
            setLocaleState(detectedLocale);
            localStorage.setItem('ctn_locale', detectedLocale);
            setReady(true);
        }).catch(() => {
            setReady(true); // fallback to Vietnamese
        });
    }, []);

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem('ctn_locale', newLocale);
        // Update html lang attribute
        document.documentElement.lang = newLocale;
    }, []);

    const t = useCallback((key: TranslationKeys): string => {
        return translations[locale]?.[key] || translations.vi[key] || key;
    }, [locale]);

    const categoryMaps: Record<Locale, Record<string, string>> = { vi: categoryNameMapVI, en: categoryNameMapEN };
    const tCat = useCallback((slug: string, fallbackName: string): string => {
        return categoryMaps[locale]?.[slug] || fallbackName;
    }, [locale]);

    // Update html lang on locale change
    useEffect(() => {
        if (ready) {
            document.documentElement.lang = locale;
        }
    }, [locale, ready]);

    return (
        <I18nContext.Provider value={{ locale, setLocale, t, tCat }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    return useContext(I18nContext);
}

/**
 * Detect if user is from Vietnam using free IP geolocation API
 * Falls back to true (Vietnamese) if detection fails
 */
async function detectCountry(): Promise<boolean> {
    try {
        // Try multiple free APIs for reliability
        const res = await fetch('https://ipapi.co/json/', {
            signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
            const data = await res.json();
            return data.country_code === 'VN';
        }
    } catch {}

    try {
        const res = await fetch('https://ip-api.com/json/?fields=countryCode', {
            signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
            const data = await res.json();
            return data.countryCode === 'VN';
        }
    } catch {}

    // Default to Vietnamese
    return true;
}
