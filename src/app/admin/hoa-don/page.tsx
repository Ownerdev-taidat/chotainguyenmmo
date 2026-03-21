'use client';

import { useEffect, useState } from 'react';
import { FileText, Download, Eye, X, Loader2, RefreshCw, Search, Calendar } from 'lucide-react';

interface Invoice {
    id: string;
    invoiceNumber: string;
    orderCode: string;
    buyerName: string;
    sellerName: string;
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    feeAmount: number;
    totalAmount: number;
    taxEnabled: boolean;
    items: string;
    status: string;
    issuedAt: string;
}

export default function AdminInvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Invoice | null>(null);
    const [search, setSearch] = useState('');

    const fetchInvoices = async (doBackfill = false) => {
        try {
            const token = localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
            const url = doBackfill ? '/api/v1/invoices?backfill=true' : '/api/v1/invoices';
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setInvoices(data.data);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchInvoices(true); }, []);

    const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';
    const fmtDate = (d: string) => {
        try {
            const date = new Date(d);
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        } catch { return d; }
    };

    const filtered = invoices.filter(i =>
        i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        i.orderCode.toLowerCase().includes(search.toLowerCase()) ||
        i.buyerName.toLowerCase().includes(search.toLowerCase()) ||
        i.sellerName.toLowerCase().includes(search.toLowerCase())
    );

    const totalRevenue = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalVat = invoices.reduce((s, i) => s + i.vatAmount, 0);
    const totalFees = invoices.reduce((s, i) => s + i.feeAmount, 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Hóa đơn thuế</h1>
                    <p className="text-sm text-brand-text-muted">Quản lý hóa đơn điện tử theo Thông tư 78/2021/TT-BTC.</p>
                </div>
                <button onClick={() => { setLoading(true); fetchInvoices(true); }} className="btn-secondary !py-2 !px-3 text-sm flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Làm mới
                </button>
            </div>

            {/* Stats */}
            <div className={`grid grid-cols-2 ${totalVat > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
                <div className="card !p-4">
                    <div className="text-xl font-bold text-brand-primary">{invoices.length}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Tổng hóa đơn</div>
                </div>
                <div className="card !p-4">
                    <div className="text-xl font-bold text-brand-success">{fmt(totalRevenue)}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Tổng doanh thu</div>
                </div>
                {totalVat > 0 && (
                    <div className="card !p-4">
                        <div className="text-xl font-bold text-brand-danger">{fmt(totalVat)}</div>
                        <div className="text-xs text-brand-text-muted mt-1">Tổng thuế VAT</div>
                    </div>
                )}
                <div className="card !p-4">
                    <div className="text-xl font-bold text-brand-info">{fmt(totalFees)}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Tổng phí sàn</div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm theo số HD, mã đơn, tên người mua, shop..."
                    className="input-field !pl-10 w-full"
                />
            </div>

            {/* Invoice List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="card text-center py-16">
                    <FileText className="w-12 h-12 text-brand-text-muted/30 mx-auto mb-3" />
                    <p className="text-sm text-brand-text-muted">
                        {search ? 'Không tìm thấy hóa đơn phù hợp' : 'Chưa có hóa đơn nào. Hóa đơn sẽ được tạo tự động khi khách mua hàng.'}
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-brand-border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2 text-brand-text-muted text-xs">
                                <th className="px-4 py-3 text-left font-medium">Số hóa đơn</th>
                                <th className="px-4 py-3 text-left font-medium">Mã đơn</th>
                                <th className="px-4 py-3 text-left font-medium">Người mua</th>
                                <th className="px-4 py-3 text-left font-medium">Shop</th>
                                <th className="px-4 py-3 text-right font-medium">Tiền hàng</th>
                                {filtered.some(i => i.taxEnabled) && <th className="px-4 py-3 text-right font-medium">VAT</th>}
                                <th className="px-4 py-3 text-right font-medium">Phí sàn</th>
                                <th className="px-4 py-3 text-right font-medium">Tổng</th>
                                <th className="px-4 py-3 text-left font-medium">Ngày</th>
                                <th className="px-4 py-3 text-center font-medium">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-border">
                            {filtered.map(inv => (
                                <tr key={inv.id} className="bg-brand-surface hover:bg-brand-surface-2/50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-brand-primary text-xs font-medium">{inv.invoiceNumber}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{inv.orderCode}</td>
                                    <td className="px-4 py-3">{inv.buyerName}</td>
                                    <td className="px-4 py-3">{inv.sellerName}</td>
                                    <td className="px-4 py-3 text-right">{fmt(inv.subtotal)}</td>
                                    {filtered.some(i => i.taxEnabled) && <td className="px-4 py-3 text-right text-brand-danger">{inv.taxEnabled ? fmt(inv.vatAmount) : '-'}</td>}
                                    <td className="px-4 py-3 text-right text-brand-info">{fmt(inv.feeAmount)}</td>
                                    <td className="px-4 py-3 text-right font-semibold">{fmt(inv.totalAmount)}</td>
                                    <td className="px-4 py-3 text-xs text-brand-text-muted">{fmtDate(inv.issuedAt)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button onClick={() => setSelected(inv)} className="p-1.5 rounded-lg hover:bg-brand-surface-2 text-brand-text-muted hover:text-brand-primary">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Invoice Detail Modal */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-up">
                        {/* Invoice Header */}
                        <div className="p-6 border-b border-brand-border">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-brand-primary" />
                                    <h3 className="text-lg font-bold text-brand-text-primary">HÓA ĐƠN ĐIỆN TỬ</h3>
                                </div>
                                <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-brand-surface-2">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-brand-text-muted mb-1">(Theo Thông tư 78/2021/TT-BTC)</div>
                                <div className="text-sm font-mono font-bold text-brand-primary">{selected.invoiceNumber}</div>
                                <div className="text-xs text-brand-text-muted mt-1">Ngày phát hành: {fmtDate(selected.issuedAt)}</div>
                            </div>
                        </div>

                        {/* Buyer / Seller Info */}
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Đơn vị bán</div>
                                    <div className="text-sm font-medium text-brand-text-primary">{selected.sellerName}</div>
                                    <div className="text-xs text-brand-text-muted mt-0.5">Sàn: ChoTaiNguyen</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Người mua</div>
                                    <div className="text-sm font-medium text-brand-text-primary">{selected.buyerName}</div>
                                    <div className="text-xs text-brand-text-muted mt-0.5">Mã đơn: {selected.orderCode}</div>
                                </div>
                            </div>

                            {/* Line Items */}
                            <div>
                                <div className="text-xs font-semibold text-brand-text-muted mb-2 uppercase tracking-wider">Chi tiết hàng hóa</div>
                                <div className="overflow-x-auto rounded-lg border border-brand-border">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-brand-surface-2">
                                                <th className="px-3 py-2 text-left">STT</th>
                                                <th className="px-3 py-2 text-left">Tên hàng hóa</th>
                                                <th className="px-3 py-2 text-right">SL</th>
                                                <th className="px-3 py-2 text-right">Đơn giá</th>
                                                <th className="px-3 py-2 text-right">Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-brand-border">
                                            {(() => {
                                                try {
                                                    const items = JSON.parse(selected.items);
                                                    return items.map((item: any, i: number) => (
                                                        <tr key={i}>
                                                            <td className="px-3 py-2">{i + 1}</td>
                                                            <td className="px-3 py-2 font-medium">{item.name}</td>
                                                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                                                            <td className="px-3 py-2 text-right">{fmt(item.unitPrice)}</td>
                                                            <td className="px-3 py-2 text-right">{fmt(item.total)}</td>
                                                        </tr>
                                                    ));
                                                } catch { return null; }
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="bg-brand-surface-2 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-brand-text-muted">Tiền hàng</span>
                                    <span className="font-medium">{fmt(selected.subtotal)}</span>
                                </div>
                                {selected.taxEnabled && selected.vatAmount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-brand-text-muted">Thuế GTGT ({selected.vatRate}%)</span>
                                        <span className="font-medium text-brand-danger">{fmt(selected.vatAmount)}</span>
                                    </div>
                                )}
                                {selected.feeAmount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-brand-text-muted">Phí sàn</span>
                                        <span className="font-medium text-brand-info">{fmt(selected.feeAmount)}</span>
                                    </div>
                                )}
                                <div className="border-t border-brand-border pt-2 flex justify-between text-sm">
                                    <span className="font-semibold text-brand-text-primary">Tổng thanh toán</span>
                                    <span className="font-bold text-brand-primary text-lg">{fmt(selected.totalAmount)}</span>
                                </div>
                            </div>

                            <div className="text-center text-[10px] text-brand-text-muted pt-2">
                                Hóa đơn điện tử có giá trị pháp lý tương đương hóa đơn giấy theo quy định tại Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC.
                            </div>

                            <button onClick={() => setSelected(null)} className="w-full py-2.5 rounded-xl text-sm font-medium bg-brand-surface-2 text-brand-text-primary hover:bg-brand-surface-2/80 transition-all">Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
