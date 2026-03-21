'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, DollarSign, ShoppingBag, BarChart3, Loader2, Calendar, ChevronDown } from 'lucide-react';

interface DashData {
    revenueToday: number; revenuePeriod: number; revenueMonth: number;
    periodOrders: number; periodCompletedOrders: number; feesPeriod: number;
    totalOrders: number; completedOrders: number; activeProducts: number;
    periodLabel: string;
}

const PERIODS = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'month', label: 'Tháng này' },
    { key: '3months', label: '3 tháng' },
    { key: '6months', label: '6 tháng' },
    { key: 'year', label: 'Năm nay' },
];

export default function RevenuePage() {
    const [data, setData] = useState<DashData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('month');
    const [customMonth, setCustomMonth] = useState('');
    const [showCustom, setShowCustom] = useState(false);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

    const fetchData = async (p: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/seller/stats?period=${p}`, { headers: { Authorization: `Bearer ${token}` } });
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchData(period); }, [period]);

    const handlePeriodChange = (p: string) => {
        setShowCustom(false);
        setPeriod(p);
    };

    const handleCustomMonth = () => {
        if (customMonth) {
            setPeriod(customMonth);
            setShowCustom(false);
        }
    };

    const d = data || { revenueToday: 0, revenuePeriod: 0, revenueMonth: 0, periodOrders: 0, periodCompletedOrders: 0, feesPeriod: 0, totalOrders: 0, completedOrders: 0, activeProducts: 0, periodLabel: '' };
    const avgOrderValue = d.periodCompletedOrders > 0 ? Math.round(d.revenuePeriod / d.periodCompletedOrders) : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Doanh thu</h1>
                    <p className="text-sm text-brand-text-muted">Tổng quan doanh thu và hiệu suất bán hàng.</p>
                </div>
            </div>

            {/* ── Period Filter ── */}
            <div className="flex items-center gap-2 flex-wrap">
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => handlePeriodChange(p.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            period === p.key
                                ? 'bg-brand-primary text-white shadow-sm'
                                : 'bg-brand-surface-2 text-brand-text-secondary hover:bg-brand-primary/10'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
                <div className="relative">
                    <button
                        onClick={() => setShowCustom(!showCustom)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                            /^\d{4}-\d{2}$/.test(period)
                                ? 'bg-brand-primary text-white shadow-sm'
                                : 'bg-brand-surface-2 text-brand-text-secondary hover:bg-brand-primary/10'
                        }`}
                    >
                        <Calendar className="w-3 h-3" /> Chọn tháng <ChevronDown className="w-3 h-3" />
                    </button>
                    {showCustom && (
                        <div className="absolute top-full left-0 mt-1 bg-brand-surface border border-brand-border rounded-xl shadow-card p-3 z-20 flex items-center gap-2">
                            <input
                                type="month"
                                value={customMonth}
                                onChange={e => setCustomMonth(e.target.value)}
                                className="input-field !py-1.5 !px-2 text-xs"
                            />
                            <button onClick={handleCustomMonth} className="btn-primary !py-1.5 !px-3 text-xs">Xem</button>
                        </div>
                    )}
                </div>
                {data?.periodLabel && (
                    <span className="text-xs text-brand-text-muted ml-2">📊 {data.periodLabel}</span>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: `Doanh thu ${d.periodLabel || 'kỳ'}`, value: formatCurrency(d.revenuePeriod), icon: DollarSign, bg: 'bg-brand-primary/10', color: 'text-brand-primary' },
                            { label: `Đơn hàng`, value: String(d.periodOrders), icon: ShoppingBag, bg: 'bg-brand-success/10', color: 'text-brand-success' },
                            { label: 'Doanh thu hôm nay', value: formatCurrency(d.revenueToday), icon: TrendingUp, bg: 'bg-brand-info/10', color: 'text-brand-info' },
                            { label: 'Giá trị TB/đơn', value: formatCurrency(avgOrderValue), icon: BarChart3, bg: 'bg-brand-warning/10', color: 'text-brand-warning' },
                        ].map((s, i) => (
                            <div key={i} className="card">
                                <div className="flex items-center justify-between mb-3">
                                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                                        <s.icon className={`w-5 h-5 ${s.color}`} />
                                    </div>
                                </div>
                                <div className="text-xl font-bold text-brand-text-primary">{s.value}</div>
                                <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    <div className="card">
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Tổng quan {d.periodLabel}</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-brand-surface-2 rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-brand-primary">{d.periodOrders}</div>
                                <div className="text-xs text-brand-text-muted mt-1">Tổng đơn hàng</div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-brand-success">{d.periodCompletedOrders}</div>
                                <div className="text-xs text-brand-text-muted mt-1">Đơn hoàn tất</div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-brand-danger">{formatCurrency(d.feesPeriod)}</div>
                                <div className="text-xs text-brand-text-muted mt-1">Phí sàn</div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-brand-info">{d.activeProducts}</div>
                                <div className="text-xs text-brand-text-muted mt-1">Sản phẩm đang bán</div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
