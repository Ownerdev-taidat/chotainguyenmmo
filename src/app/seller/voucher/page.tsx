'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    Ticket, Plus, Edit, Trash2, Search, X, CheckCircle2, Loader2,
    Calendar, Tag, Package, Copy, Percent, DollarSign
} from 'lucide-react';

interface VoucherData {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    minOrderAmount: number | null;
    maxDiscount: number | null;
    productId: string | null;
    productName: string | null;
    usageLimit: number;
    usedCount: number;
    isActive: boolean;
    startsAt: string;
    expiresAt: string | null;
    createdAt: string;
}

interface Product {
    id: string;
    name: string;
}

export default function VoucherPage() {
    const { user } = useAuth();
    const [vouchers, setVouchers] = useState<VoucherData[]>([]);
    const [stats, setStats] = useState({ total: 0, active: 0, used: 0, totalDiscount: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<'add' | 'edit' | null>(null);
    const [editingVoucher, setEditingVoucher] = useState<VoucherData | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [toast, setToast] = useState('');
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const [form, setForm] = useState({
        code: '', discountType: 'PERCENT', discountValue: '', minOrderAmount: '',
        maxDiscount: '', productId: '', usageLimit: '100', expiresAt: '',
    });

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => { loadVouchers(); loadProducts(); }, []);

    const loadVouchers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/seller/vouchers', { headers });
            const data = await res.json();
            if (data.success) {
                setVouchers(data.data.vouchers);
                setStats(data.data.stats);
            }
        } catch { }
        setLoading(false);
    };

    const loadProducts = async () => {
        try {
            const res = await fetch('/api/v1/seller/products', { headers });
            const data = await res.json();
            if (data.success) setProducts(data.data.products.map((p: any) => ({ id: p.id, name: p.name })));
        } catch { }
    };

    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
        setForm(prev => ({ ...prev, code }));
    };

    const openAdd = () => {
        setForm({ code: '', discountType: 'PERCENT', discountValue: '', minOrderAmount: '', maxDiscount: '', productId: '', usageLimit: '100', expiresAt: '' });
        setEditingVoucher(null);
        setModal('add');
        generateCode();
    };

    const openEdit = (v: VoucherData) => {
        setEditingVoucher(v);
        setForm({
            code: v.code,
            discountType: v.discountType,
            discountValue: String(v.discountValue),
            minOrderAmount: v.minOrderAmount ? String(v.minOrderAmount) : '',
            maxDiscount: v.maxDiscount ? String(v.maxDiscount) : '',
            productId: v.productId || '',
            usageLimit: String(v.usageLimit),
            expiresAt: v.expiresAt ? v.expiresAt.split('T')[0] : '',
        });
        setModal('edit');
    };

    const handleSave = async () => {
        if (!form.code.trim() || !form.discountValue) { showToast('❌ Cần mã và giá trị giảm'); return; }
        setSaving(true);
        try {
            const isEdit = modal === 'edit' && editingVoucher;
            const res = await fetch('/api/v1/seller/vouchers', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(isEdit && { id: editingVoucher.id }),
                    code: form.code.toUpperCase().trim(),
                    discountType: form.discountType,
                    discountValue: form.discountValue,
                    minOrderAmount: form.minOrderAmount || undefined,
                    maxDiscount: form.maxDiscount || undefined,
                    productId: form.productId || undefined,
                    usageLimit: form.usageLimit,
                    expiresAt: form.expiresAt || undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${data.message}`);
                setModal(null);
                loadVouchers();
            } else {
                showToast(`❌ ${data.message}`);
            }
        } catch { showToast('❌ Lỗi kết nối'); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/v1/seller/vouchers?id=${id}`, { method: 'DELETE', headers });
            const data = await res.json();
            if (data.success) {
                showToast('✅ Đã xóa voucher');
                loadVouchers();
            } else showToast(`❌ ${data.message}`);
        } catch { showToast('❌ Lỗi'); }
        setDeleteTarget(null);
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        showToast(`📋 Đã copy: ${code}`);
    };

    const filtered = vouchers.filter(v => !search || v.code.toLowerCase().includes(search.toLowerCase()) || (v.productName || '').toLowerCase().includes(search.toLowerCase()));

    if (loading) {
        return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1 flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-brand-primary" />
                        Tạo Voucher
                    </h1>
                    <p className="text-sm text-brand-text-muted">Tạo mã giảm giá cho sản phẩm để tri ân khách hàng.</p>
                </div>
                <button onClick={openAdd} className="btn-primary flex items-center gap-2 !py-2 text-sm">
                    <Plus className="w-4 h-4" /> Tạo mã giảm giá
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng voucher', value: stats.total, icon: Ticket, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
                    { label: 'Đang hoạt động', value: stats.active, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Lượt sử dụng', value: stats.used, icon: Tag, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                            <s.icon className={`w-5 h-5 ${s.color}`} />
                        </div>
                        <div>
                            <div className="text-[10px] text-brand-text-muted font-medium uppercase tracking-wider">{s.label}</div>
                            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã giảm giá..." className="input-field !pl-9 w-full text-sm" />
            </div>

            {/* Voucher list */}
            <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2/50">
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mã giảm giá</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Loại</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Giá trị</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Sản phẩm</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Sử dụng</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Hết hạn</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-12 text-brand-text-muted">
                                    <Ticket className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">{vouchers.length === 0 ? 'Chưa có voucher. Tạo mã giảm giá ngay!' : 'Không tìm thấy.'}</p>
                                </td></tr>
                            ) : filtered.map(v => {
                                const isExpired = v.expiresAt && new Date(v.expiresAt) < new Date();
                                const isExhausted = v.usedCount >= v.usageLimit;
                                return (
                                    <tr key={v.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <code className="text-sm font-bold text-brand-primary font-mono bg-brand-primary/5 px-2 py-0.5 rounded">{v.code}</code>
                                                <button onClick={() => copyCode(v.code)} className="p-1 rounded hover:bg-brand-surface-2"><Copy className="w-3 h-3 text-brand-text-muted" /></button>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {v.discountType === 'PERCENT'
                                                ? <span className="flex items-center justify-center gap-1 text-xs"><Percent className="w-3 h-3" /> Phần trăm</span>
                                                : <span className="flex items-center justify-center gap-1 text-xs"><DollarSign className="w-3 h-3" /> Cố định</span>
                                            }
                                        </td>
                                        <td className="py-3 px-4 text-center font-semibold text-brand-primary">
                                            {v.discountType === 'PERCENT' ? `${v.discountValue}%` : `${v.discountValue.toLocaleString()}đ`}
                                            {v.maxDiscount && <span className="block text-[10px] text-brand-text-muted font-normal">Tối đa {v.maxDiscount.toLocaleString()}đ</span>}
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs text-brand-text-secondary">
                                            {v.productName || <span className="text-brand-text-muted">Tất cả</span>}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="text-xs">{v.usedCount}/{v.usageLimit}</span>
                                            <div className="w-full bg-brand-border/50 rounded-full h-1 mt-1">
                                                <div className="bg-brand-primary h-1 rounded-full transition-all" style={{ width: `${Math.min(100, (v.usedCount / v.usageLimit) * 100)}%` }} />
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs text-brand-text-muted">
                                            {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString('vi-VN') : '∞'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {!v.isActive ? (
                                                <span className="badge text-[10px] badge-default">Tắt</span>
                                            ) : isExpired ? (
                                                <span className="badge text-[10px] badge-danger">Hết hạn</span>
                                            ) : isExhausted ? (
                                                <span className="badge text-[10px] badge-warning">Hết lượt</span>
                                            ) : (
                                                <span className="badge text-[10px] badge-success">Hoạt động</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2"><Edit className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => setDeleteTarget(v.id)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => setModal(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-4 flex items-center gap-2">
                            <Ticket className="w-5 h-5 text-brand-primary" />
                            {modal === 'add' ? 'Tạo voucher mới' : 'Chỉnh sửa voucher'}
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Mã giảm giá</label>
                                <div className="flex gap-2">
                                    <input value={form.code} onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                        className="input-field flex-1 font-mono text-sm uppercase" placeholder="VD: SALE20" readOnly={modal === 'edit'} />
                                    {modal === 'add' && (
                                        <button onClick={generateCode} className="text-xs text-brand-primary hover:underline whitespace-nowrap px-2">🎲 Random</button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Loại giảm</label>
                                    <select value={form.discountType} onChange={e => setForm(prev => ({ ...prev, discountType: e.target.value }))} className="input-field w-full text-sm">
                                        <option value="PERCENT">Phần trăm (%)</option>
                                        <option value="FIXED">Cố định (VNĐ)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-brand-text-secondary mb-1 block">
                                        Giá trị {form.discountType === 'PERCENT' ? '(%)' : '(VNĐ)'}
                                    </label>
                                    <input type="number" value={form.discountValue} onChange={e => setForm(prev => ({ ...prev, discountValue: e.target.value }))}
                                        className="input-field w-full text-sm" placeholder={form.discountType === 'PERCENT' ? 'VD: 10' : 'VD: 50000'} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Đơn tối thiểu (VNĐ)</label>
                                    <input type="number" value={form.minOrderAmount} onChange={e => setForm(prev => ({ ...prev, minOrderAmount: e.target.value }))}
                                        className="input-field w-full text-sm" placeholder="0 = không giới hạn" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Giảm tối đa (VNĐ)</label>
                                    <input type="number" value={form.maxDiscount} onChange={e => setForm(prev => ({ ...prev, maxDiscount: e.target.value }))}
                                        className="input-field w-full text-sm" placeholder="0 = không giới hạn" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Áp dụng cho sản phẩm</label>
                                <select value={form.productId} onChange={e => setForm(prev => ({ ...prev, productId: e.target.value }))} className="input-field w-full text-sm">
                                    <option value="">Tất cả sản phẩm</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Giới hạn lượt dùng</label>
                                    <input type="number" value={form.usageLimit} onChange={e => setForm(prev => ({ ...prev, usageLimit: e.target.value }))}
                                        className="input-field w-full text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-brand-text-secondary mb-1 block">Hết hạn</label>
                                    <input type="date" value={form.expiresAt} onChange={e => setForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                                        className="input-field w-full text-sm" />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setModal(null)} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {modal === 'add' ? 'Tạo voucher' : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-sm w-full p-6 animate-slide-up text-center">
                        <Trash2 className="w-12 h-12 text-brand-danger mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-brand-text-primary mb-2">Xóa voucher?</h3>
                        <p className="text-sm text-brand-text-muted mb-5">Voucher sẽ bị xóa vĩnh viễn.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button onClick={() => handleDelete(deleteTarget)} className="flex-1 !py-3 bg-brand-danger text-white rounded-xl font-medium hover:bg-brand-danger/90">Xóa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 flex items-center gap-2 animate-slide-up">
                    <CheckCircle2 className="w-5 h-5 text-brand-success" /><span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
