'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import { Plus, Search, Edit, Trash2, Eye, Package, X, Save, Loader2, CheckCircle2, Shield, Upload, ImagePlus, Link, Database, Percent } from 'lucide-react';

interface Variant {
    id: string;
    name: string;
    price: string;
    warrantyDays: string;
    stockItems: string;
}

interface SellerProduct {
    id: string;
    name: string;
    slug: string;
    shortDescription: string;
    price: number;
    status: string;
    deliveryType: string;
    stockCount: number;
    soldCount: number;
    categoryId: string;
    categoryName: string;
    imageUrl?: string;
    variants: { id: string; name: string; price: number; warrantyDays: number; isActive: boolean }[];
    createdAt: string;
}

interface Category {
    id: string;
    name: string;
    slug: string;
    feePercent: number | null;
}

type ModalType = 'view' | 'edit' | 'add' | null;

export default function SellerProductsPage() {
    const { user } = useAuth();
    const { t } = useI18n();
    const [products, setProducts] = useState<SellerProduct[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [modal, setModal] = useState<ModalType>(null);
    const [selectedProduct, setSelectedProduct] = useState<SellerProduct | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [toast, setToast] = useState('');
    const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [stats, setStats] = useState({ total: 0, active: 0, outOfStock: 0, draft: 0 });
    const [formData, setFormData] = useState<{
        name: string; price: string; categoryId: string; shortDescription: string;
        deliveryType: 'auto' | 'manual'; imageUrl: string; variants: Variant[];
    }>({
        name: '', price: '', categoryId: '', shortDescription: '', deliveryType: 'auto', imageUrl: '',
        variants: [{ id: '1', name: 'Gói cơ bản', price: '', warrantyDays: '3', stockItems: '' }],
    });

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    useEffect(() => { loadProducts(); loadCategories(); }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/seller/products', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                setProducts(data.data.products);
                setStats(data.data.stats);
            }
        } catch { }
        setLoading(false);
    };

    const loadCategories = async () => {
        try {
            const res = await fetch('/api/v1/categories');
            const data = await res.json();
            if (data.success) setCategories(data.data);
        } catch { }
    };

    const filtered = products.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && p.status === 'ACTIVE') || (statusFilter === 'out' && p.stockCount === 0);
        return matchSearch && matchStatus;
    });

    const openAdd = () => {
        setFormData({
            name: '', price: '', categoryId: '', shortDescription: '', deliveryType: 'auto', imageUrl: '',
            variants: [{ id: Date.now().toString(), name: 'Gói cơ bản', price: '', warrantyDays: '3', stockItems: '' }],
        });
        setSelectedProduct(null);
        setModal('add');
    };

    const openEdit = async (p: SellerProduct) => {
        setSelectedProduct(p);
        setModal('edit');
        // Initialize form first
        setFormData({
            name: p.name, price: String(p.price), categoryId: p.categoryId,
            shortDescription: p.shortDescription || '', deliveryType: p.deliveryType === 'MANUAL' ? 'manual' : 'auto',
            imageUrl: p.imageUrl || '',
            variants: p.variants.length > 0
                ? p.variants.map(v => ({ id: v.id, name: v.name, price: String(v.price), warrantyDays: String(v.warrantyDays), stockItems: '' }))
                : [{ id: '1', name: 'Gói cơ bản', price: String(p.price), warrantyDays: '3', stockItems: '' }],
        });
        // Fetch existing stock items for this product
        try {
            const res = await fetch(`/api/v1/seller/inventory/items?productId=${p.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success && data.data?.length > 0) {
                const stockText = data.data.map((item: any) => item.rawContent).join('\n');
                setFormData(prev => ({
                    ...prev,
                    variants: prev.variants.map((v, i) => i === 0 ? { ...v, stockItems: stockText } : v),
                }));
            }
        } catch { }
    };

    const openView = (p: SellerProduct) => { setSelectedProduct(p); setModal('view'); };

    const addVariant = () => {
        setFormData(prev => ({
            ...prev,
            variants: [...prev.variants, { id: Date.now().toString(), name: '', price: '', warrantyDays: '3', stockItems: '' }],
        }));
    };

    const removeVariant = (id: string) => {
        if (formData.variants.length <= 1) return;
        setFormData(prev => ({ ...prev, variants: prev.variants.filter(v => v.id !== id) }));
    };

    const handleSave = async () => {
        if (!formData.name.trim()) { showToast(t('spNameRequired')); return; }
        if (!formData.categoryId) { showToast(t('spCategoryRequired')); return; }

        setSaving(true);
        try {
            const isEdit = modal === 'edit' && selectedProduct;
            const res = await fetch('/api/v1/seller/products', {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    ...(isEdit && { id: selectedProduct.id }),
                    name: formData.name.trim(),
                    categoryId: formData.categoryId,
                    shortDescription: formData.shortDescription.trim(),
                    price: formData.variants[0]?.price || formData.price,
                    deliveryType: formData.deliveryType,
                    imageUrl: formData.imageUrl.trim() || undefined,
                    variants: formData.variants.map(v => ({
                        name: v.name.trim(),
                        price: v.price,
                        warrantyDays: v.warrantyDays,
                        stockItems: v.stockItems.trim(),
                    })),
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${data.message}`);
                setModal(null);
                loadProducts();
            } else {
                showToast(`❌ ${data.message}`);
            }
        } catch { showToast(t('spConnectionError')); }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/v1/seller/products?id=${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                showToast(t('spDeleted'));
                loadProducts();
            } else {
                showToast(`❌ ${data.message}`);
            }
        } catch { showToast('❌ Lỗi'); }
        setDeleteTarget(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('spTitle')}</h1>
                    <p className="text-sm text-brand-text-muted">{t('spSubtitle')}</p>
                </div>
                <button onClick={openAdd} className="btn-primary flex items-center gap-2 !py-2 text-sm">
                    <Plus className="w-4 h-4" /> {t('spAddProduct')}
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: t('spTotalProducts'), value: stats.total, color: 'text-brand-primary' },
                    { label: t('spActive'), value: stats.active, color: 'text-brand-success' },
                    { label: t('spOutOfStock'), value: stats.outOfStock, color: 'text-brand-warning' },
                    { label: t('spDraft'), value: stats.draft, color: 'text-brand-text-muted' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className="text-xs text-brand-text-muted mb-1">{s.label}</div>
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('spSearchPlaceholder')} className="input-field !pl-9 w-full text-sm" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field text-sm w-auto">
                    <option value="all">{t('spFilterAll')}</option>
                    <option value="active">{t('spFilterActive')}</option>
                    <option value="out">{t('spFilterOut')}</option>
                </select>
            </div>

            {/* Products Table */}
            <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2/50">
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">{t('spProduct')}</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">{t('spPrice')}</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">{t('spStock')}</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">{t('spSold')}</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">{t('spStatus')}</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">{t('spActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-12 text-brand-text-muted">
                                    <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">{t('spEmptyState')}</p>
                                </td></tr>
                            ) : filtered.map(p => (
                                <tr key={p.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="text-sm font-medium text-brand-text-primary">{p.name}</div>
                                        <div className="text-[10px] text-brand-text-muted">{p.categoryName} · {p.deliveryType === 'AUTO' ? t('spAutoDelivery') : t('spManualDelivery')}</div>
                                    </td>
                                    <td className="py-3 px-4 text-center font-semibold text-brand-primary">{formatCurrency(p.price)}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`font-semibold ${p.stockCount > 5 ? 'text-brand-success' : p.stockCount > 0 ? 'text-brand-warning' : 'text-brand-danger'}`}>{p.stockCount}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center text-brand-text-muted">{p.soldCount}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`badge text-[10px] ${p.status === 'ACTIVE' ? 'badge-success' : p.status === 'DRAFT' ? 'badge-default' : 'badge-warning'}`}>
                                            {p.status === 'ACTIVE' ? t('spActive2') : p.status === 'DRAFT' ? t('spDraft2') : p.status}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => openView(p)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-info hover:bg-brand-surface-2"><Eye className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2"><Edit className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => setDeleteTarget(p.id)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {(modal === 'add' || modal === 'edit') && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setModal(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">
                            {modal === 'add' ? t('spAddNew') : t('spEditProduct')}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-1.5">{t('spProductName')}</label>
                                <input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className="input-field w-full" placeholder="VD: ChatGPT Plus - Premium" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-brand-text-primary mb-1">{t('spProductImage')}</label>
                                <div className="flex items-center gap-2">
                                    {imageTab === 'upload' ? (
                                        <label
                                            className={`flex items-center justify-center gap-2 flex-1 h-10 border border-dashed rounded-lg cursor-pointer transition-all text-xs ${uploading ? 'border-brand-primary/50 bg-brand-primary/5' : 'border-brand-border hover:border-brand-primary/40 hover:bg-brand-surface-2/50'
                                                }`}
                                            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                                            onDrop={async e => {
                                                e.preventDefault(); e.stopPropagation();
                                                const file = e.dataTransfer.files?.[0];
                                                if (!file) return;
                                                setUploading(true);
                                                const fd = new FormData(); fd.append('file', file);
                                                try {
                                                    const res = await fetch('/api/v1/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                                                    const data = await res.json();
                                                    if (data.success) { setFormData(prev => ({ ...prev, imageUrl: data.url })); showToast(t('spUploadSuccess')); }
                                                    else showToast(`❌ ${data.message}`);
                                                } catch { showToast(t('spUploadError')); }
                                                setUploading(false);
                                            }}
                                        >
                                            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif" onChange={async e => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                setUploading(true);
                                                const fd = new FormData(); fd.append('file', file);
                                                try {
                                                    const res = await fetch('/api/v1/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                                                    const data = await res.json();
                                                    if (data.success) { setFormData(prev => ({ ...prev, imageUrl: data.url })); showToast(t('spUploadSuccess')); }
                                                    else showToast(`❌ ${data.message}`);
                                                } catch { showToast(t('spUploadError')); }
                                                setUploading(false);
                                                e.target.value = '';
                                            }} />
                                            {uploading ? (
                                                <><Loader2 className="w-4 h-4 text-brand-primary animate-spin" /><span className="text-brand-text-muted">Uploading...</span></>
                                            ) : (
                                                <><Upload className="w-4 h-4 text-brand-text-muted" /><span className="text-brand-text-muted"><span className="text-brand-primary font-medium">{t('spUploadBtn')}</span> {t('spUploadOrDrag')}</span></>
                                            )}
                                        </label>
                                    ) : (
                                        <input value={formData.imageUrl} onChange={e => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))} className="input-field flex-1 !py-2 text-xs" placeholder="https://example.com/image.jpg" />
                                    )}
                                    <button type="button" onClick={() => setImageTab(imageTab === 'upload' ? 'url' : 'upload')} className="text-[10px] text-brand-primary hover:underline shrink-0">
                                        {imageTab === 'upload' ? t('spPasteUrl') : t('spUploadBtn')}
                                    </button>
                                </div>
                                {formData.imageUrl && (
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-lg border border-brand-border overflow-hidden shrink-0">
                                            <img src={formData.imageUrl} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                                        </div>
                                        <p className="text-[10px] text-brand-text-muted truncate flex-1">{formData.imageUrl}</p>
                                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))} className="text-[10px] text-brand-danger hover:underline">{t('spRemove')}</button>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] text-brand-text-muted">{t('spCategory')}</label>
                                    <select value={formData.categoryId} onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value }))} className="input-field w-full !py-1.5 text-sm">
                                        <option value="">{t('spSelectCategory')}</option>
                                        {categories.map(c => (<option key={c.id} value={c.id}>{c.name}{c.feePercent !== null && c.feePercent !== undefined ? ` (Phí ${c.feePercent}%)` : ''}</option>))}
                                    </select>
                                    {formData.categoryId && (() => {
                                        const selectedCat = categories.find(c => c.id === formData.categoryId);
                                        if (!selectedCat) return null;
                                        return (
                                            <div className="mt-1 flex items-center gap-1">
                                                <Percent className="w-3 h-3 text-brand-warning" />
                                                <span className="text-[10px] text-brand-warning font-medium">
                                                    Phí sàn: {selectedCat.feePercent !== null && selectedCat.feePercent !== undefined ? `${selectedCat.feePercent}%` : 'Mặc định hệ thống'}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <label className="text-[10px] text-brand-text-muted">{t('spDelivery')}</label>
                                    <select value={formData.deliveryType} onChange={e => setFormData(prev => ({ ...prev, deliveryType: e.target.value as 'auto' | 'manual' }))} className="input-field w-full !py-1.5 text-sm">
                                        <option value="auto">{t('spAutoDelivery')}</option>
                                        <option value="manual">{t('spManualDelivery')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-brand-text-muted">{t('spShortDesc')}</label>
                                    <textarea value={formData.shortDescription} onChange={e => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))} className="input-field w-full resize-none !py-1.5 text-sm" rows={2} placeholder={t('spDescPlaceholder')} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5">
                                        <Shield className="w-4 h-4 text-brand-primary" /> {t('spVariantsTitle')}
                                    </label>
                                    <button onClick={addVariant} className="text-xs text-brand-primary hover:underline">{t('spAddVariant')}</button>
                                </div>
                                <p className="text-[10px] text-brand-text-muted mb-3">{t('spVariantDesc')}</p>
                                {formData.variants.map((v, i) => (
                                    <div key={v.id} className="border border-brand-border rounded-xl p-3 mb-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-brand-text-secondary">{t('spVariant')} {i + 1}</span>
                                            {formData.variants.length > 1 && (
                                                <button onClick={() => removeVariant(v.id)} className="text-[10px] text-brand-danger hover:underline">{t('spRemove')}</button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <div>
                                                <label className="text-[10px] text-brand-text-muted">{t('spVariantName')}</label>
                                                <input value={v.name} onChange={e => {
                                                    const variants = [...formData.variants];
                                                    variants[i] = { ...variants[i], name: e.target.value };
                                                    setFormData(prev => ({ ...prev, variants }));
                                                }} className="input-field w-full !py-1.5 text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-brand-text-muted">{t('spVariantPrice')}</label>
                                                <input type="number" value={v.price} onChange={e => {
                                                    const variants = [...formData.variants];
                                                    variants[i] = { ...variants[i], price: e.target.value };
                                                    setFormData(prev => ({ ...prev, variants }));
                                                }} className="input-field w-full !py-1.5 text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-brand-text-muted">{t('spWarrantyDays')}</label>
                                                <input type="number" value={v.warrantyDays} onChange={e => {
                                                    const variants = [...formData.variants];
                                                    variants[i] = { ...variants[i], warrantyDays: e.target.value };
                                                    setFormData(prev => ({ ...prev, variants }));
                                                }} className="input-field w-full !py-1.5 text-sm" />
                                                {parseInt(v.warrantyDays) > 0 && (
                                                    <p className="text-[10px] text-brand-success mt-0.5">
                                                        → {(() => { const d = new Date(); d.setDate(d.getDate() + parseInt(v.warrantyDays)); return d.toLocaleDateString('vi-VN'); })()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="bg-brand-info/5 border border-brand-info/20 rounded-lg px-3 py-2 flex items-center gap-2">
                                            <Database className="w-3.5 h-3.5 text-brand-info shrink-0" />
                                            <p className="text-[10px] text-brand-text-secondary">
                                                📦 Quản lý tồn kho tại tab <a href="/seller/ton-kho" className="text-brand-primary font-semibold hover:underline">Kho hàng</a> — Hỗ trợ upload file .txt/.csv/.xlsx và paste trực tiếp.
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setModal(null)} className="btn-secondary flex-1 !py-3">{t('spCancel')}</button>
                            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {modal === 'add' ? t('spAddProduct') : t('spSaveChanges')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {modal === 'view' && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => setModal(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">{selectedProduct.name}</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-brand-text-muted">{t('spViewCategory')}</span><span>{selectedProduct.categoryName}</span></div>
                            <div className="flex justify-between"><span className="text-brand-text-muted">{t('spViewPrice')}</span><span className="font-semibold text-brand-primary">{formatCurrency(selectedProduct.price)}</span></div>
                            <div className="flex justify-between"><span className="text-brand-text-muted">{t('spViewStock')}</span><span className="font-semibold">{selectedProduct.stockCount}</span></div>
                            <div className="flex justify-between"><span className="text-brand-text-muted">{t('spViewSold')}</span><span>{selectedProduct.soldCount}</span></div>
                            <div className="flex justify-between"><span className="text-brand-text-muted">{t('spViewDelivery')}</span><span>{selectedProduct.deliveryType === 'AUTO' ? t('spAutoDelivery') : t('spManualDelivery')}</span></div>
                            {selectedProduct.variants.length > 0 && (
                                <div className="border-t border-brand-border pt-3">
                                    <div className="text-xs font-semibold text-brand-text-muted mb-2">{t('spViewVariants')}</div>
                                    {selectedProduct.variants.map(v => (
                                        <div key={v.id} className="flex justify-between text-xs py-1">
                                            <span>{v.name}</span>
                                            <span>{formatCurrency(v.price)} · {v.warrantyDays}d BH</span>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                        <h3 className="text-lg font-bold text-brand-text-primary mb-2">{t('spDeleteTitle')}</h3>
                        <p className="text-sm text-brand-text-muted mb-5">{t('spDeleteDesc')}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 !py-3">{t('spCancel')}</button>
                            <button onClick={() => handleDelete(deleteTarget)} className="flex-1 !py-3 bg-brand-danger text-white rounded-xl font-medium hover:bg-brand-danger/90 transition-all">{t('spDeleteBtn')}</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 flex items-center gap-2 animate-slide-up">
                    <CheckCircle2 className="w-5 h-5 text-brand-success" /><span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
