'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw, Plus, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { secureFetch } from '@/lib/secure-fetch';

interface Transaction {
    id: string;
    type: string;
    direction: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
}

export default function WalletPage() {
    const { user } = useAuth();
    const { t } = useI18n();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const balance = user?.walletBalance || 0;

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await secureFetch('/api/v1/user/data?type=transactions');
            if (!res.ok) { setTransactions([]); setLoading(false); return; }
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                setTransactions(data.data);
            } else {
                setTransactions([]);
            }
        } catch {
            setTransactions([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const totalDeposits = transactions.filter(t => t.direction === 'credit').reduce((sum, t) => sum + t.amount, 0);
    const totalSpent = transactions.filter(t => t.direction === 'debit').reduce((sum, t) => sum + t.amount, 0);
    const totalTxns = transactions.length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('walletTitle')}</h1>
                <p className="text-sm text-brand-text-muted">{t('walletSubtitle')}</p>
            </div>

            {/* Balance Card */}
            <div className="bg-gradient-to-r from-brand-primary to-brand-secondary rounded-3xl p-6 md:p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <div className="text-sm text-white/70 mb-2">{t('walletCurrentBalance')}</div>
                    <div className="text-3xl md:text-4xl font-bold mb-6">{formatCurrency(balance)}</div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/dashboard/nap-tien" className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
                            <Plus className="w-4 h-4" /> {t('walletDepositBtn')}
                        </Link>
                        <button onClick={() => fetchTransactions()} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('walletRefresh')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card">
                    <div className="text-xs text-brand-text-muted mb-2">{t('walletTotalDeposited')}</div>
                    <div className="text-xl font-bold text-brand-success">{formatCurrency(totalDeposits)}</div>
                </div>
                <div className="card">
                    <div className="text-xs text-brand-text-muted mb-2">{t('walletTotalSpent')}</div>
                    <div className="text-xl font-bold text-brand-danger">{formatCurrency(totalSpent)}</div>
                </div>
                <div className="card">
                    <div className="text-xs text-brand-text-muted mb-2">{t('walletTotalTxn')}</div>
                    <div className="text-xl font-bold text-brand-primary">{totalTxns}</div>
                </div>
            </div>

            {/* Transaction History */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-4">{t('walletHistory')}</h3>
                {loading ? (
                    <div className="text-center py-10"><Loader2 className="w-6 h-6 text-brand-primary animate-spin mx-auto" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-brand-border">
                                    <th className="text-left text-xs text-brand-text-muted font-medium py-2.5 pr-4">{t('walletType')}</th>
                                    <th className="text-left text-xs text-brand-text-muted font-medium py-2.5 pr-4">{t('walletDesc')}</th>
                                    <th className="text-right text-xs text-brand-text-muted font-medium py-2.5 pr-4">{t('walletAmount')}</th>
                                    <th className="text-right text-xs text-brand-text-muted font-medium py-2.5">{t('walletBalanceAfter')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(txn => (
                                    <tr key={txn.id} className="border-b border-brand-border/50 last:border-0">
                                        <td className="py-3 pr-4">
                                            <span className={`badge text-[10px] ${txn.direction === 'credit' ? 'badge-success' : 'badge-warning'}`}>
                                                {txn.type === 'deposit' ? t('udDeposit') : txn.type === 'purchase' ? t('udPurchase') : t('udPayment')}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-4 text-brand-text-secondary text-xs max-w-[300px] truncate">{txn.description}</td>
                                        <td className={`py-3 pr-4 text-right font-semibold ${txn.direction === 'credit' ? 'text-brand-success' : 'text-brand-danger'}`}>
                                            {txn.direction === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                        </td>
                                        <td className="py-3 text-right text-brand-text-primary font-medium">{formatCurrency(txn.balanceAfter)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
