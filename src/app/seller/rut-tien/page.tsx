'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { DollarSign, TrendingDown, ArrowUpRight, Wallet, Plus, AlertCircle, X, Loader2, CheckCircle2 } from 'lucide-react';
import { VIETNAMESE_BANKS } from '@/lib/banks';

interface WithdrawItem {
    id: string; code: string; amount: number; fee: number; bankName: string;
    bankAccount: string; bankOwner: string; status: string; createdAt: string;
}

export default function SellerWithdrawPage() {
    const { user } = useAuth();
    const { t } = useI18n();
    const [withdrawals, setWithdrawals] = useState<WithdrawItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [toast, setToast] = useState('');
    const [balance, setBalance] = useState(0);
    const [pendingAmount, setPendingAmount] = useState(0);
    const [totalWithdrawn, setTotalWithdrawn] = useState(0);
    const [amount, setAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [bankOwner, setBankOwner] = useState('');

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const fetchData = async () => {
        try {
            const res = await fetch('/api/v1/seller/withdrawals', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) {
                setWithdrawals(data.data.withdrawals);
                setBalance(data.data.balance);
                setPendingAmount(data.data.pendingAmount);
                setTotalWithdrawn(data.data.totalWithdrawn);
            }
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleCreate = async () => {
        const num = Number(amount);
        if (num < 50000) { showToast(t('swMinError')); return; }
        if (num > balance) { showToast(t('swInsufficientBalance')); return; }
        if (!bankName || !bankAccount || !bankOwner) { showToast(t('swFillAll')); return; }
        setCreating(true);
        try {
            const res = await fetch('/api/v1/seller/withdrawals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ amount: num, bankName, accountNumber: bankAccount, accountName: bankOwner }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ ' + data.message);
                setShowCreate(false);
                setAmount(''); setBankName(''); setBankAccount(''); setBankOwner('');
                fetchData();
            } else {
                showToast('❌ ' + data.message);
            }
        } catch { showToast(t('spConnectionError')); }
        setCreating(false);
    };

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('swTitle')}</h1>
                    <p className="text-sm text-brand-text-muted">{t('swSubtitle')}</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" /> {t('swCreateRequest')}
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-success/10 flex items-center justify-center"><Wallet className="w-5 h-5 text-brand-success" /></div>
                    <div><div className="text-xs text-brand-text-muted">{t('swAvailableBalance')}</div><div className="text-lg font-bold text-brand-success">{formatCurrency(balance)}</div></div>
                </div>
                <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-warning/10 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-brand-warning" /></div>
                    <div><div className="text-xs text-brand-text-muted">{t('swPendingWithdraw')}</div><div className="text-lg font-bold text-brand-warning">{formatCurrency(pendingAmount)}</div></div>
                </div>
                <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-brand-primary" /></div>
                    <div><div className="text-xs text-brand-text-muted">{t('swTotalWithdrawn')}</div><div className="text-lg font-bold text-brand-primary">{formatCurrency(totalWithdrawn)}</div></div>
                </div>
            </div>

            <div className="bg-brand-info/5 border border-brand-info/20 rounded-xl p-3 text-xs text-brand-text-secondary flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-brand-info shrink-0 mt-0.5" />
                <p>{t('swNote')}</p>
            </div>

            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-4">{t('swHistory')}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2/50">
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">{t('swCode')}</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">{t('swAmount')}</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">{t('swMethod')}</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">{t('swStatus')}</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">{t('swTime')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {withdrawals.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-12 text-brand-text-muted text-sm">{t('swEmpty')}</td></tr>
                            ) : withdrawals.map(w => (
                                <tr key={w.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 transition-colors">
                                    <td className="py-3 px-4 text-brand-primary font-medium text-xs">{w.code}</td>
                                    <td className="py-3 px-4 text-right font-semibold text-brand-text-primary">{formatCurrency(w.amount)}</td>
                                    <td className="py-3 px-4 text-brand-text-secondary text-xs">{w.bankName} - {w.bankAccount}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`badge text-[10px] ${w.status === 'completed' ? 'badge-success' : w.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                            {w.status === 'completed' ? t('swCompleted') : w.status === 'rejected' ? t('swRejected') : t('swPending')}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-brand-text-muted text-xs">{formatDateTime(w.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">{t('swCreateTitle')}</h2>
                        <div className="space-y-4">
                            <div className="text-sm text-brand-text-muted">{t('swBalance')}: <span className="text-brand-success font-bold">{formatCurrency(balance)}</span></div>
                            <div>
                                <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('swAmountLabel')}</label>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input-field w-full" placeholder={t('swMinAmount')} min={50000} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('swBankLabel')}</label>
                                <select value={bankName} onChange={e => setBankName(e.target.value)} className="input-field w-full">
                                    <option value="">— {t('swBankLabel')} —</option>
                                    {VIETNAMESE_BANKS.map(b => (<option key={b.code} value={b.name}>{b.name}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('swAccountNum')}</label>
                                <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="input-field w-full" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('swAccountName')}</label>
                                <input type="text" value={bankOwner} onChange={e => setBankOwner(e.target.value)} className="input-field w-full" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">{t('swCancel')}</button>
                            <button onClick={handleCreate} disabled={creating} className="btn-primary flex-1 flex items-center justify-center gap-2">
                                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('swProcessing')}</> : <><DollarSign className="w-4 h-4" /> {t('swConfirm')}</>}
                            </button>
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
