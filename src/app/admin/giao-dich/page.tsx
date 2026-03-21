'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, Search, Loader2, Calendar, ChevronDown, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface Transaction {
    id: string; type: string; direction: string; amount: number;
    balanceAfter: number; description: string; note: string;
    username: string; email: string; createdAt: string;
}
interface Stats {
    totalDeposits: number; totalPurchases: number; totalRefunds: number;
    totalWithdrawals: number; totalFees: number; totalSales: number;
    todayCount: number; periodCount: number;
}

const PERIODS = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'month', label: 'Tháng này' },
    { key: '3months', label: '3 tháng' },
    { key: '6months', label: '6 tháng' },
    { key: 'year', label: 'Năm nay' },
];

const TYPE_MAP: Record<string, { label: string; badge: string }> = {
    DEPOSIT: { label: 'Nạp tiền', badge: 'bg-brand-success/10 text-brand-success' },
    PURCHASE: { label: 'Mua hàng', badge: 'bg-brand-danger/10 text-brand-danger' },
    SALE_EARNING: { label: 'Thu bán', badge: 'bg-brand-primary/10 text-brand-primary' },
    REFUND: { label: 'Hoàn tiền', badge: 'bg-brand-warning/10 text-brand-warning' },
    WITHDRAWAL: { label: 'Rút tiền', badge: 'bg-brand-info/10 text-brand-info' },
    FEE: { label: 'Phí', badge: 'bg-brand-text-muted/10 text-brand-text-muted' },
    ADJUSTMENT: { label: 'Điều chỉnh', badge: 'bg-brand-text-muted/10 text-brand-text-muted' },
};

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [periodLabel, setPeriodLabel] = useState('');
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('month');
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [customMonth, setCustomMonth] = useState('');
    const [showCustom, setShowCustom] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
            const params = new URLSearchParams({ period, page: String(page), limit: '50' });
            if (typeFilter) params.set('type', typeFilter);
            const res = await fetch(`/api/v1/admin/transactions?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.success) {
                setTransactions(json.data.transactions);
                setStats(json.data.stats);
                setPeriodLabel(json.data.periodLabel);
                setTotalPages(json.data.pagination.totalPages);
                setTotal(json.data.pagination.total);
            }
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [period, page, typeFilter]);

    const handlePeriodChange = (p: string) => {
        setShowCustom(false);
        setPeriod(p);
        setPage(1);
    };

    const fmtDate = (d: string) => {
        const date = new Date(d);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Giao dịch tài chính</h1>
                    <p className="text-sm text-brand-text-muted">Theo dõi toàn bộ giao dịch nạp, rút, mua hàng và hoàn tiền trên hệ thống.</p>
                </div>
                <button onClick={fetchData} className="btn-secondary !py-2 !px-3 text-sm flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Làm mới
                </button>
            </div>

            {/* ── Period Filter ── */}
            <div className="flex items-center gap-2 flex-wrap">
                {PERIODS.map(p => (
                    <button key={p.key} onClick={() => handlePeriodChange(p.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p.key ? 'bg-brand-primary text-white shadow-sm' : 'bg-brand-surface-2 text-brand-text-secondary hover:bg-brand-primary/10'}`}>
                        {p.label}
                    </button>
                ))}
                <div className="relative">
                    <button onClick={() => setShowCustom(!showCustom)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${/^\d{4}-\d{2}$/.test(period) ? 'bg-brand-primary text-white shadow-sm' : 'bg-brand-surface-2 text-brand-text-secondary hover:bg-brand-primary/10'}`}>
                        <Calendar className="w-3 h-3" /> Chọn tháng <ChevronDown className="w-3 h-3" />
                    </button>
                    {showCustom && (
                        <div className="absolute top-full left-0 mt-1 bg-brand-surface border border-brand-border rounded-xl shadow-card p-3 z-20 flex items-center gap-2">
                            <input type="month" value={customMonth} onChange={e => setCustomMonth(e.target.value)} className="input-field !py-1.5 !px-2 text-xs" />
                            <button onClick={() => { if (customMonth) { setPeriod(customMonth); setShowCustom(false); setPage(1); } }} className="btn-primary !py-1.5 !px-3 text-xs">Xem</button>
                        </div>
                    )}
                </div>
                {periodLabel && <span className="text-xs text-brand-text-muted ml-2">📊 {periodLabel}</span>}
            </div>

            {/* ── Stats Cards ── */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="card !p-4">
                        <div className="text-xl font-bold text-brand-success">{formatCurrency(stats.totalDeposits)}</div>
                        <div className="text-xs text-brand-text-muted mt-1">Tổng nạp</div>
                    </div>
                    <div className="card !p-4">
                        <div className="text-xl font-bold text-brand-danger">{formatCurrency(stats.totalPurchases)}</div>
                        <div className="text-xs text-brand-text-muted mt-1">Tổng chi mua hàng</div>
                    </div>
                    <div className="card !p-4">
                        <div className="text-xl font-bold text-brand-warning">{formatCurrency(stats.totalRefunds + stats.totalWithdrawals)}</div>
                        <div className="text-xs text-brand-text-muted mt-1">Hoàn tiền + Rút</div>
                    </div>
                    <div className="card !p-4">
                        <div className="text-xl font-bold text-brand-primary">{stats.periodCount}</div>
                        <div className="text-xs text-brand-text-muted mt-1">Giao dịch trong kỳ</div>
                    </div>
                </div>
            )}

            {/* ── Type filter ── */}
            <div className="card !p-3 flex flex-col sm:flex-row gap-3">
                <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                    className="input-field !py-2 text-sm min-w-[140px]">
                    <option value="">Tất cả loại</option>
                    <option value="DEPOSIT">Nạp tiền</option>
                    <option value="PURCHASE">Mua hàng</option>
                    <option value="SALE_EARNING">Thu bán hàng</option>
                    <option value="REFUND">Hoàn tiền</option>
                    <option value="WITHDRAWAL">Rút tiền</option>
                    <option value="FEE">Phí sàn</option>
                </select>
                <div className="text-xs text-brand-text-muted flex items-center">{total} giao dịch</div>
            </div>

            {/* ── Transaction List ── */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-brand-primary animate-spin" /></div>
            ) : transactions.length === 0 ? (
                <div className="card text-center py-16">
                    <p className="text-sm text-brand-text-muted">Không có giao dịch nào trong kỳ này.</p>
                </div>
            ) : (
                <div className="card !p-0 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-brand-surface-2/50">
                            <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Loại</th>
                            <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Người dùng</th>
                            <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mô tả</th>
                            <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số tiền</th>
                            <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số dư sau</th>
                            <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                        </tr></thead>
                        <tbody>
                            {transactions.map(t => {
                                const tm = TYPE_MAP[t.type] || { label: t.type, badge: 'bg-brand-surface-2 text-brand-text-muted' };
                                return (
                                    <tr key={t.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.direction === 'CREDIT' ? 'bg-brand-success/10' : 'bg-brand-danger/10'}`}>
                                                    {t.direction === 'CREDIT' ? <ArrowDownLeft className="w-3.5 h-3.5 text-brand-success" /> : <ArrowUpRight className="w-3.5 h-3.5 text-brand-danger" />}
                                                </div>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${tm.badge}`}>{tm.label}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="text-xs font-medium text-brand-text-primary">{t.username}</div>
                                        </td>
                                        <td className="py-3 px-4 text-xs text-brand-text-secondary max-w-[200px] truncate">{t.description || '-'}</td>
                                        <td className={`py-3 px-4 text-right font-semibold ${t.direction === 'CREDIT' ? 'text-brand-success' : 'text-brand-danger'}`}>
                                            {t.direction === 'CREDIT' ? '+' : '-'}{formatCurrency(t.amount)}
                                        </td>
                                        <td className="py-3 px-4 text-right text-brand-text-primary">{formatCurrency(t.balanceAfter)}</td>
                                        <td className="py-3 px-4 text-right text-xs text-brand-text-muted">{fmtDate(t.createdAt)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="p-2 rounded-lg bg-brand-surface-2 hover:bg-brand-primary/10 disabled:opacity-40 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-brand-text-muted">Trang {page}/{totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="p-2 rounded-lg bg-brand-surface-2 hover:bg-brand-primary/10 disabled:opacity-40 transition-all">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
