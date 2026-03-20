'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard, Wallet, ShoppingBag, AlertTriangle, Heart,
    Bell, User, Shield, LogOut, ChevronLeft, ChevronRight, Menu, X,
    Home, Grid3X3, Store, HelpCircle, Search, PlusCircle, Key,
    Star, BookOpen, MessageSquare, HelpingHand
} from 'lucide-react';

const userMenuItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', href: '/dashboard' },
    { icon: User, label: 'Hồ sơ', href: '/dashboard/ho-so' },
    { icon: Shield, label: 'Bảo mật', href: '/dashboard/bao-mat' },
    { icon: ShoppingBag, label: 'Lịch sử mua hàng', href: '/dashboard/don-hang' },
    { icon: MessageSquare, label: 'Tin nhắn', href: '/dashboard/tin-nhan' },
    { icon: Key, label: 'API Keys', href: '/dashboard/api-keys' },
];

const sidebarLinks = [
    { icon: Home, label: 'Trang chủ', href: '/' },
    { icon: Grid3X3, label: 'Danh mục', href: '/danh-muc' },
    { icon: Star, label: 'Sản phẩm nổi bật', href: '/san-pham-noi-bat' },
    { icon: Store, label: 'Gian hàng', href: '/gian-hang' },
    { icon: BookOpen, label: 'Hướng dẫn', href: '/huong-dan' },
    { icon: HelpingHand, label: 'FAQs', href: '/faqs' },
    { icon: HelpCircle, label: 'Hỗ trợ', href: '/ho-tro' },
    { icon: Search, label: 'Tìm kiếm', href: '/san-pham' },
    { icon: Store, label: 'Seller Center', href: '/seller' },
];

function SidebarContent({ user, onClose, onLogout }: { user: { fullName: string; username: string; email: string } | null; onClose?: () => void; onLogout: () => void }) {
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase();

    return (
        <>
            {/* Brand */}
            <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-md">
                        <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
                            <path d="M8 6L16 2L24 6V18L16 22L8 18V6Z" fill="white" fillOpacity="0.9" />
                            <path d="M16 2L24 6V18L16 22V10L8 6L16 2Z" fill="white" fillOpacity="0.7" />
                            <path d="M12 12L16 10L20 12V18L16 20L12 18V12Z" fill="rgba(59,130,246,0.6)" />
                            <circle cx="16" cy="15" r="2.5" fill="white" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-base font-bold text-brand-text-primary">ChoTaiNguyen</div>
                        <div className="text-[10px] text-brand-text-muted">Bảng điều khiển</div>
                    </div>
                </Link>
                {onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-surface-2 lg:hidden">
                        <X className="w-5 h-5 text-brand-text-muted" />
                    </button>
                )}
            </div>

            {/* User Info */}
            <div className="p-5 border-b border-brand-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">{user ? getInitials(user.fullName) : '?'}</span>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary">{user?.fullName || 'Khách'}</div>
                        <div className="text-xs text-brand-text-muted">@{user?.username || ''}</div>
                    </div>
                </div>
            </div>

            {/* Site Navigation - chỉ hiển thị link quay về trang chính */}
            <nav className="flex-1 p-3 overflow-y-auto">
                <div className="px-4 py-1.5 text-[10px] font-semibold text-brand-text-muted uppercase tracking-wider">
                    Điều hướng
                </div>
                <div className="space-y-0.5">
                    {sidebarLinks.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all"
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Bottom */}
            <div className="p-3 border-t border-brand-border">
                <button onClick={onLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-brand-danger hover:bg-brand-surface-2 transition-all w-full">
                    <LogOut className="w-4 h-4" /> Đăng xuất
                </button>
            </div>
        </>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const tabsRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const handleLogout = () => {
        logout();
        router.push('/dang-nhap');
    };

    // Fetch unread message count
    useEffect(() => {
        if (!user) return;
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
        const fetchUnread = () => {
            fetch('/api/v1/conversations', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(d => {
                    if (d.success && d.data) {
                        const total = d.data.reduce((sum: number, c: any) => sum + (c.unread || 0), 0);
                        setUnreadCount(total);
                    }
                })
                .catch(() => {});
        };
        fetchUnread();
        const interval = setInterval(fetchUnread, 5000);
        return () => clearInterval(interval);
    }, [user]);

    // Check scroll state for tab arrows
    const checkScroll = () => {
        const el = tabsRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };

    useEffect(() => {
        checkScroll();
        const el = tabsRef.current;
        if (el) {
            el.addEventListener('scroll', checkScroll, { passive: true });
            window.addEventListener('resize', checkScroll);
        }
        return () => {
            if (el) el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, []);

    // Scroll active tab into view
    useEffect(() => {
        const el = tabsRef.current;
        if (!el) return;
        const activeTab = el.querySelector('[data-active="true"]') as HTMLElement;
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [pathname]);

    const scrollTabs = (direction: 'left' | 'right') => {
        const el = tabsRef.current;
        if (!el) return;
        el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-brand-bg flex">
            {/* Desktop Sidebar — giờ chỉ chứa điều hướng site */}
            <aside className="hidden lg:flex w-[220px] bg-brand-surface border-r border-brand-border flex-col shrink-0 sticky top-0 h-screen">
                <SidebarContent user={user} onLogout={handleLogout} />
            </aside>

            {/* Mobile Drawer Overlay */}
            {drawerOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
                    <aside className="absolute left-0 top-0 h-full w-[260px] bg-brand-surface border-r border-brand-border flex flex-col shadow-card-hover animate-slide-up">
                        <SidebarContent user={user} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} />
                    </aside>
                </div>
            )}

            {/* Main */}
            <div className="flex-1 min-w-0">
                {/* Horizontal Tab Bar — thay thế "Tổng quan tài khoản" */}
                <header className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur-xl border-b border-brand-border">
                    {/* Top row: mobile menu + wallet + notifications */}
                    <div className="flex items-center justify-between px-4 lg:px-6 py-2.5">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setDrawerOpen(true)}
                                className="lg:hidden p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <Link href="/" className="lg:hidden flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                    <svg viewBox="0 0 32 32" fill="none" className="w-4 h-4">
                                        <path d="M8 6L16 2L24 6V18L16 22L8 18V6Z" fill="white" fillOpacity="0.9" />
                                        <circle cx="16" cy="15" r="2.5" fill="white" />
                                    </svg>
                                </div>
                                <span className="text-sm font-bold text-brand-text-primary">ChoTaiNguyen</span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-brand-success/10 border border-brand-success/20 rounded-xl overflow-hidden">
                                <Link href="/dashboard/vi" className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-brand-success/20 transition-all">
                                    <Wallet className="w-4 h-4 text-brand-success" />
                                    <span className="text-brand-success font-semibold">
                                        {(user?.walletBalance || 0).toLocaleString('vi-VN')}đ
                                    </span>
                                </Link>
                                <Link href="/dashboard/nap-tien" className="flex items-center gap-0.5 bg-brand-primary hover:bg-brand-primary/90 text-white px-2 py-1.5 text-[10px] font-medium transition-all">
                                    <PlusCircle className="w-3 h-3" /> Nạp
                                </Link>
                            </div>
                            <button className="relative p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all">
                                <Bell className="w-5 h-5" />
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-brand-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">2</span>
                            </button>
                        </div>
                    </div>

                    {/* Horizontal scrollable tabs */}
                    <div className="relative">
                        {/* Left scroll arrow */}
                        {canScrollLeft && (
                            <button
                                onClick={() => scrollTabs('left')}
                                className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-r from-brand-bg/95 to-transparent"
                            >
                                <ChevronLeft className="w-4 h-4 text-brand-text-muted" />
                            </button>
                        )}

                        <div
                            ref={tabsRef}
                            className="flex gap-1 overflow-x-auto scrollbar-hide px-4 lg:px-6 pb-2"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {userMenuItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        data-active={isActive}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                                            isActive
                                                ? 'bg-brand-primary text-white shadow-sm'
                                                : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2'
                                        }`}
                                    >
                                    <item.icon className="w-4 h-4" />
                                        {item.label}
                                        {item.href === '/dashboard/tin-nhan' && unreadCount > 0 && (
                                            <span className="min-w-[18px] h-[18px] rounded-full bg-brand-danger text-white text-[10px] font-bold flex items-center justify-center px-1">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Right scroll arrow */}
                        {canScrollRight && (
                            <button
                                onClick={() => scrollTabs('right')}
                                className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-l from-brand-bg/95 to-transparent"
                            >
                                <ChevronRight className="w-4 h-4 text-brand-text-muted" />
                            </button>
                        )}
                    </div>
                </header>

                <main className="p-4 md:p-6">{children}</main>
            </div>
        </div>
    );
}
