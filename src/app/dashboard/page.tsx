'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Wallet, ShoppingBag, AlertTriangle, ArrowRight, TrendingUp, Clock, Package, Loader2, Bell } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import { secureFetch } from '@/lib/secure-fetch';


interface Order {
    id: string;
    orderCode: string;
    productName: string;
    shopName: string;
    quantity: number;
    totalAmount: number;
    status: string;
    createdAt: string;
}

interface Transaction {
    id: string;
    type: string;
    direction: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
}

export default function UserDashboard() {
    const { user } = useAuth();
    const { t } = useI18n();
    const [orders, setOrders] = useState<Order[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [notifications, setNotifications] = useState<{id:string;title:string;message:string;isRead:boolean}[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const [ordersRes, txnRes, notiRes] = await Promise.all([
                    secureFetch('/api/v1/user/data?type=orders'),
                    secureFetch('/api/v1/user/data?type=transactions'),
                    secureFetch('/api/v1/notifications'),
                ]);
                const ordersData = ordersRes.ok ? await ordersRes.json() : { success: false };
                const txnData = txnRes.ok ? await txnRes.json() : { success: false };
                const notiData = notiRes.ok ? await notiRes.json() : { success: false };

                setOrders(ordersData.success ? ordersData.data : []);
                setTransactions(txnData.success ? txnData.data : []);
                setNotifications(notiData.success ? (notiData.data || []) : []);
            } catch {
                setOrders([]);
                setTransactions([]);
            }
            setLoading(false);
        }
        fetchData();
    }, []);

    const balance = user?.walletBalance || 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('udTitle')}</h1>
                <p className="text-sm text-brand-text-muted">{t('udSubtitle')}</p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { icon: Wallet, label: t('udBalance'), value: formatCurrency(balance), color: 'text-brand-success', bgIcon: 'bg-brand-success/10', href: '/dashboard/vi' },
                    { icon: ShoppingBag, label: t('udTotalOrders'), value: String(orders.length), color: 'text-brand-primary', bgIcon: 'bg-brand-primary/10', href: '/dashboard/don-hang' },
                    { icon: TrendingUp, label: t('udRecentTxn'), value: String(transactions.length), color: 'text-brand-info', bgIcon: 'bg-brand-info/10', href: '/dashboard/vi' },
                    { icon: AlertTriangle, label: t('udOpenComplaints'), value: '0', color: 'text-brand-warning', bgIcon: 'bg-brand-warning/10', href: '/dashboard/khieu-nai' },
                ].map((metric, i) => (
                    <Link key={i} href={metric.href} className="card hover:shadow-card-hover hover:border-brand-primary/30 transition-all cursor-pointer group">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-brand-text-muted font-medium">{metric.label}</span>
                            <div className={`w-9 h-9 rounded-xl ${metric.bgIcon} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                <metric.icon className={`w-5 h-5 ${metric.color}`} />
                            </div>
                        </div>
                        <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
                    </Link>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Recent Orders */}
                <div className="lg:col-span-2 card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-brand-text-primary">{t('udRecentOrders')}</h3>
                        <Link href="/dashboard/don-hang" className="text-xs text-brand-primary font-medium hover:underline flex items-center gap-1">
                            {t('udViewAll')} <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    {orders.length === 0 ? (
                        <div className="text-center py-10 text-sm text-brand-text-muted">
                            <Package className="w-10 h-10 mx-auto mb-3 text-brand-text-muted/30" />
                            {t('udNoOrders')} <Link href="/" className="text-brand-primary hover:underline">{t('udShopNow')}</Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {orders.slice(0, 4).map(order => (
                                <div key={order.id} className="flex items-center gap-4 bg-brand-surface-2 rounded-xl p-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                                        <Package className="w-5 h-5 text-brand-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-brand-text-primary truncate">{order.productName}</div>
                                        <div className="text-xs text-brand-text-muted">{order.orderCode} • {order.shopName}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-semibold text-brand-text-primary">{formatCurrency(order.totalAmount)}</div>
                                        <span className={`badge text-[10px] ${order.status === 'completed' ? 'badge-success' :
                                            order.status === 'delivered' ? 'badge-info' :
                                                order.status === 'paid' ? 'badge-warning' : 'badge-neutral'
                                            }`}>
                                            {order.status === 'completed' ? t('udCompleted') :
                                                order.status === 'delivered' ? t('udDelivered') :
                                                    order.status === 'paid' ? t('udWaiting') : order.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Notifications */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-brand-text-primary">{t('udSystemNotifs')}</h3>
                        <Link href="/dashboard/thong-bao" className="text-xs text-brand-primary font-medium hover:underline">
                            {t('udAllNotifs')}
                        </Link>
                    </div>
                    {notifications.length > 0 ? (
                        <div className="space-y-3">
                            {notifications.slice(0, 4).map(notif => (
                                <div key={notif.id} className={`p-3 rounded-xl text-sm ${notif.isRead ? 'bg-brand-surface-2' : 'bg-brand-primary/5 border border-brand-primary/10'}`}>
                                    <div className="font-medium text-brand-text-primary text-xs mb-1">{notif.title}</div>
                                    <div className="text-xs text-brand-text-muted line-clamp-2">{notif.message}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-sm text-brand-text-muted">
                            <Bell className="w-8 h-8 mx-auto mb-2 text-brand-text-muted/30" />
                            {t('udNoNotifs')}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-brand-text-primary">{t('udRecentTxnTitle')}</h3>
                    <Link href="/dashboard/vi" className="text-xs text-brand-primary font-medium hover:underline flex items-center gap-1">
                        {t('udViewWallet')} <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-brand-border">
                                <th className="text-left text-xs text-brand-text-muted font-medium py-2 pr-4">{t('udTxnType')}</th>
                                <th className="text-left text-xs text-brand-text-muted font-medium py-2 pr-4">{t('udTxnDesc')}</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-2 pr-4">{t('udTxnAmount')}</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-2">{t('udTxnBalanceAfter')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.slice(0, 5).map(txn => (
                                <tr key={txn.id} className="border-b border-brand-border/50 last:border-0">
                                    <td className="py-3 pr-4">
                                        <span className={`badge text-[10px] ${txn.type === 'deposit' ? 'badge-success' : 'badge-warning'}`}>
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
            </div>
        </div>
    );
}
