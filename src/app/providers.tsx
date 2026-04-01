'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-provider';
import ThemeDecorations from '@/components/shared/ThemeDecorations';
import AnnouncementPopup from '@/components/AnnouncementPopup';
import { UIProvider } from '@/components/shared/UIProvider';
import ProtectionEngine from '@/components/shared/ProtectionEngine';
import { I18nProvider } from '@/lib/i18n';
import { CurrencyProvider } from '@/lib/currency';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider>
            <CurrencyProvider>
                <ThemeProvider>
                    <AuthProvider>
                        <UIProvider>
                            {children}
                            <AnnouncementPopup />
                            <ProtectionEngine />
                        </UIProvider>
                    </AuthProvider>
                    <ThemeDecorations />
                </ThemeProvider>
            </CurrencyProvider>
        </I18nProvider>
    );
}
