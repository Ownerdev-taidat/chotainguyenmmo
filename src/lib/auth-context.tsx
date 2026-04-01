'use client';

/**
 * AuthContext — Antigravity Secure Auth 2026
 * ===========================================
 * ✅ Fix React Error #418: KHÔNG đọc localStorage/cookie trong initial render
 * ✅ httpOnly cookie auth: token KHÔNG lưu trong localStorage
 * ✅ Tự migrate token cũ từ localStorage → httpOnly cookie
 * ✅ Backward compatible: secureFetch vẫn hoạt động
 */

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
    // ⚠️ FIX #418: Luôn bắt đầu với null — KHÔNG đọc localStorage trong initial render
    // Điều này đảm bảo server HTML = client HTML → không hydration mismatch
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch wallet balance — dùng credentials: 'include' để gửi httpOnly cookie
    const refreshWallet = useCallback(async () => {
        try {
            const res = await fetch('/api/v1/wallet/balance', {
                credentials: 'include', // Gửi httpOnly cookie
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.success) {
                setUser(prev => {
                    if (!prev) return prev;
                    const updated = { ...prev, walletBalance: data.data.availableBalance };
                    // Chỉ lưu user info (không lưu token)
                    try { localStorage.setItem('user', JSON.stringify(updated)); } catch {}
                    return updated;
                });
            }
        } catch { /* silent fail */ }
    }, []);

    // ---- MIGRATION + HYDRATION ----
    // Chạy 1 lần sau khi mount (client-only) → fix #418
    useEffect(() => {
        try {
            // 1. Đọc user info từ localStorage (chỉ dùng để hiển thị UI nhanh)
            const savedUser = localStorage.getItem('user');

            // 2. Check xem có token cũ trong localStorage không → migrate sang cookie
            const oldToken = localStorage.getItem('token');
            const oldAdminToken = localStorage.getItem('admin_token');

            if (oldToken || oldAdminToken) {
                const tokenToMigrate = oldToken || oldAdminToken;

                // Gọi API để set httpOnly cookie từ token cũ
                fetch('/api/v1/auth/migrate-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: tokenToMigrate }),
                    credentials: 'include',
                }).then(res => res.json()).then(data => {
                    if (data.success) {
                        // Xóa token khỏi localStorage — mission accomplished!
                        localStorage.removeItem('token');
                        localStorage.removeItem('admin_token');
                        // Set user data
                        if (data.data?.user) {
                            setUser(data.data.user);
                            setToken('httpOnly'); // Marker — token thực ở cookie
                            localStorage.setItem('user', JSON.stringify(data.data.user));
                            document.cookie = 'logged_in=1; path=/; max-age=31536000';
                        }
                    } else {
                        // Token hết hạn — xóa hết
                        localStorage.removeItem('token');
                        localStorage.removeItem('admin_token');
                        localStorage.removeItem('user');
                        document.cookie = 'logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                    }
                    setIsLoading(false);
                }).catch(() => {
                    // Fallback: token cũ vẫn hoạt động qua Authorization header
                    if (savedUser) {
                        try {
                            setUser(JSON.parse(savedUser));
                            setToken(tokenToMigrate);
                        } catch {}
                    }
                    setIsLoading(false);
                });
                return; // Đợi migration xong
            }

            // 3. Không có token cũ — check cookie auth
            if (savedUser && document.cookie.includes('logged_in=1')) {
                try {
                    setUser(JSON.parse(savedUser));
                    setToken('httpOnly');
                } catch {}
            }
        } catch { /* ignore */ }
        setIsLoading(false);
    }, []);

    // Auto-refresh wallet
    useEffect(() => {
        if (!user) return;
        refreshWallet();
        const interval = setInterval(refreshWallet, 30000);
        return () => clearInterval(interval);
    }, [user, refreshWallet]);

    const login = (newToken: string, newUser: AuthUser) => {
        // Login API đã set httpOnly cookie → chỉ cần set state
        setToken('httpOnly');
        setUser(newUser);
        // Lưu user info (KHÔNG lưu token)
        localStorage.setItem('user', JSON.stringify(newUser));
        document.cookie = 'logged_in=1; path=/; max-age=31536000';
        // Refresh wallet
        setTimeout(() => refreshWallet(), 500);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        // Xóa tất cả
        localStorage.removeItem('token');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('user');
        // Clear cookies  
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        // Gọi server để clear httpOnly cookie
        fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
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
