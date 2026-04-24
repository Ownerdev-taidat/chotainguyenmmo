'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash2, Plus, FolderTree, X, Save, AlertTriangle, Loader2, Percent } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    slug: string;
    productCount: number;
    feePercent: number | null;
}

export default function AdminCategoriesPage() {
    const [cats, setCats] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [editModal, setEditModal] = useState<{ id?: string; name: string; slug: string; feePercent: string } | null>(null);
    const [deleteModal, setDeleteModal] = useState<Category | null>(null);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

    useEffect(() => { fetchCategories(); }, []);

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/v1/categories');
            const data = await res.json();
            if (data.success) {
                setCats(data.data || []);
            }
        } catch (e) {
            console.error('[Admin Categories] Fetch error:', e);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!editModal || !editModal.name.trim()) return;
        try {
            const feePercent = editModal.feePercent.trim() === '' ? null : parseFloat(editModal.feePercent);
            const res = await fetch('/api/v1/categories', {
                method: editModal.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    id: editModal.id,
                    name: editModal.name,
                    slug: editModal.slug || editModal.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                    feePercent,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(editModal.id ? '✅ Đã cập nhật danh mục' : '✅ Đã thêm danh mục mới');
                fetchCategories();
            } else {
                showToast('❌ ' + (data.message || 'Lỗi'));
            }
        } catch {
            showToast('❌ Lỗi kết nối');
        }
        setEditModal(null);
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch('/api/v1/categories', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ id }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('🗑️ Đã xóa danh mục');
                fetchCategories();
            } else {
                showToast('❌ ' + (data.message || 'Lỗi'));
            }
        } catch {
            showToast('❌ Lỗi kết nối');
        }
        setDeleteModal(null);
    };

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý danh mục</h1>
                    <p className="text-sm text-brand-text-muted">Thêm, sửa, xóa danh mục sản phẩm trên sàn. Thiết lập phí sàn riêng cho từng loại.</p>
                </div>
                <button onClick={() => setEditModal({ name: '', slug: '', feePercent: '' })} className="btn-primary flex items-center gap-2 !py-2 text-sm"><Plus className="w-4 h-4" /> Thêm danh mục</button>
            </div>
            <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead><tr className="bg-brand-surface-2/50">
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Danh mục</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Slug</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Phí sàn %</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Số sản phẩm</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                    </tr></thead>
                    <tbody>
                        {cats.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-12 text-brand-text-muted text-sm">Chưa có danh mục nào</td></tr>
                        ) : cats.map(cat => (
                            <tr key={cat.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                <td className="py-3 px-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center"><FolderTree className="w-4 h-4 text-brand-primary" /></div><span className="text-sm font-medium text-brand-text-primary">{cat.name}</span></div></td>
                                <td className="py-3 px-4 text-xs text-brand-text-muted font-mono">{cat.slug}</td>
                                <td className="py-3 px-4 text-center">
                                    {cat.feePercent !== null && cat.feePercent !== undefined ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-md">
                                            {cat.feePercent}%
                                        </span>
                                    ) : (
                                        <span className="text-xs text-brand-text-muted">Mặc định</span>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-center text-brand-text-secondary">{cat.productCount}</td>
                                <td className="py-3 px-4"><div className="flex items-center justify-center gap-1">
                                    <button onClick={() => setEditModal({ id: cat.id, name: cat.name, slug: cat.slug, feePercent: cat.feePercent !== null && cat.feePercent !== undefined ? String(cat.feePercent) : '' })} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-info hover:bg-brand-surface-2 transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => setDeleteModal(cat)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit/Add Modal */}
            {editModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6">
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-4">{editModal.id ? '✏️ Sửa danh mục' : '➕ Thêm danh mục mới'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">Tên danh mục *</label>
                                <input type="text" value={editModal.name} onChange={e => setEditModal({ ...editModal, name: e.target.value, slug: editModal.id ? editModal.slug : e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} className="input-field" placeholder="VD: Phần mềm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">Slug</label>
                                <input type="text" value={editModal.slug} onChange={e => setEditModal({ ...editModal, slug: e.target.value })} className="input-field font-mono text-sm" placeholder="phan-mem" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">
                                    <div className="flex items-center gap-1.5">
                                        <Percent className="w-3.5 h-3.5 text-brand-primary" />
                                        Phí sàn riêng (%)
                                    </div>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={editModal.feePercent}
                                    onChange={e => setEditModal({ ...editModal, feePercent: e.target.value })}
                                    className="input-field text-sm"
                                    placeholder="Để trống = dùng mặc định hệ thống"
                                />
                                <p className="text-[10px] text-brand-text-muted mt-1">Để trống sẽ dùng phí sàn mặc định từ cài đặt hệ thống. Nhập số 0-100.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setEditModal(null)} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={handleSave} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5"><Save className="w-4 h-4" /> Lưu</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-sm w-full p-6 text-center">
                        <AlertTriangle className="w-10 h-10 text-brand-danger mx-auto mb-3" />
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-2">Xóa danh mục?</h3>
                        <p className="text-xs text-brand-text-muted mb-4">Danh mục <strong>{deleteModal.name}</strong> ({deleteModal.productCount} sản phẩm) sẽ bị xóa vĩnh viễn.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteModal(null)} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={() => handleDelete(deleteModal.id)} className="btn-primary flex-1 text-sm !bg-brand-danger">Xóa</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up"><span className="text-sm text-brand-text-primary font-medium">{toast}</span></div>}
        </div>
    );
}
