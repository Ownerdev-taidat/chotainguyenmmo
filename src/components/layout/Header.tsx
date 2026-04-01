'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    Search, Menu, X, Bell, Wallet, Store, User, ChevronDown,
    LogIn, UserPlus, Settings, LogOut, MessageSquare,
    LayoutDashboard, Package, Heart, Shield, PlusCircle, Clock, CheckCircle, AlertTriangle, Globe
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useCurrency } from '@/lib/currency';


export default function Header() {
    const { user, logout, isLoading } = useAuth();
    const { locale, setLocale, t } = useI18n();
    const { formatVnd } = useCurrency();
    const router = useRouter();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const mobileProfileRef = useRef<HTMLDivElement>(null);
    const dropdownTimeout = useRef<NodeJS.Timeout | null>(null);

    // Close menus when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setNotifOpen(false);
            }
            if (mobileProfileRef.current && !mobileProfileRef.current.contains(event.target as Node)) {
                setMobileProfileOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDropdownEnter = (key: string) => {
        if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current);
        setActiveDropdown(key);
    };
    const handleDropdownLeave = () => {
        dropdownTimeout.current = setTimeout(() => setActiveDropdown(null), 150);
    };

    const handleLogout = () => {
        logout();
        setUserMenuOpen(false);
        router.push('/dang-nhap');
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/san-pham?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase();
    };

    const getDashboardLink = () => {
        if (!user) return '/dashboard';
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return '/admin';
        if (user.role === 'SELLER') return '/seller';
        return '/dashboard';
    };

    // Real notifications from API
    const [notifications, setNotifications] = useState<{ id: string; type: string; title: string; message: string; link?: string; isRead: boolean; createdAt: string }[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const notifTypeConfig: Record<string, { icon: typeof CheckCircle; color: string }> = {
        ORDER: { icon: CheckCircle, color: 'text-brand-success' },
        DEPOSIT: { icon: PlusCircle, color: 'text-brand-primary' },
        DELIVERY: { icon: Package, color: 'text-brand-info' },
        SYSTEM: { icon: Bell, color: 'text-brand-secondary' },
        COMPLAINT: { icon: AlertTriangle, color: 'text-brand-warning' },
        REVIEW: { icon: Heart, color: 'text-brand-warning' },
        WITHDRAWAL: { icon: Wallet, color: 'text-brand-success' },
    };

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/notifications?limit=10', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return; // Silent fail — không log 401 vào console
            const data = await res.json();
            if (data.success) {
                setNotifications(data.data.notifications || []);
                setUnreadCount(data.data.unreadCount || 0);
            }
        } catch {}
    };

    // Fetch notifications when user is logged in
    useEffect(() => {
        if (user) {
            fetchNotifications();
            // Poll every 60 seconds for new notifications
            const interval = setInterval(fetchNotifications, 60000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const handleMarkAllRead = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            await fetch('/api/v1/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ markAll: true }),
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch {}
    };

    const formatTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return locale === 'vi' ? 'Vừa xong' : 'Just now';
        if (mins < 60) return locale === 'vi' ? `${mins} phút trước` : `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return locale === 'vi' ? `${hours} giờ trước` : `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return locale === 'vi' ? `${days} ngày trước` : `${days}d ago`;
    };

    // Unread messages count
    const [unreadMessages, setUnreadMessages] = useState(0);

    const fetchUnreadMessages = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/conversations', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return; // Silent fail
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                const total = data.data.reduce((sum: number, c: any) => sum + (c.unread || 0), 0);
                setUnreadMessages(total);
            }
        } catch {}
    };

    useEffect(() => {
        if (user) {
            fetchUnreadMessages();
            const interval = setInterval(fetchUnreadMessages, 60000);
            return () => clearInterval(interval);
        }
    }, [user]);

    // Navigation items with optional dropdowns
    const navItems: { label: string; href: string; dropdown?: { label: string; href: string; icon: string }[] }[] = [
        { label: t('home'), href: '/' },
        {
            label: t('categories'), href: '/danh-muc',
            dropdown: [
                { label: t('premiumAccounts'), href: '/danh-muc/tai-khoan-premium', icon: '👑' },
                { label: t('keyLicense'), href: '/danh-muc/key-license', icon: '🔑' },
                { label: t('software'), href: '/danh-muc/phan-mem', icon: '💻' },
                { label: t('game'), href: '/danh-muc/game', icon: '🎮' },
                { label: t('socialMedia'), href: '/danh-muc/social-media', icon: '📱' },
                { label: t('aiTools'), href: '/danh-muc/ai-tools', icon: '🤖' },
                { label: t('viewAll'), href: '/danh-muc', icon: '📦' },
            ],
        },
        {
            label: t('products'), href: '/san-pham-noi-bat',
            dropdown: [
                { label: t('featuredProducts'), href: '/san-pham-noi-bat', icon: '⭐' },
                { label: t('newest'), href: '/san-pham?sort=newest', icon: '🆕' },
                { label: t('bestSelling'), href: '/san-pham?sort=bestselling', icon: '🔥' },
                { label: t('bestPrice'), href: '/san-pham?sort=price_asc', icon: '💰' },
            ],
        },
        { label: t('shops'), href: '/gian-hang' },
        { label: t('deposit'), href: '/dashboard/nap-tien' },
        {
            label: t('support'), href: '/ho-tro',
            dropdown: [
                { label: t('buyingGuide'), href: '/huong-dan', icon: '📖' },
                { label: t('faq'), href: '/faqs', icon: '❓' },
                { label: t('contactSupport'), href: '/ho-tro', icon: '💬' },
                { label: t('warrantyPolicy'), href: '/chinh-sach', icon: '🛡️' },
            ],
        },
    ];

    return (
        <header className="sticky top-0 z-50 bg-brand-bg/95 backdrop-blur-xl border-b border-brand-border">
            {/* Announcement Bar */}
            <div className="bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border-b border-brand-border/50">
                <div className="max-w-container mx-auto px-4 py-1.5 text-center text-xs text-brand-text-secondary">
                    {t('announcement')} <span className="text-brand-primary font-medium">{t('announcementHighlight')}</span>
                </div>
            </div>

            {/* Main Header */}
            <div className="max-w-container mx-auto px-4 py-2">
                <div className="header-main-row flex items-center gap-4">
                    {/* Logo */}
                    <Link href="/" className="flex items-center shrink-0">
                        <img src="/logokhongnen.png" alt="ChoTaiNguyen" className="h-[100px] w-auto max-sm:h-[48px]" />
                    </Link>

                    {/* Search — hidden on mobile, shown on md+ */}
                    <form onSubmit={handleSearch} className="max-w-md w-full relative hidden md:block">
                        <div className={`flex items-center bg-brand-surface-2 border rounded-xl transition-all duration-200 ${searchFocused ? 'border-brand-primary ring-1 ring-brand-primary/30' : 'border-brand-border'}`}>
                            <Search className="w-4 h-4 text-brand-text-muted ml-4" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('searchPlaceholder')}
                                className="flex-1 bg-transparent border-none outline-none px-3 py-2.5 text-sm text-brand-text-primary placeholder:text-brand-text-muted"
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                            />
                            <button type="submit" className="bg-brand-primary text-white text-sm font-medium px-4 py-1.5 rounded-lg mr-1.5 hover:brightness-110 transition-all whitespace-nowrap" style={{ minWidth: '70px' }}>
                                {t('searchButton')}
                            </button>
                        </div>
                    </form>

                    {/* Mobile Quick Actions — visible on small screens only */}
                    <div className="flex items-center gap-1 md:hidden ml-auto">
                        {!isLoading && user ? (
                            <>
                                <Link href="/dashboard/tin-nhan" className="relative p-2 rounded-xl text-brand-primary" title="Tin nhắn">
                                    <MessageSquare className="w-5 h-5" />
                                </Link>
                                <Link href="/dashboard/nap-tien" className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-brand-primary/10 text-brand-primary" title="Ví tiền">
                                    <Wallet className="w-3.5 h-3.5" />
                                    <span>{formatVnd(user?.walletBalance || 0)}</span>
                                </Link>
                                {/* Mobile Profile Avatar */}
                                <div className="relative" ref={mobileProfileRef}>
                                    <button
                                        onClick={() => setMobileProfileOpen(!mobileProfileOpen)}
                                        className="flex items-center p-1 rounded-full ring-2 ring-brand-primary/30 hover:ring-brand-primary/60 transition-all"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                            <span className="text-white text-[10px] font-bold">{getInitials(user.fullName)}</span>
                                        </div>
                                    </button>
                                    {mobileProfileOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-56 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover py-1 z-50">
                                            {/* User info */}
                                            <div className="px-4 py-2.5 border-b border-brand-border">
                                                <div className="text-sm font-semibold text-brand-text-primary">{user.fullName}</div>
                                                <div className="text-xs text-brand-text-muted">@{user.username}</div>
                                                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-brand-danger/10 text-brand-danger px-2 py-0.5 rounded-full font-medium">
                                                        <Shield className="w-3 h-3" /> Admin
                                                    </span>
                                                )}
                                                {user.role === 'SELLER' && (
                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-medium">
                                                        <Store className="w-3 h-3" /> Seller
                                                    </span>
                                                )}
                                            </div>
                                            <Link href={getDashboardLink()} onClick={() => setMobileProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-colors">
                                                <LayoutDashboard className="w-4 h-4" /> {t('dashboard')}
                                            </Link>
                                            <Link href="/dashboard/nap-tien" onClick={() => setMobileProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-colors">
                                                <Wallet className="w-4 h-4 text-brand-primary" />
                                                <span>{t('deposit')}</span>
                                                <span className="ml-auto text-xs font-semibold text-brand-success">{formatVnd(user.walletBalance || 0)}</span>
                                            </Link>
                                            <Link href="/dashboard/don-hang" onClick={() => setMobileProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-colors">
                                                <Package className="w-4 h-4" /> {t('orderHistory')}
                                            </Link>
                                            <Link href="/dashboard/ho-so" onClick={() => setMobileProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-colors">
                                                <Settings className="w-4 h-4" /> {t('profile')}
                                            </Link>
                                            <div className="border-t border-brand-border my-1" />
                                            <button onClick={() => { setMobileProfileOpen(false); handleLogout(); }} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-danger hover:bg-brand-surface-2 w-full transition-colors">
                                                <LogOut className="w-4 h-4" /> {t('logout')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : !isLoading ? (
                            <Link href="/dang-nhap" className="btn-primary !px-3 !py-1.5 text-xs flex items-center gap-1">
                                <LogIn className="w-3.5 h-3.5" /> {t('login')}
                            </Link>
                        ) : null}
                    </div>

                    {/* Desktop Actions */}
                    <div className="header-actions hidden lg:flex items-center gap-1.5 ml-auto">
                        {/* Language Toggle */}
                        <button
                            onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
                            className="flex items-center gap-1.5 px-2 py-2 rounded-xl text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all"
                            title={locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
                        >
                            {locale === 'vi' ? (
                                <svg className="w-5 h-4 rounded-sm shrink-0" viewBox="0 0 30 20"><rect width="30" height="20" fill="#DA251D"/><polygon points="15,4 16.8,9.5 22.5,9.5 17.8,12.8 19.5,18.5 15,15.2 10.5,18.5 12.2,12.8 7.5,9.5 13.2,9.5" fill="#FFFF00"/></svg>
                            ) : (
                                <svg className="w-5 h-4 rounded-sm shrink-0" viewBox="0 0 30 20"><rect width="30" height="20" fill="#FFF"/><rect y="0" width="30" height="1.54" fill="#B22234"/><rect y="3.08" width="30" height="1.54" fill="#B22234"/><rect y="6.15" width="30" height="1.54" fill="#B22234"/><rect y="9.23" width="30" height="1.54" fill="#B22234"/><rect y="12.31" width="30" height="1.54" fill="#B22234"/><rect y="15.38" width="30" height="1.54" fill="#B22234"/><rect y="18.46" width="30" height="1.54" fill="#B22234"/><rect width="12" height="10.77" fill="#3C3B6E"/></svg>
                            )}
                            <span className="text-sm font-medium" style={{ minWidth: '20px', textAlign: 'center' }}>{locale === 'vi' ? 'VN' : 'EN'}</span>
                        </button>

                        <Link href="/seller" className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all whitespace-nowrap" style={{ minWidth: '120px' }}>
                            <Store className="w-4 h-4" />
                            <span>{t('sellerCenter')}</span>
                        </Link>


                        {/* Auth actions */}
                        <div className="flex items-center gap-1.5">
                        {!isLoading && user ? (
                            <>
                                {/* Messaging Icon */}
                                <Link href="/dashboard/tin-nhan" className="relative p-2 rounded-xl bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-all" title="Tin nhắn">
                                    <MessageSquare className="w-5 h-5" />
                                    {unreadMessages > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-brand-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">{unreadMessages}</span>
                                    )}
                                </Link>

                                <Link href="/dashboard/nap-tien" className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-brand-primary/10 to-brand-success/10 border border-brand-primary/20 text-brand-primary hover:from-brand-primary/20 hover:to-brand-success/20 transition-all" title="Ví tiền" style={{ minWidth: '110px' }}>
                                    <Wallet className="w-4 h-4" />
                                    <span>{formatVnd(user?.walletBalance || 0)}</span>
                                </Link>

                                {/* Notification Bell */}
                                <div className="relative" ref={notifRef}>
                                    <button
                                        onClick={() => setNotifOpen(!notifOpen)}
                                        className="relative p-2 rounded-xl text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all"
                                    >
                                        <Bell className="w-5 h-5" />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-brand-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    {notifOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-80 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover z-50 overflow-hidden">
                                            <div className="px-4 py-3 border-b border-brand-border flex items-center justify-between">
                                                <span className="text-sm font-semibold text-brand-text-primary">{t('notifications')}</span>
                                                {unreadCount > 0 && (
                                                    <span onClick={handleMarkAllRead} className="text-[11px] text-brand-primary cursor-pointer hover:underline">{t('markAsRead')}</span>
                                                )}
                                            </div>
                                            <div className="max-h-80 overflow-y-auto">
                                                {notifications.length === 0 ? (
                                                    <div className="px-4 py-8 text-center text-sm text-brand-text-muted">
                                                        {locale === 'vi' ? 'Chưa có thông báo nào' : 'No notifications yet'}
                                                    </div>
                                                ) : notifications.map((notif) => {
                                                    const config = notifTypeConfig[notif.type] || { icon: Bell, color: 'text-brand-text-muted' };
                                                    const NotifIcon = config.icon;
                                                    return (
                                                        <div key={notif.id} onClick={() => notif.link && router.push(notif.link)} className={`px-4 py-3 border-b border-brand-border/50 hover:bg-brand-surface-2 cursor-pointer transition-colors ${!notif.isRead ? 'bg-brand-primary/5' : ''}`}>
                                                            <div className="flex gap-3">
                                                                <div className={`mt-0.5 ${config.color}`}>
                                                                    <NotifIcon className="w-4 h-4" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium text-brand-text-primary">{notif.title}</p>
                                                                    <p className="text-xs text-brand-text-muted mt-0.5 line-clamp-2">{notif.message}</p>
                                                                    <div className="flex items-center gap-1 mt-1">
                                                                        <Clock className="w-3 h-3 text-brand-text-muted" />
                                                                        <span className="text-[10px] text-brand-text-muted">{formatTimeAgo(notif.createdAt)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <Link href="/dashboard/thong-bao" onClick={() => setNotifOpen(false)} className="block text-center py-2.5 text-sm text-brand-primary font-medium hover:bg-brand-surface-2 transition-colors">
                                                {t('viewAllNotifications')}
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                {/* User Menu */}
                                <div className="relative" ref={menuRef}>
                                    <button
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-brand-surface-2 transition-all"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">{getInitials(user.fullName)}</span>
                                        </div>
                                        <span className="text-sm font-medium text-brand-text-primary max-w-[100px] truncate">{user.username}</span>
                                        <ChevronDown className={`w-3 h-3 text-brand-text-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {userMenuOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover py-2 z-50">
                                            {/* User info */}
                                            <div className="px-4 py-3 border-b border-brand-border">
                                                <div className="text-sm font-semibold text-brand-text-primary">{user.fullName}</div>
                                                <div className="text-xs text-brand-text-muted">@{user.username}</div>
                                                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-brand-danger/10 text-brand-danger px-2 py-0.5 rounded-full font-medium">
                                                        <Shield className="w-3 h-3" /> Admin
                                                    </span>
                                                )}
                                                {user.role === 'SELLER' && (
                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-medium">
                                                        <Store className="w-3 h-3" /> Seller
                                                    </span>
                                                )}
                                            </div>
                                            <Link href={getDashboardLink()} onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-colors">
                                                <LayoutDashboard className="w-4 h-4" /> {t('dashboard')}
                                            </Link>
                                            <Link href="/dashboard/vi" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-colors">
                                                <Wallet className="w-4 h-4 text-brand-success" />
                                                <span>{t('myWallet')}</span>
                                                <span className="ml-auto text-xs font-semibold text-brand-success">{formatVnd(user.walletBalance || 0)}</span>
                                            </Link>
                                            <Link href="/dashboard/don-hang" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-colors">
                                                <Package className="w-4 h-4" /> {t('orderHistory')}
                                            </Link>
                                            <Link href="/dashboard/ho-so" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-colors">
                                                <Settings className="w-4 h-4" /> {t('profile')}
                                            </Link>
                                            <div className="border-t border-brand-border my-1" />
                                            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-danger hover:bg-brand-surface-2 w-full">
                                                <LogOut className="w-4 h-4" /> {t('logout')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : !isLoading ? (
                            <div className="flex items-center gap-2">
                                <Link href="/dang-nhap" className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1.5">
                                    <LogIn className="w-4 h-4" /> {t('login')}
                                </Link>
                                <Link href="/dang-ky" className="btn-primary !px-4 !py-2 text-sm flex items-center gap-1.5">
                                    <UserPlus className="w-4 h-4" /> {t('register')}
                                </Link>
                            </div>
                        ) : (
                            /* Skeleton that matches logged-in user menu dimensions */
                            <>
                                <div className="w-10 h-10 rounded-xl bg-brand-surface-2 animate-pulse" />
                                <div className="w-20 h-8 rounded-xl bg-brand-surface-2 animate-pulse" />
                                <div className="w-9 h-9 rounded-xl bg-brand-surface-2 animate-pulse" />
                                <div className="w-8 h-8 rounded-full bg-brand-surface-2 animate-pulse" />
                            </>
                        )}
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all"
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Mobile Search Row — visible on small screens only */}
                <form onSubmit={handleSearch} className="md:hidden mt-2 px-0">
                    <div className={`flex items-center bg-brand-surface-2 border rounded-xl transition-all duration-200 ${searchFocused ? 'border-brand-primary ring-1 ring-brand-primary/30' : 'border-brand-border'}`}>
                        <Search className="w-4 h-4 text-brand-text-muted ml-3" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('searchPlaceholderMobile')}
                            className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-muted"
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                        />
                        <button type="submit" className="bg-brand-primary text-white text-xs font-medium px-3 py-1 rounded-lg mr-1 hover:brightness-110 transition-all whitespace-nowrap">
                            {t('searchButtonMobile')}
                        </button>
                    </div>
                </form>

                {/* Category Navigation with Dropdowns */}
                <nav className="header-nav-row hidden lg:flex items-center gap-1 mt-2 -mx-2">
                    {navItems.map((item, i) => {
                        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                        const hasDropdown = item.dropdown && item.dropdown.length > 0;

                        return (
                            <div
                                key={i}
                                className="relative"
                                onMouseEnter={() => hasDropdown && handleDropdownEnter(item.label)}
                                onMouseLeave={handleDropdownLeave}
                            >
                                <Link
                                    href={item.href}
                                    className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center justify-center gap-1 whitespace-nowrap ${isActive ? 'text-brand-primary font-semibold bg-brand-primary/10' : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2'}`}
                                    style={{ minWidth: '85px' }}
                                >
                                    {item.label}
                                    {hasDropdown && <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === item.label ? 'rotate-180' : ''}`} />}
                                </Link>

                                {/* Dropdown Menu */}
                                {hasDropdown && activeDropdown === item.label && (
                                    <div className="absolute left-0 top-full pt-1 z-50" style={{ minWidth: '220px' }}>
                                        <div className="bg-brand-surface border border-brand-border rounded-xl shadow-card-hover py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                            {item.dropdown!.map((sub, j) => (
                                                <Link
                                                    key={j}
                                                    href={sub.href}
                                                    onClick={() => setActiveDropdown(null)}
                                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-colors"
                                                >
                                                    <span className="text-base">{sub.icon}</span>
                                                    <span>{sub.label}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="lg:hidden bg-brand-surface border-t border-brand-border">
                    <div className="px-4 py-3 space-y-1">
                        {navItems.map((item, i) => (
                            <div key={i}>
                                <Link
                                    href={item.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block py-2 text-brand-text-secondary hover:text-brand-text-primary font-medium"
                                >
                                    {item.label}
                                </Link>
                                {item.dropdown && (
                                    <div className="pl-4 space-y-0.5">
                                        {item.dropdown.map((sub, j) => (
                                            <Link
                                                key={j}
                                                href={sub.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="flex items-center gap-2 py-1.5 text-sm text-brand-text-muted hover:text-brand-text-primary"
                                            >
                                                <span>{sub.icon}</span>
                                                <span>{sub.label}</span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Language Toggle for mobile */}
                        <div className="border-t border-brand-border pt-2 mt-1">
                            <button
                                onClick={() => { setLocale(locale === 'vi' ? 'en' : 'vi'); setMobileMenuOpen(false); }}
                                className="flex items-center gap-2 py-2 text-brand-text-secondary hover:text-brand-text-primary font-medium w-full"
                            >
                                {locale === 'vi' ? (
                                    <svg className="w-5 h-4 rounded-sm shrink-0" viewBox="0 0 30 20"><rect width="30" height="20" fill="#FFF"/><rect y="0" width="30" height="1.54" fill="#B22234"/><rect y="3.08" width="30" height="1.54" fill="#B22234"/><rect y="6.15" width="30" height="1.54" fill="#B22234"/><rect y="9.23" width="30" height="1.54" fill="#B22234"/><rect y="12.31" width="30" height="1.54" fill="#B22234"/><rect y="15.38" width="30" height="1.54" fill="#B22234"/><rect y="18.46" width="30" height="1.54" fill="#B22234"/><rect width="12" height="10.77" fill="#3C3B6E"/></svg>
                                ) : (
                                    <svg className="w-5 h-4 rounded-sm shrink-0" viewBox="0 0 30 20"><rect width="30" height="20" fill="#DA251D"/><polygon points="15,4 16.8,9.5 22.5,9.5 17.8,12.8 19.5,18.5 15,15.2 10.5,18.5 12.2,12.8 7.5,9.5 13.2,9.5" fill="#FFFF00"/></svg>
                                )}
                                <span>{locale === 'vi' ? 'English' : 'Tiếng Việt'}</span>
                                <span className="ml-auto text-xs font-medium text-brand-primary">{locale === 'vi' ? 'VN' : 'EN'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
