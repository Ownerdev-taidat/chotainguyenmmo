'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    Upload, Database, FileText, AlertCircle, Search, X, CheckCircle2, Loader2,
    Trash2, ChevronLeft, ChevronRight, Filter, FileSpreadsheet, Download, UploadCloud
} from 'lucide-react';

interface Product {
    id: string;
    product: string;
    total: number;
    available: number;
    used: number;
    lastUpload: string;
}

interface StockRow {
    id: string;
    rowNumber: number;
    rawContent: string;
    status: string;
    variantId: string | null;
    variantName: string | null;
    createdAt: string;
    soldAt: string | null;
}

interface Variant {
    id: string;
    name: string;
    price: number;
}

interface SheetData {
    product: { id: string; name: string; variants: Variant[] };
    items: StockRow[];
    stats: { total: number; available: number; sold: number; reserved: number };
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function InventoryPage() {
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [stats, setStats] = useState({ total: 0, available: 0, used: 0, low: 0 });
    const [loading, setLoading] = useState(true);
    const [sheetLoading, setSheetLoading] = useState(false);

    // Sheet view
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState<string>('');
    const [sheetData, setSheetData] = useState<SheetData | null>(null);
    const [sheetPage, setSheetPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sheetSearch, setSheetSearch] = useState('');
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    // Upload
    const [uploadModal, setUploadModal] = useState(false);
    const [uploadText, setUploadText] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Toast
    const [toast, setToast] = useState('');
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const headers = { Authorization: `Bearer ${token}` };

    // ── Load products summary ──
    useEffect(() => { loadProducts(); }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/seller/inventory', { headers });
            const data = await res.json();
            if (data.success) {
                setProducts(data.data.products);
                setStats(data.data.stats);
                // Auto-select first product
                if (data.data.products.length > 0 && !selectedProductId) {
                    setSelectedProductId(data.data.products[0].id);
                }
            }
        } catch { }
        setLoading(false);
    };

    // ── Load sheet data when product/variant/page/filter changes ──
    const loadSheetData = useCallback(async () => {
        if (!selectedProductId) return;
        setSheetLoading(true);
        try {
            const params = new URLSearchParams({
                productId: selectedProductId,
                page: String(sheetPage),
                limit: '50',
                status: statusFilter,
            });
            if (selectedVariantId) params.set('variantId', selectedVariantId);
            if (sheetSearch) params.set('search', sheetSearch);

            const res = await fetch(`/api/v1/seller/inventory/detail?${params}`, { headers });
            const data = await res.json();
            if (data.success) {
                setSheetData(data.data);
                setSelectedRows(new Set());
            }
        } catch { }
        setSheetLoading(false);
    }, [selectedProductId, selectedVariantId, sheetPage, statusFilter, sheetSearch]);

    useEffect(() => { loadSheetData(); }, [loadSheetData]);

    // ── Upload handler ──
    const handleUpload = async () => {
        let lines: string[] = [];

        if (uploadFile) {
            const text = await uploadFile.text();
            lines = text.trim().split('\n').filter(l => l.trim());
        } else if (uploadText.trim()) {
            lines = uploadText.trim().split('\n').filter(l => l.trim());
        }

        if (lines.length === 0 || !selectedProductId) return;

        setUploading(true);
        try {
            const res = await fetch('/api/v1/seller/inventory', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: selectedProductId,
                    variantId: selectedVariantId || undefined,
                    items: lines,
                    sourceType: uploadFile ? 'file' : 'paste',
                    fileName: uploadFile?.name,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${data.message}`);
                setUploadModal(false);
                setUploadText('');
                setUploadFile(null);
                loadProducts();
                loadSheetData();
            } else {
                showToast(`❌ ${data.message}`);
            }
        } catch { showToast('❌ Lỗi kết nối'); }
        setUploading(false);
    };

    // ── File reader ──
    const handleFileSelect = (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;
        setUploadFile(file);
        // Read preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.trim().split('\n').filter(l => l.trim());
            setUploadText(lines.slice(0, 20).join('\n') + (lines.length > 20 ? `\n... (và ${lines.length - 20} dòng nữa)` : ''));
        };
        reader.readAsText(file);
    };

    // ── Delete selected rows ──
    const handleDeleteSelected = async () => {
        if (selectedRows.size === 0 || !selectedProductId) return;
        try {
            const res = await fetch('/api/v1/seller/inventory/detail', {
                method: 'DELETE',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: selectedProductId, itemIds: Array.from(selectedRows) }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ Đã xóa ${data.data.deletedCount} mục`);
                setSelectedRows(new Set());
                loadProducts();
                loadSheetData();
            } else {
                showToast(`❌ ${data.message}`);
            }
        } catch { showToast('❌ Lỗi xóa'); }
    };

    // ── Select all toggle ──
    const toggleSelectAll = () => {
        if (!sheetData) return;
        const availableIds = sheetData.items.filter(i => i.status === 'AVAILABLE').map(i => i.id);
        if (selectedRows.size === availableIds.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(availableIds));
        }
    };

    const toggleRow = (id: string) => {
        const next = new Set(selectedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRows(next);
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'AVAILABLE': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Còn hàng</span>;
            case 'SOLD': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">Đã bán</span>;
            case 'RESERVED': return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">Đặt trước</span>;
            default: return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-500/10 text-gray-500">{status}</span>;
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-brand-primary" />
                        Kho hàng
                    </h1>
                    <p className="text-sm text-brand-text-muted">Quản lý tồn kho theo kiểu Google Sheet — Upload, xem, lọc và xóa dữ liệu sản phẩm.</p>
                </div>
                <button onClick={() => setUploadModal(true)} className="btn-primary flex items-center gap-2 !py-2 text-sm" disabled={!selectedProductId}>
                    <UploadCloud className="w-4 h-4" /> Nạp hàng
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng tồn kho', value: stats.total, icon: Database, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
                    { label: 'Còn hàng', value: stats.available, icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Đã sử dụng', value: stats.used, icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Sắp hết hàng', value: stats.low, icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                            <s.icon className={`w-5 h-5 ${s.color}`} />
                        </div>
                        <div>
                            <div className="text-[10px] text-brand-text-muted font-medium uppercase tracking-wider">{s.label}</div>
                            <div className={`text-xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Product + Variant Selector */}
            <div className="card !p-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <label className="text-xs font-medium text-brand-text-muted whitespace-nowrap">📦 Sản phẩm:</label>
                        <select
                            value={selectedProductId || ''}
                            onChange={e => { setSelectedProductId(e.target.value); setSelectedVariantId(''); setSheetPage(1); }}
                            className="input-field !py-1.5 text-sm flex-1"
                        >
                            <option value="">— Chọn sản phẩm —</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.product} ({p.available}/{p.total})</option>
                            ))}
                        </select>
                    </div>
                    {sheetData && sheetData.product.variants.length > 0 && (
                        <div className="flex items-center gap-2 min-w-[180px]">
                            <label className="text-xs font-medium text-brand-text-muted whitespace-nowrap">🏷️ Variant:</label>
                            <select
                                value={selectedVariantId}
                                onChange={e => { setSelectedVariantId(e.target.value); setSheetPage(1); }}
                                className="input-field !py-1.5 text-sm flex-1"
                            >
                                <option value="">Tất cả</option>
                                {sheetData.product.variants.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} — {v.price.toLocaleString()}đ</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex items-center gap-2 min-w-[160px]">
                        <Filter className="w-3.5 h-3.5 text-brand-text-muted" />
                        <select
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setSheetPage(1); }}
                            className="input-field !py-1.5 text-sm"
                        >
                            <option value="ALL">Tất cả</option>
                            <option value="AVAILABLE">Còn hàng</option>
                            <option value="SOLD">Đã bán</option>
                            <option value="RESERVED">Đặt trước</option>
                        </select>
                    </div>
                    <div className="relative min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-brand-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={sheetSearch}
                            onChange={e => { setSheetSearch(e.target.value); setSheetPage(1); }}
                            placeholder="Tìm nội dung..."
                            className="input-field !py-1.5 !pl-8 text-sm w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Spreadsheet Grid */}
            {selectedProductId && (
                <div className="card !p-0 overflow-hidden border border-brand-border">
                    {/* Sheet toolbar */}
                    <div className="flex items-center justify-between px-4 py-2 bg-brand-surface-2/50 border-b border-brand-border">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-brand-text-secondary">
                                {sheetData?.product.name || '...'}
                            </span>
                            {sheetData && (
                                <div className="flex items-center gap-2 text-[10px] text-brand-text-muted">
                                    <span className="text-emerald-500 font-medium">{sheetData.stats.available} còn</span>
                                    <span>•</span>
                                    <span className="text-blue-500 font-medium">{sheetData.stats.sold} bán</span>
                                    <span>•</span>
                                    <span>{sheetData.stats.total} tổng</span>
                                </div>
                            )}
                        </div>
                        {selectedRows.size > 0 && (
                            <button onClick={handleDeleteSelected} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-all">
                                <Trash2 className="w-3 h-3" />
                                Xóa {selectedRows.size} mục
                            </button>
                        )}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        {sheetLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
                            </div>
                        ) : !sheetData || sheetData.items.length === 0 ? (
                            <div className="text-center py-16">
                                <Database className="w-12 h-12 mx-auto mb-3 text-brand-text-muted/30" />
                                <p className="text-sm text-brand-text-muted mb-2">Chưa có dữ liệu tồn kho</p>
                                <button onClick={() => setUploadModal(true)} className="text-xs text-brand-primary hover:underline">
                                    Nhấn để nạp hàng →
                                </button>
                            </div>
                        ) : (
                            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                                <colgroup>
                                    <col style={{ width: '40px' }} />
                                    <col style={{ width: '50px' }} />
                                    <col />
                                    <col style={{ width: '100px' }} />
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '140px' }} />
                                </colgroup>
                                <thead>
                                    <tr className="bg-brand-surface-2/80 border-b border-brand-border">
                                        <th className="py-2 px-2 text-center">
                                            <input
                                                type="checkbox"
                                                checked={sheetData.items.filter(i => i.status === 'AVAILABLE').length > 0 && selectedRows.size === sheetData.items.filter(i => i.status === 'AVAILABLE').length}
                                                onChange={toggleSelectAll}
                                                className="w-3.5 h-3.5 rounded cursor-pointer"
                                            />
                                        </th>
                                        <th className="text-center text-[10px] text-brand-text-muted font-semibold py-2 px-2 uppercase tracking-wider">#</th>
                                        <th className="text-left text-[10px] text-brand-text-muted font-semibold py-2 px-3 uppercase tracking-wider">Nội dung</th>
                                        <th className="text-center text-[10px] text-brand-text-muted font-semibold py-2 px-2 uppercase tracking-wider">Trạng thái</th>
                                        <th className="text-center text-[10px] text-brand-text-muted font-semibold py-2 px-2 uppercase tracking-wider">Variant</th>
                                        <th className="text-right text-[10px] text-brand-text-muted font-semibold py-2 px-3 uppercase tracking-wider">Ngày tạo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sheetData.items.map((row) => (
                                        <tr
                                            key={row.id}
                                            className={`border-b border-brand-border/30 transition-colors ${selectedRows.has(row.id) ? 'bg-brand-primary/5' : 'hover:bg-brand-surface-2/30'}`}
                                        >
                                            <td className="py-1.5 px-2 text-center">
                                                {row.status === 'AVAILABLE' ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRows.has(row.id)}
                                                        onChange={() => toggleRow(row.id)}
                                                        className="w-3.5 h-3.5 rounded cursor-pointer"
                                                    />
                                                ) : <span className="w-3.5 h-3.5 block" />}
                                            </td>
                                            <td className="py-1.5 px-2 text-center text-[10px] text-brand-text-muted font-mono">{row.rowNumber}</td>
                                            <td className="py-1.5 px-3">
                                                <code className="text-xs font-mono text-brand-text-primary break-all leading-relaxed">{row.rawContent}</code>
                                            </td>
                                            <td className="py-1.5 px-2 text-center">{statusBadge(row.status)}</td>
                                            <td className="py-1.5 px-2 text-center text-[10px] text-brand-text-muted">{row.variantName || '—'}</td>
                                            <td className="py-1.5 px-3 text-right text-[10px] text-brand-text-muted">
                                                {new Date(row.createdAt).toLocaleDateString('vi-VN')}
                                                {row.soldAt && <span className="block text-blue-500">Bán: {new Date(row.soldAt).toLocaleDateString('vi-VN')}</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {sheetData && sheetData.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-brand-border bg-brand-surface-2/30">
                            <span className="text-[10px] text-brand-text-muted">
                                Hiện {sheetData.items.length} / {sheetData.pagination.total} mục
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setSheetPage(p => Math.max(1, p - 1))}
                                    disabled={sheetPage <= 1}
                                    className="p-1.5 rounded-lg text-brand-text-muted hover:bg-brand-surface-2 disabled:opacity-30 transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-xs text-brand-text-secondary font-medium px-2">
                                    {sheetPage} / {sheetData.pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setSheetPage(p => Math.min(sheetData!.pagination.totalPages, p + 1))}
                                    disabled={sheetPage >= sheetData.pagination.totalPages}
                                    className="p-1.5 rounded-lg text-brand-text-muted hover:bg-brand-surface-2 disabled:opacity-30 transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Empty state when no product selected */}
            {!selectedProductId && products.length > 0 && (
                <div className="card text-center py-12">
                    <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-brand-text-muted/30" />
                    <p className="text-sm text-brand-text-muted">Chọn sản phẩm ở trên để xem kho hàng chi tiết</p>
                </div>
            )}

            {/* No products */}
            {products.length === 0 && !loading && (
                <div className="card text-center py-12">
                    <Database className="w-12 h-12 mx-auto mb-3 text-brand-text-muted/30" />
                    <p className="text-sm text-brand-text-muted mb-1">Chưa có sản phẩm nào</p>
                    <p className="text-xs text-brand-text-muted">Tạo sản phẩm ở tab "Sản phẩm" trước khi nạp hàng.</p>
                </div>
            )}

            {/* Upload Modal */}
            {uploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setUploadModal(false)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
                        <button onClick={() => setUploadModal(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2">
                            <X className="w-5 h-5 text-brand-text-muted" />
                        </button>

                        <h2 className="text-lg font-bold text-brand-text-primary mb-1 flex items-center gap-2">
                            <UploadCloud className="w-5 h-5 text-brand-primary" /> Nạp hàng vào kho
                        </h2>
                        <p className="text-xs text-brand-text-muted mb-4">
                            Sản phẩm: <strong>{products.find(p => p.id === selectedProductId)?.product || '—'}</strong>
                            {selectedVariantId && sheetData?.product.variants.find(v => v.id === selectedVariantId) && (
                                <> • Variant: <strong>{sheetData.product.variants.find(v => v.id === selectedVariantId)!.name}</strong></>
                            )}
                        </p>

                        {/* File drop zone */}
                        <div
                            className={`border-2 border-dashed rounded-xl p-6 mb-4 text-center cursor-pointer transition-all ${dragOver ? 'border-brand-primary bg-brand-primary/5' : 'border-brand-border hover:border-brand-primary/40'
                                }`}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files); }}
                            onClick={() => fileRef.current?.click()}
                        >
                            <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? 'text-brand-primary' : 'text-brand-text-muted/50'}`} />
                            {uploadFile ? (
                                <div>
                                    <p className="text-sm font-medium text-brand-text-primary">{uploadFile.name}</p>
                                    <p className="text-[10px] text-brand-text-muted mt-0.5">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                                    <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); setUploadText(''); }} className="text-[10px] text-brand-danger hover:underline mt-1">Xóa file</button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs text-brand-text-secondary mb-0.5">Kéo thả file hoặc nhấn để chọn</p>
                                    <p className="text-[10px] text-brand-text-muted">Hỗ trợ: .txt, .csv, .xlsx — Mỗi dòng = 1 mục tồn kho</p>
                                </>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept=".txt,.csv,.xlsx,.xls" className="hidden" onChange={e => handleFileSelect(e.target.files)} />

                        {/* Or paste */}
                        <div className="mb-3">
                            <label className="text-xs font-medium text-brand-text-secondary mb-1.5 block">Hoặc paste trực tiếp:</label>
                            <textarea
                                rows={6}
                                value={uploadText}
                                onChange={e => { setUploadText(e.target.value); setUploadFile(null); }}
                                className="input-field resize-none font-mono text-xs w-full"
                                placeholder={'Mỗi dòng 1 mục:\naccount1@mail.com|password123\naccount2@mail.com|password456\nKEY-XXXXX-XXXXX-001'}
                            />
                        </div>

                        {/* Dedup info */}
                        <div className="bg-brand-warning/5 border border-brand-warning/20 rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-brand-warning shrink-0 mt-0.5" />
                            <p className="text-[10px] text-brand-text-secondary">
                                Hệ thống tự động lọc trùng lặp. Hàng đã tồn tại hoặc đã bán sẽ bị loại bỏ.
                            </p>
                        </div>

                        {(uploadText.trim() || uploadFile) && (
                            <p className="text-xs text-brand-text-muted mb-4">
                                💡 {uploadFile ? `File ${uploadFile.name}` : `${uploadText.trim().split('\n').filter(Boolean).length} mục`} sẽ được kiểm tra và thêm
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setUploadModal(false)} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button
                                onClick={handleUpload}
                                disabled={(!uploadText.trim() && !uploadFile) || uploading}
                                className="btn-primary flex-1 !py-3 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {uploading ? 'Đang nạp...' : 'Nạp hàng'}
                            </button>
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
