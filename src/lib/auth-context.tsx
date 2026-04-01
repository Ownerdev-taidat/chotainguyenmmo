'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface AuthUser {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
    avatarUrl?: string;
    walletBalance?: number;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string, user: AuthUser) => void;
    logout: () => void;
    updateUser: (data: Partial<AuthUser>) => void;
    refreshWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    isLoading: true,
    login: () => { },
    logout: () => { },
    updateUser: () => { },
    refreshWallet: async () => { },
});

// Helper: check if we're in browser and cookie indicates logged in
function getInitialAuth(): { user: AuthUser | null; token: string | null } {
    if (typeof window === 'undefined') return { user: null, token: null };
    try {
        // Only attempt localStorage read if logged_in cookie exists
        // This avoids the loading skeleton for logged-in users
        const hasCookie = document.cookie.includes('logged_in=1');
        if (!hasCookie) return { user: null, token: null };

        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        if (savedToken && savedUser) {
            return { user: JSON.parse(savedUser), token: savedToken };
        }
    } catch { /* ignore */ }
    return { user: null, token: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const initial = getInitialAuth();
    const [user, setUser] = useState<AuthUser | null>(initial.user);
    const [token, setToken] = useState<string | null>(initial.token);
    // If we got initial data from cookie+localStorage, skip loading state
    const [isLoading, setIsLoading] = useState(!initial.user);

    // Fetch latest wallet balance from DB
    const refreshWallet = useCallback(async () => {
        const t = token || localStorage.getItem('token');
        if (!t) return;
        try {
            const res = await fetch('/api/v1/wallet/balance', {
                headers: { Authorization: `Bearer ${t}` },
            });
            if (!res.ok) return; // Silent fail — tránh log 401 vào console
            const data = await res.json();
            if (data.success) {
                setUser(prev => {
                    if (!prev) return prev;
                    const updated = { ...prev, walletBalance: data.data.availableBalance };
                    localStorage.setItem('user', JSON.stringify(updated));
                    return updated;
                });
            }
        } catch { /* silent fail */ }
    }, [token]);

    // Sync cookies and handle case where cookie exists but localStorage doesn't
    useEffect(() => {
        try {
            const savedToken = localStorage.getItem('token');
            const savedUser = localStorage.getItem('user');
            if (savedToken && savedUser) {
                const parsed = JSON.parse(savedUser);
                setToken(savedToken);
                setUser(parsed);
                document.cookie = 'logged_in=1; path=/; max-age=31536000';
            } else {
                document.cookie = 'logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            }
        } catch { /* ignore */ }
        setIsLoading(false);
    }, []);

    // Auto-refresh wallet balance on mount and every 30 seconds
    useEffect(() => {
        if (!token) return;
        refreshWallet();
        const interval = setInterval(refreshWallet, 30000);
        return () => clearInterval(interval);
    }, [token, refreshWallet]);

    const login = (newToken: string, newUser: AuthUser) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        // Set cookie so SSR knows user is logged in
        document.cookie = 'logged_in=1; path=/; max-age=31536000';
        // Immediately refresh wallet from DB
        setTimeout(() => refreshWallet(), 500);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Clear cookies
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    };

    const updateUser = (data: Partial<AuthUser>) => {
        if (user) {
            const updated = { ...user, ...data };
            setUser(updated);
            localStorage.setItem('user', JSON.stringify(updated));
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser, refreshWallet }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
