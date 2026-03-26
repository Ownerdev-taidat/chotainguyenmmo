'use client';

import { useState, useEffect } from 'react';
import { Search, Eye, Store, CheckCircle, Star, Ban, PlusCircle, MinusCircle, History, Lock, Unlock, X, FileText, User, XCircle, Clock, AlertTriangle, Trash2, Package, ShoppingCart, DollarSign, TrendingUp, BarChart3, Wallet, Calendar } from 'lucide-react';
import { useUI } from '@/components/shared/UIProvider';

interface SellerApp {
    id: string;
    userId: string;
    username: string;
    userEmail: string;
    shopName: string;
    kycFullName?: string;
    kycCccd?: string;
    kycPhone?: string;
    kycAddress?: string;
    bankName: string;
    bankAccount: string;
    bankOwner: string;
    status: string;
    kycCompleted: boolean;
    createdAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
    rejectionReason?: string;
}

interface ShopSeller {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    status: string;
    verified: boolean;
    joinedAt: string;
    createdAt: string;
    ratingAverage: number;
    ratingCount: number;
    owner: {
        id: string;
        username: string;
        email: string;
        fullName: string;
        phone: string | null;
        wallet: { availableBalance: number; heldBalance: number } | null;
    };
    productCount: number;
    totalOrders: number;
    successfulOrders: number;
    totalRevenue: number;
    complaintCount: number;
    walletBalance: number;
    walletHeld: number;
}

interface ShopDetail {
    shop: {
        id: string;
        name: string;
        slug: string;
        logoUrl: string | null;
        bannerUrl: string | null;
        shortDescription: string | null;
        status: string;
        verified: boolean;
        ratingAverage: number;
        ratingCount: number;
        joinedAt: string;
        createdAt: string;
        bankName: string | null;
        bankAccount: string | null;
        bankAccountName: string | null;
    };
    owner: {
        id: string;
        username: string;
        email: string;
        fullName: string;
        phone: string | null;
        createdAt: string;
        lastLoginAt: string | null;
        wallet: {
            availableBalance: number;
            heldBalance: number;
            totalDeposited: number;
            totalSpent: number;
            totalWithdrawn: number;
        } | null;
    };
    stats: {
        totalProducts: number;
        productStats: Record<string, number>;
        totalOrders: number;
        completedOrders: number;
        totalRevenue: number;
        totalComplaints: number;
        resolvedComplaints: number;
        complaintRate: number;
    };
    recentProducts: {
        id: string;
        name: string;
        slug: string;
        price: number;
        status: string;
        soldCount: number;
        stockCountCached: number;
        ratingAverage: number | null;
        images: { url: string }[];
        createdAt: string;
    }[];
    recentOrders: {
        id: string;
        orderCode: string;
        totalAmount: number;
        status: string;
        createdAt: string;
        buyer: { username: string; fullName: string };
    }[];
}

type ModalType = 'kyc' | 'balance' | 'history' | 'ban' | 'profile' | null;

const formatVnd = (amount: number) => amount.toLocaleString('vi-VN') + 'đ';
const formatDate = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatDateTime = (d: string) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusLabels: Record<string, { text: string; class: string }> = {
    PENDING: { text: 'Chờ duyệt', class: 'badge-warning' },
    ACTIVE: { text: 'Hoạt động', class: 'badge-success' },
    REJECTED: { text: 'Từ chối', class: 'badge-danger' },
    SUSPENDED: { text: 'Tạm khóa', class: 'badge-warning' },
};

const orderStatusLabels: Record<string, { text: string; class: string }> = {
    PENDING: { text: 'Chờ', class: 'text-brand-warning' },
    PAID: { text: 'Đã TT', class: 'text-brand-info' },
    PROCESSING: { text: 'Xử lý', class: 'text-brand-primary' },
    COMPLETED: { text: 'Hoàn tất', class: 'text-brand-success' },
    CANCELLED: { text: 'Hủy', class: 'text-brand-danger' },
    DISPUTED: { text: 'Tranh chấp', class: 'text-brand-danger' },
    REFUNDED: { text: 'Hoàn tiền', class: 'text-brand-warning' },
};

const productStatusLabels: Record<string, string> = {
    ACTIVE: '🟢 Hoạt động',
    DRAFT: '⚪ Nháp',
    PENDING_REVIEW: '🟡 Chờ duyệt',
    PAUSED: '🟠 Tạm dừng',
    OUT_OF_STOCK: '🔴 Hết hàng',
    REJECTED: '❌ Từ chối',
    ARCHIVED: '📦 Lưu trữ',
};

export default function AdminSellersPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<'sellers' | 'applications'>('applications');
    const { showToast: globalToast, showConfirm } = useUI();

    // Seller applications
    const [apps, setApps] = useState<SellerApp[]>([]);
    const [appsLoading, setAppsLoading] = useState(true);
    const [rejectModal, setRejectModal] = useState<{ appId: string; reason: string } | null>(null);

    // Real sellers from DB
    const [sellers, setSellers] = useState<ShopSeller[]>([]);
    const [sellersLoading, setSellersLoading] = useState(false);

    // Profile detail modal
    const [profileModal, setProfileModal] = useState<{ shopId: string } | null>(null);
    const [profileData, setProfileData] = useState<ShopDetail | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileTab, setProfileTab] = useState<'overview' | 'products' | 'orders'>('overview');

    const showToast = (msg: string) => {
        globalToast(msg.replace(/^[✅❌🗑️🚫🔒] */, ''), msg.startsWith('✅') || msg.startsWith('🗑️') ? 'success' : msg.startsWith('❌') ? 'error' : msg.startsWith('🚫') || msg.startsWith('🔒') ? 'warning' : 'info');
    };

    useEffect(() => { loadApps(); }, []);
    useEffect(() => { if (activeTab === 'sellers') loadSellers(); }, [activeTab]);

    const getToken = () => localStorage.getItem('token') || '';

    const loadApps = async () => {
        setAppsLoading(true);
        try {
            const res = await fetch('/api/v1/seller/register?view=all', {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            const data = await res.json();
            if (data.success) {
                setApps(data.data);
                // Pre-build seller list from approved apps as fallback
                buildSellersFromApps(data.data);
            }
        } catch { }
        setAppsLoading(false);
    };

    // Fallback: build seller list from applications data (like old deployed code)
    const buildSellersFromApps = (appData: SellerApp[]) => {
        const approved = appData.filter((a: SellerApp) => a.status === 'ACTIVE' || a.status === 'APPROVED');
        if (approved.length > 0 && sellers.length === 0) {
            const fallbackSellers: ShopSeller[] = approved.map(a => ({
                id: a.id,
                name: a.shopName,
                slug: a.shopName.toLowerCase().replace(/\s+/g, '-'),
                logoUrl: null,
                status: 'ACTIVE',
                verified: true,
                joinedAt: a.createdAt,
                createdAt: a.createdAt,
                ratingAverage: 0,
                ratingCount: 0,
                owner: {
                    id: a.userId,
                    username: a.username,
                    email: a.userEmail,
                    fullName: a.kycFullName || a.username,
                    phone: a.kycPhone || null,
                    wallet: null,
                },
                productCount: 0,
                totalOrders: 0,
                successfulOrders: 0,
                totalRevenue: 0,
                complaintCount: 0,
                walletBalance: 0,
                walletHeld: 0,
            }));
            setSellers(fallbackSellers);
        }
    };

    const loadSellers = async () => {
        setSellersLoading(true);
        try {
            const res = await fetch('/api/v1/admin/sellers', {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                setSellers(data.data);
            } else {
                // Fallback to apps-based list
                buildSellersFromApps(apps);
            }
        } catch {
            // Fallback to apps-based list
            buildSellersFromApps(apps);
        }
        setSellersLoading(false);
    };

    const loadProfile = async (shopId: string) => {
        setProfileModal({ shopId });
        setProfileLoading(true);
        setProfileTab('overview');
        setProfileData(null);
        try {
            const res = await fetch(`/api/v1/admin/sellers/${shopId}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            const data = await res.json();
            if (data.success) setProfileData(data.data);
        } catch { }
        setProfileLoading(false);
    };

    const reviewApp = async (appId: string, decision: 'APPROVED' | 'REJECTED', reason?: string) => {
        try {
            const res = await fetch('/api/v1/seller/register', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                body: JSON.stringify({ action: 'review', appId, decision, reviewedBy: 'admin', reason }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${data.message}`);
                setRejectModal(null);
                loadApps();
            }
        } catch { showToast('❌ Lỗi'); }
    };

    const deleteApp = async (appId: string) => {
        showConfirm({
            title: 'Xóa đơn đăng ký',
            message: 'Bạn chắc chắn muốn xóa đơn đăng ký/gian hàng này? Hành động không thể hoàn tác!',
            confirmText: 'Xóa vĩnh viễn',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    const res = await fetch('/api/v1/seller/register', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                        body: JSON.stringify({ action: 'delete', appId }),
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast('Đã xóa thành công');
                        loadApps();
                        if (activeTab === 'sellers') loadSellers();
                    } else {
                        showToast(`❌ ${data.message}`);
                    }
                } catch { showToast('❌ Lỗi'); }
            }
        });
    };

    const pendingAppsCount = apps.filter(a => a.status === 'PENDING').length;

    const filteredSellers = sellers.filter(s => {
        const matchSearch = !searchTerm ||
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.owner.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.owner.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchSearch && matchStatus;
    });

    // Aggregate stats for sellers tab header
    const totalRevenue = sellers.reduce((s, sel) => s + sel.totalRevenue, 0);
    const totalProducts = sellers.reduce((s, sel) => s + sel.productCount, 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý người bán</h1>
                <p className="text-sm text-brand-text-muted">Duyệt đơn đăng ký, quản lý shop, xem chi tiết profile sellers.</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-brand-border">
                <button onClick={() => setActiveTab('applications')}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'applications' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-text-muted hover:text-brand-text-primary'}`}>
                    Đơn đăng ký
                    {pendingAppsCount > 0 && <span className="ml-2 bg-brand-danger text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingAppsCount}</span>}
                </button>
                <button onClick={() => setActiveTab('sellers')}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'sellers' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-text-muted hover:text-brand-text-primary'}`}>
                    Danh sách Seller ({sellers.length})
                </button>
            </div>

            {/* ==================== TAB: Đơn đăng ký ==================== */}
            {activeTab === 'applications' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Tổng đơn', value: apps.length, color: 'text-brand-primary' },
                            { label: 'Chờ duyệt', value: apps.filter(a => a.status === 'PENDING').length, color: 'text-brand-warning' },
                            { label: 'Đã duyệt', value: apps.filter(a => a.status === 'APPROVED').length, color: 'text-brand-success' },
                            { label: 'Từ chối', value: apps.filter(a => a.status === 'REJECTED').length, color: 'text-brand-danger' },
                        ].map((s, i) => (
                            <div key={i} className="card !p-4">
                                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {appsLoading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full" /></div>
                    ) : apps.length === 0 ? (
                        <div className="card text-center py-12">
                            <Store className="w-10 h-10 text-brand-text-muted mx-auto mb-3" />
                            <p className="text-sm text-brand-text-muted">Chưa có đơn đăng ký nào.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {apps.map(app => (
                                <div key={app.id} className={`card !p-4 border-l-4 ${app.status === 'PENDING' ? 'border-l-brand-warning' : app.status === 'APPROVED' ? 'border-l-brand-success' : app.status === 'REJECTED' ? 'border-l-brand-danger' : 'border-l-brand-info'}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="text-sm font-bold text-brand-text-primary">{app.shopName}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${app.status === 'APPROVED' ? 'bg-brand-success/10 text-brand-success' :
                                                    app.status === 'PENDING' ? 'bg-brand-warning/10 text-brand-warning' :
                                                        app.status === 'REJECTED' ? 'bg-brand-danger/10 text-brand-danger' :
                                                            'bg-brand-info/10 text-brand-info'
                                                    }`}>
                                                    {app.status === 'APPROVED' ? '✅ Đã duyệt' : app.status === 'PENDING' ? '⏳ Chờ duyệt' : app.status === 'REJECTED' ? '❌ Từ chối' : '📋 Cần KYC'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-brand-text-muted space-y-0.5">
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> @{app.username}</span>
                                                    <span>📧 {app.userEmail}</span>
                                                    <span>🏦 {app.bankName} — {app.bankAccount} ({app.bankOwner})</span>
                                                </div>
                                                {app.kycFullName && (
                                                    <div className="flex items-center gap-4 flex-wrap mt-1">
                                                        <span>👤 {app.kycFullName}</span>
                                                        <span>🪪 CCCD: {app.kycCccd}</span>
                                                        <span>📱 {app.kycPhone}</span>
                                                        {app.kycAddress && <span>📍 {app.kycAddress}</span>}
                                                    </div>
                                                )}
                                                <div className="mt-1">
                                                    <span>📅 {formatDateTime(app.createdAt)}</span>
                                                    {app.reviewedBy && <span className="ml-3">✏️ Duyệt bởi: {app.reviewedBy} — {app.reviewedAt && formatDate(app.reviewedAt)}</span>}
                                                </div>
                                            </div>
                                            {app.rejectionReason && (
                                                <div className="mt-2 text-xs text-brand-danger flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Lý do từ chối: {app.rejectionReason}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            {app.status === 'PENDING' && (
                                                <>
                                                    <button onClick={() => reviewApp(app.id, 'APPROVED')} className="btn-primary !py-2 !px-4 text-xs flex items-center gap-1.5">
                                                        <CheckCircle className="w-3.5 h-3.5" /> Duyệt
                                                    </button>
                                                    <button onClick={() => setRejectModal({ appId: app.id, reason: '' })} className="btn-secondary !py-2 !px-4 text-xs flex items-center gap-1.5 text-brand-danger border-brand-danger/30 hover:bg-brand-danger/5">
                                                        <XCircle className="w-3.5 h-3.5" /> Từ chối
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={() => deleteApp(app.id)} className="p-2 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors" title="Xóa vĩnh viễn">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ==================== TAB: Danh sách Seller ==================== */}
            {activeTab === 'sellers' && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {[
                            { label: 'Tổng sellers', value: sellers.length, color: 'text-brand-primary' },
                            { label: 'Đang hoạt động', value: sellers.filter(s => s.status === 'ACTIVE').length, color: 'text-brand-success' },
                            { label: 'Tổng sản phẩm', value: totalProducts, color: 'text-brand-info' },
                            { label: 'Bị khóa', value: sellers.filter(s => s.status === 'SUSPENDED').length, color: 'text-brand-danger' },
                            { label: 'Tổng doanh thu', value: formatVnd(totalRevenue), color: 'text-brand-warning' },
                        ].map((s, i) => (
                            <div key={i} className="card !p-4">
                                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="card !p-4 flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm shop, username, email..." className="input-field !py-2 !pl-10 text-sm w-full" />
                        </div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !py-2 text-sm min-w-[140px]">
                            <option value="all">Tất cả</option>
                            <option value="ACTIVE">Hoạt động</option>
                            <option value="PENDING">Chờ duyệt</option>
                            <option value="SUSPENDED">Tạm khóa</option>
                        </select>
                    </div>

                    {sellersLoading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full" /></div>
                    ) : (
                        <div className="card !p-0 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead><tr className="bg-brand-surface-2/50">
                                    <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Shop</th>
                                    <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">SP</th>
                                    <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số dư</th>
                                    <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Doanh thu</th>
                                    <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Đơn hàng</th>
                                    <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Rating</th>
                                    <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                                    <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                                </tr></thead>
                                <tbody>
                                    {filteredSellers.length === 0 ? (
                                        <tr><td colSpan={8} className="text-center py-12 text-brand-text-muted">Không có seller nào</td></tr>
                                    ) : filteredSellers.map(s => (
                                        <tr key={s.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 cursor-pointer" onClick={() => loadProfile(s.id)}>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center overflow-hidden">
                                                        {s.logoUrl ? <img src={s.logoUrl} className="w-full h-full object-cover" /> : <Store className="w-4 h-4 text-brand-primary" />}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5">
                                                            {s.name}
                                                            {s.verified && <CheckCircle className="w-3.5 h-3.5 text-brand-success" />}
                                                        </div>
                                                        <div className="text-xs text-brand-text-muted">@{s.owner.username} · {s.owner.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center text-brand-text-secondary font-medium">{s.productCount}</td>
                                            <td className="py-3 px-4 text-right font-semibold text-brand-text-primary">{formatVnd(s.walletBalance)}</td>
                                            <td className="py-3 px-4 text-right text-brand-success font-semibold">{formatVnd(s.totalRevenue)}</td>
                                            <td className="py-3 px-4 text-center text-brand-text-secondary">{s.successfulOrders}/{s.totalOrders}</td>
                                            <td className="py-3 px-4 text-center">
                                                {s.ratingAverage > 0 ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Star className="w-3 h-3 text-brand-warning fill-brand-warning" />
                                                        <span className="text-xs font-medium">{s.ratingAverage.toFixed(1)}</span>
                                                        <span className="text-[10px] text-brand-text-muted">({s.ratingCount})</span>
                                                    </div>
                                                ) : <span className="text-xs text-brand-text-muted">—</span>}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`badge text-[10px] ${statusLabels[s.status]?.class || 'badge-info'}`}>
                                                    {statusLabels[s.status]?.text || s.status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); loadProfile(s.id); }} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors" title="Xem chi tiết">
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        const sellerApp = apps.find(a => a.shopName === s.name);
                                                        if (sellerApp) deleteApp(sellerApp.id);
                                                    }} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors" title="Xóa seller">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ==================== MODAL: Reject ==================== */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-brand-text-primary">Lý do từ chối</h3>
                        <textarea value={rejectModal.reason} onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
                            placeholder="Nhập lý do từ chối (tùy chọn)..." className="input-field w-full h-24 resize-none text-sm" />
                        <div className="flex gap-3">
                            <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={() => reviewApp(rejectModal.appId, 'REJECTED', rejectModal.reason)} className="btn-primary flex-1 text-sm !bg-brand-danger hover:!bg-brand-danger/90">Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== MODAL: Seller Profile Detail ==================== */}
            {profileModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setProfileModal(null)}>
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {profileLoading ? (
                            <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full" /></div>
                        ) : profileData ? (
                            <>
                                {/* Header */}
                                <div className="p-6 border-b border-brand-border">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center overflow-hidden border-2 border-brand-primary/20">
                                                {profileData.shop.logoUrl ? <img src={profileData.shop.logoUrl} className="w-full h-full object-cover" /> : <Store className="w-7 h-7 text-brand-primary" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-lg font-bold text-brand-text-primary">{profileData.shop.name}</h2>
                                                    {profileData.shop.verified && <CheckCircle className="w-5 h-5 text-brand-success" />}
                                                    <span className={`badge text-[10px] ${statusLabels[profileData.shop.status]?.class || 'badge-info'}`}>
                                                        {statusLabels[profileData.shop.status]?.text || profileData.shop.status}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-brand-text-muted mt-1 flex items-center gap-3 flex-wrap">
                                                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {profileData.owner.fullName} (@{profileData.owner.username})</span>
                                                    <span>📧 {profileData.owner.email}</span>
                                                    {profileData.owner.phone && <span>📱 {profileData.owner.phone}</span>}
                                                </div>
                                                <div className="text-xs text-brand-text-muted mt-0.5 flex items-center gap-3">
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Đăng ký: {formatDate(profileData.shop.joinedAt)}</span>
                                                    {profileData.owner.lastLoginAt && <span>🕐 Login gần nhất: {formatDateTime(profileData.owner.lastLoginAt)}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => setProfileModal(null)} className="p-2 rounded-xl hover:bg-brand-surface-2 transition-colors">
                                            <X className="w-5 h-5 text-brand-text-muted" />
                                        </button>
                                    </div>

                                    {/* Bank info */}
                                    {profileData.shop.bankName && (
                                        <div className="mt-3 p-3 bg-brand-surface-2/50 rounded-xl text-xs text-brand-text-muted flex items-center gap-4">
                                            <span>🏦 {profileData.shop.bankName}</span>
                                            <span>STK: {profileData.shop.bankAccount}</span>
                                            <span>Chủ TK: {profileData.shop.bankAccountName}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Stats Grid */}
                                <div className="p-6 border-b border-brand-border">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-brand-surface-2/50 rounded-xl p-4 text-center">
                                            <Package className="w-5 h-5 text-brand-primary mx-auto mb-1.5" />
                                            <div className="text-xl font-bold text-brand-text-primary">{profileData.stats.totalProducts}</div>
                                            <div className="text-[10px] text-brand-text-muted mt-0.5">Sản phẩm</div>
                                        </div>
                                        <div className="bg-brand-surface-2/50 rounded-xl p-4 text-center">
                                            <ShoppingCart className="w-5 h-5 text-brand-info mx-auto mb-1.5" />
                                            <div className="text-xl font-bold text-brand-text-primary">{profileData.stats.completedOrders}<span className="text-sm text-brand-text-muted">/{profileData.stats.totalOrders}</span></div>
                                            <div className="text-[10px] text-brand-text-muted mt-0.5">Đơn hoàn tất / Tổng</div>
                                        </div>
                                        <div className="bg-brand-surface-2/50 rounded-xl p-4 text-center">
                                            <DollarSign className="w-5 h-5 text-brand-success mx-auto mb-1.5" />
                                            <div className="text-xl font-bold text-brand-success">{formatVnd(profileData.stats.totalRevenue)}</div>
                                            <div className="text-[10px] text-brand-text-muted mt-0.5">Tổng doanh thu</div>
                                        </div>
                                        <div className="bg-brand-surface-2/50 rounded-xl p-4 text-center">
                                            <Star className="w-5 h-5 text-brand-warning mx-auto mb-1.5" />
                                            <div className="text-xl font-bold text-brand-warning">{profileData.shop.ratingAverage > 0 ? profileData.shop.ratingAverage.toFixed(1) : '—'}</div>
                                            <div className="text-[10px] text-brand-text-muted mt-0.5">{profileData.shop.ratingCount} đánh giá</div>
                                        </div>
                                    </div>

                                    {/* Secondary stats */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                        <div className="bg-brand-surface-2/30 rounded-xl p-3 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-brand-danger/10 flex items-center justify-center">
                                                <AlertTriangle className="w-4 h-4 text-brand-danger" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-brand-text-primary">{profileData.stats.complaintRate}%</div>
                                                <div className="text-[10px] text-brand-text-muted">Tỉ lệ khiếu nại</div>
                                            </div>
                                        </div>
                                        <div className="bg-brand-surface-2/30 rounded-xl p-3 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-brand-warning/10 flex items-center justify-center">
                                                <BarChart3 className="w-4 h-4 text-brand-warning" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-brand-text-primary">{profileData.stats.totalComplaints}</div>
                                                <div className="text-[10px] text-brand-text-muted">Tổng khiếu nại</div>
                                            </div>
                                        </div>
                                        <div className="bg-brand-surface-2/30 rounded-xl p-3 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-brand-success/10 flex items-center justify-center">
                                                <Wallet className="w-4 h-4 text-brand-success" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-brand-success">{formatVnd(profileData.owner.wallet?.availableBalance || 0)}</div>
                                                <div className="text-[10px] text-brand-text-muted">Số dư ví</div>
                                            </div>
                                        </div>
                                        <div className="bg-brand-surface-2/30 rounded-xl p-3 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                                                <TrendingUp className="w-4 h-4 text-brand-primary" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-brand-text-primary">{formatVnd(profileData.owner.wallet?.heldBalance || 0)}</div>
                                                <div className="text-[10px] text-brand-text-muted">Đang giữ</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Sub-tabs: Products & Orders */}
                                <div className="px-6 pt-4">
                                    <div className="flex gap-1 bg-brand-surface-2/50 rounded-xl p-1">
                                        {(['overview', 'products', 'orders'] as const).map(tab => (
                                            <button key={tab} onClick={() => setProfileTab(tab)}
                                                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${profileTab === tab ? 'bg-brand-surface shadow-sm text-brand-primary' : 'text-brand-text-muted hover:text-brand-text-primary'}`}>
                                                {tab === 'overview' ? 'Tổng quan' : tab === 'products' ? `Sản phẩm (${profileData.stats.totalProducts})` : `Đơn hàng (${profileData.stats.totalOrders})`}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-6">
                                    {/* Overview tab */}
                                    {profileTab === 'overview' && (
                                        <div className="space-y-4">
                                            {/* Product status breakdown */}
                                            {Object.keys(profileData.stats.productStats).length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">Trạng thái sản phẩm</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(profileData.stats.productStats).map(([status, count]) => (
                                                            <div key={status} className="bg-brand-surface-2/50 rounded-lg px-3 py-1.5 text-xs">
                                                                {productStatusLabels[status] || status}: <span className="font-bold">{count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {profileData.shop.shortDescription && (
                                                <div>
                                                    <h4 className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-1">Mô tả shop</h4>
                                                    <p className="text-sm text-brand-text-secondary">{profileData.shop.shortDescription}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Products tab */}
                                    {profileTab === 'products' && (
                                        <div className="space-y-2">
                                            {profileData.recentProducts.length === 0 ? (
                                                <p className="text-sm text-brand-text-muted text-center py-8">Chưa có sản phẩm nào</p>
                                            ) : profileData.recentProducts.map(p => (
                                                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-2/30 hover:bg-brand-surface-2/60 transition-colors">
                                                    <div className="w-10 h-10 rounded-lg bg-brand-surface-3 overflow-hidden flex items-center justify-center shrink-0">
                                                        {p.images[0] ? <img src={p.images[0].url} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-brand-text-muted" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-brand-text-primary truncate">{p.name}</div>
                                                        <div className="text-[10px] text-brand-text-muted">{productStatusLabels[p.status] || p.status} · Kho: {p.stockCountCached} · Đã bán: {p.soldCount}</div>
                                                    </div>
                                                    <div className="text-sm font-bold text-brand-primary shrink-0">{formatVnd(p.price)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Orders tab */}
                                    {profileTab === 'orders' && (
                                        <div className="space-y-2">
                                            {profileData.recentOrders.length === 0 ? (
                                                <p className="text-sm text-brand-text-muted text-center py-8">Chưa có đơn hàng nào</p>
                                            ) : profileData.recentOrders.map(o => (
                                                <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-2/30 hover:bg-brand-surface-2/60 transition-colors">
                                                    <div className="w-9 h-9 rounded-lg bg-brand-info/10 flex items-center justify-center shrink-0">
                                                        <ShoppingCart className="w-4 h-4 text-brand-info" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-brand-text-primary">#{o.orderCode}</div>
                                                        <div className="text-[10px] text-brand-text-muted">
                                                            Người mua: {o.buyer.fullName || o.buyer.username} · {formatDateTime(o.createdAt)}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-sm font-bold text-brand-text-primary">{formatVnd(o.totalAmount)}</div>
                                                        <div className={`text-[10px] font-medium ${orderStatusLabels[o.status]?.class || 'text-brand-text-muted'}`}>
                                                            {orderStatusLabels[o.status]?.text || o.status}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20">
                                <AlertTriangle className="w-8 h-8 text-brand-danger mb-3" />
                                <p className="text-sm text-brand-text-muted">Không thể tải thông tin seller</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
