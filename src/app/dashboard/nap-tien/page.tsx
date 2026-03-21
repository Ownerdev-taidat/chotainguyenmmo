'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { CheckCircle2, Copy, Loader2, AlertTriangle, Wallet, QrCode, Clock, X, ArrowLeft, CreditCard, Shield, ExternalLink, Zap, Globe, AlertCircle } from 'lucide-react';
import { useUI } from '@/components/shared/UIProvider';
import { useCurrency } from '@/lib/currency';

const VND_AMOUNTS = [2000, 5000, 10000, 50000, 100000, 200000, 500000, 1000000];
const USDT_AMOUNTS = [1, 2, 5, 10, 20, 50, 100, 200];
const CHECK_INTERVAL_MS = 1500;
const COUNTDOWN_SECONDS = 250;
const USDT_POLL_INTERVAL = 5000; // 5 seconds for USDT status polling
const USDT_COUNTDOWN_SECONDS = 900; // 15 minutes

type DepositStep = 'select' | 'invoice' | 'usdt_network' | 'usdt_payment';
type UsdtNetwork = 'TRC20' | 'BEP20';
type UsdtStatus = 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'PARTIAL';

interface UsdtDepositData {
    depositId: string;
    network: UsdtNetwork;
    networkLabel: string;
    chainName: string;
    receivingAddress: string;
    qrImageUrl: string;
    expectedUsdt: number;
    amountVnd: number;
    rate: number;
    expiresAt: string;
    referenceCode: string;
}

export default function DepositPage() {
    const { user, updateUser } = useAuth();
    const { showToast } = useUI();
    const searchParams = useSearchParams();
    const [step, setStep] = useState<DepositStep>('select');
    const [selectedAmount, setSelectedAmount] = useState<number>(0);
    const [customAmount, setCustomAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [deposit, setDeposit] = useState<any>(null);
    const [status, setStatus] = useState<'pending' | 'success' | 'expired'>('pending');
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
    const [checkMsg, setCheckMsg] = useState('');
    const [copied, setCopied] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'mbbank' | 'usdt'>('mbbank');

    // USDT state
    const [usdtNetwork, setUsdtNetwork] = useState<UsdtNetwork>('TRC20');
    const [usdtData, setUsdtData] = useState<UsdtDepositData | null>(null);
    const [usdtLoading, setUsdtLoading] = useState(false);
    const [usdtStatus, setUsdtStatus] = useState<UsdtStatus>('PENDING');
    const [usdtCountdown, setUsdtCountdown] = useState(USDT_COUNTDOWN_SECONDS);
    const [usdtTxHash, setUsdtTxHash] = useState<string | null>(null);
    const [usdtExplorerUrl, setUsdtExplorerUrl] = useState<string | null>(null);

    // Live exchange rate from CurrencyProvider
    const { rate: liveRate, rateSource, formatVnd } = useCurrency();

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const statusRef = useRef('pending');
    const depositRef = useRef<any>(null);

    useEffect(() => { statusRef.current = status; }, [status]);
    useEffect(() => { depositRef.current = deposit; }, [deposit]);

    const finalAmount = selectedAmount || parseFloat(customAmount) || 0;
    const isUsdt = paymentMethod === 'usdt';
    const displayAmounts = isUsdt ? USDT_AMOUNTS : VND_AMOUNTS;
    const minAmount = isUsdt ? 1 : 2000;

    const copy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        showToast('Đã sao chép!', 'success');
        setTimeout(() => setCopied(''), 2000);
    };

    const cleanup = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    }, []);

    // ── MBBank flow ──
    const handleCreateDeposit = async () => {
        if (finalAmount < minAmount) return;

        if (paymentMethod === 'usdt') {
            setStep('usdt_network');
            return;
        }

        // MBBank flow
        setLoading(true);
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/wallet/deposits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ amount: finalAmount }),
            });
            const data = await res.json();
            if (data.success) {
                setDeposit(data.data);
                setStep('invoice');
                setStatus('pending');
                setCountdown(COUNTDOWN_SECONDS);
            } else {
                showToast(data.message || 'Lỗi tạo đơn nạp tiền', 'error');
            }
        } catch {
            showToast('Không thể kết nối server', 'error');
        }
        setLoading(false);
    };

    // ── USDT flow: create deposit ──
    const handleCreateUsdtDeposit = async (network: UsdtNetwork) => {
        setUsdtLoading(true);
        setUsdtNetwork(network);
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/wallet/usdt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ amount: finalAmount, network }),
            });
            const data = await res.json();
            if (data.success) {
                setUsdtData(data.data);
                setUsdtStatus('PENDING');
                setUsdtCountdown(USDT_COUNTDOWN_SECONDS);
                setUsdtTxHash(null);
                setUsdtExplorerUrl(null);
                setStep('usdt_payment');
            } else {
                showToast(data.message || 'Lỗi tạo thanh toán USDT', 'error');
            }
        } catch {
            showToast('Không thể kết nối server', 'error');
        }
        setUsdtLoading(false);
    };

    // ── USDT: switch network ──
    const handleSwitchNetwork = (network: UsdtNetwork) => {
        if (network === usdtNetwork && usdtData) return; // Already on this network
        cleanup();
        handleCreateUsdtDeposit(network);
    };

    // ── USDT status polling ──
    useEffect(() => {
        if (step !== 'usdt_payment' || !usdtData || usdtStatus !== 'PENDING') return;

        const checkUsdtStatus = async () => {
            try {
                const token = localStorage.getItem('token') || '';
                const res = await fetch(`/api/v1/wallet/usdt?depositId=${usdtData.depositId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.success) {
                    const s = data.data.status;
                    if (s === 'CONFIRMED' || s === 'COMPLETED') {
                        setUsdtStatus('CONFIRMED');
                        setUsdtTxHash(data.data.txHash);
                        setUsdtExplorerUrl(data.data.explorerUrl);
                        cleanup();
                        if (user) updateUser({ walletBalance: (user.walletBalance || 0) + (data.data.amountVnd || 0) });
                    } else if (s === 'EXPIRED' || s === 'CANCELLED') {
                        setUsdtStatus('EXPIRED');
                        cleanup();
                    } else if (s === 'PARTIAL') {
                        setUsdtStatus('PARTIAL');
                    } else if (s === 'DETECTED' || s === 'CONFIRMING') {
                        // Payment detected on chain, waiting for confirmations
                        // Keep polling, UI stays in pending state
                    } else if (s === 'MANUAL_REVIEW' || s === 'OVERPAID' || s === 'LATE_PAYMENT') {
                        // Needs admin attention — show pending to user
                        setUsdtStatus('PENDING');
                    }
                }
            } catch {}
        };

        checkUsdtStatus();
        intervalRef.current = setInterval(checkUsdtStatus, USDT_POLL_INTERVAL);

        // Countdown
        countdownRef.current = setInterval(() => {
            setUsdtCountdown(prev => {
                if (prev <= 1) {
                    setUsdtStatus('EXPIRED');
                    cleanup();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return cleanup;
    }, [step, usdtData, usdtStatus]);

    // ── MBBank auto-check ──
    useEffect(() => {
        if (step !== 'invoice' || !deposit || status !== 'pending') return;

        const checkPayment = async () => {
            if (statusRef.current !== 'pending' || !depositRef.current) return;
            setCheckMsg('Đang kiểm tra...');
            try {
                const token = localStorage.getItem('token') || '';
                const res = await fetch('/api/v1/wallet/deposits/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ depositCode: depositRef.current.transferContent, amount: depositRef.current.amount }),
                });
                const data = await res.json();
                if (data.success && data.status === 'found') {
                    statusRef.current = 'success';
                    setStatus('success');
                    setCheckMsg('');
                    cleanup();
                    if (user) updateUser({ walletBalance: (user.walletBalance || 0) + depositRef.current.amount });
                    return;
                }
                setCheckMsg('Chưa phát hiện thanh toán');
            } catch {
                setCheckMsg('Lỗi kết nối, thử lại...');
            }
        };

        checkPayment();
        intervalRef.current = setInterval(checkPayment, CHECK_INTERVAL_MS);
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { statusRef.current = 'expired'; setStatus('expired'); setCheckMsg(''); cleanup(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return cleanup;
    }, [step, deposit, status]);

    const [cancelMsg, setCancelMsg] = useState('');
    const handleCancel = () => {
        cleanup();
        setDeposit(null);
        setUsdtData(null);
        setStep('select');
        setStatus('pending');
        setUsdtStatus('PENDING');
        setCheckMsg('');
        setCountdown(COUNTDOWN_SECONDS);
        setUsdtCountdown(USDT_COUNTDOWN_SECONDS);
        setCancelMsg('Đã hủy đơn nạp tiền');
        setTimeout(() => setCancelMsg(''), 3000);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // USDT rate display — uses live rate from CurrencyProvider
    const usdtRate = liveRate;
    const estimatedUsdt = isUsdt ? finalAmount.toFixed(2) : (finalAmount > 0 ? (finalAmount / usdtRate).toFixed(2) : '0.00');
    const estimatedVnd = isUsdt ? Math.round(finalAmount * usdtRate) : finalAmount;
    const displayRateSource = rateSource === 'coingecko' ? 'CoinGecko' : rateSource === 'exchangerate-api' ? 'ExchangeRate' : 'Mặc định';

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Nạp tiền</h1>
                    <p className="text-sm text-gray-500 mt-0.5">MBBank · USDT (TRC20/BEP20) · Tự động xác nhận</p>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">{(user?.walletBalance || 0).toLocaleString('vi-VN')}đ</span>
                </div>
            </div>

            {cancelMsg && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-pulse">
                    <AlertTriangle className="w-4 h-4" /> {cancelMsg}
                </div>
            )}

            {/* ═══ STEP 1: Select Amount ═══ */}
            {step === 'select' && (
                <div className="space-y-4">
                    {/* Amount grid */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-500" /> Chọn mệnh giá
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                            {displayAmounts.map(a => (
                                <button key={a} onClick={() => { setSelectedAmount(a); setCustomAmount(''); }}
                                    className={`relative py-4 rounded-xl text-center font-semibold transition-all border-2 ${
                                        selectedAmount === a
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                            : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-blue-200 hover:bg-blue-50/50'
                                    }`}>
                                    {isUsdt ? (
                                        <><span className="text-xs text-gray-400 mr-0.5">$</span><span className="text-base">{a}</span></>  
                                    ) : (
                                        <><span className="text-base">{a.toLocaleString('vi-VN')}</span><span className="text-xs text-gray-400 ml-0.5">đ</span></>  
                                    )}
                                    {selectedAmount === a && (
                                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <label className="text-xs font-medium text-gray-500 mb-2 block">Hoặc nhập số tiền khác</label>
                            <div className="relative">
                                <input type="number" value={customAmount}
                                    onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(0); }}
                                    placeholder={isUsdt ? 'Nhập số USDT (tối thiểu $1)' : 'Nhập số tiền (tối thiểu 2,000đ)'} min={minAmount} step={isUsdt ? '0.01' : '1000'}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">{isUsdt ? 'USDT' : 'VNĐ'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0 mt-0.5">
                                <Shield className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p className="font-semibold text-gray-700 text-sm">Nạp tiền an toàn & tự động</p>
                                <p>• Quét QR hoặc chuyển khoản thủ công đều được</p>
                                <p>• Hệ thống tự phát hiện giao dịch trong <strong>5 giây</strong></p>
                                <p>• Hỗ trợ USDT TRC20 & BEP20 thanh toán crypto</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-700 mb-3">Phương thức thanh toán</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {/* MBBank */}
                            <button onClick={() => { setPaymentMethod('mbbank'); setSelectedAmount(0); setCustomAmount(''); }}
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                    paymentMethod === 'mbbank'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-100 bg-gray-50 hover:border-blue-200'
                                }`}>
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs">MB</div>
                                <div className="text-left">
                                    <div className="text-sm font-semibold text-gray-800">MBBank</div>
                                    <div className="text-[10px] text-gray-500">Chuyển khoản QR</div>
                                </div>
                                {paymentMethod === 'mbbank' && <CheckCircle2 className="w-5 h-5 text-blue-500 ml-auto" />}
                            </button>

                            {/* USDT */}
                            <button onClick={() => { setPaymentMethod('usdt'); setSelectedAmount(0); setCustomAmount(''); }}
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'usdt'
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-gray-100 bg-gray-50 hover:border-emerald-200'
                                }`}>
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                                    <span className="text-white font-bold text-xs">₮</span>
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-semibold text-gray-800">USDT</div>
                                    <div className="text-[10px] text-gray-500">TRC20 / BEP20</div>
                                </div>
                                {paymentMethod === 'usdt' && <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" />}
                            </button>
                        </div>

                        {/* Rate preview — USDT only */}
                        {paymentMethod === 'usdt' && finalAmount >= 1 && (
                            <div className="mt-3 bg-emerald-50 rounded-xl p-3 text-sm">
                                <p className="text-gray-600">Tương đương: <strong className="text-emerald-700">~{estimatedVnd.toLocaleString('vi-VN')}đ</strong></p>
                                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                                    Tỷ giá realtime: 1 USDT ≈ {usdtRate.toLocaleString('vi-VN')}đ
                                    <span className="text-gray-300">({displayRateSource})</span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <button onClick={handleCreateDeposit} disabled={finalAmount < minAmount || loading || usdtLoading}
                        className={`w-full py-3.5 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 ${
                            paymentMethod === 'usdt'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : paymentMethod === 'usdt' ? <Zap className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                        {loading ? 'Đang tạo...' : finalAmount >= minAmount
                            ? isUsdt
                                ? `Nạp $${finalAmount} USDT (~${estimatedVnd.toLocaleString('vi-VN')}đ)`
                                : `Nạp ${finalAmount.toLocaleString('vi-VN')}đ qua MBBank`
                            : `Chọn số tiền để tiếp tục`}
                    </button>
                </div>
            )}

            {/* ═══ USDT STEP: Choose Network ═══ */}
            {step === 'usdt_network' && (
                <div className="space-y-4">
                    <button onClick={() => setStep('select')} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
                    </button>

                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-3">
                                <span className="text-white font-bold text-2xl">₮</span>
                            </div>
                            <h2 className="text-lg font-bold text-gray-900">Thanh toán bằng USDT</h2>
                            <p className="text-sm text-gray-500 mt-1">Chọn mạng blockchain để chuyển USDT</p>
                            <p className="text-xs text-emerald-600 font-semibold mt-2">
                                Số tiền: ${finalAmount} USDT ≈ {estimatedVnd.toLocaleString('vi-VN')}đ
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* TRC20 */}
                            <button onClick={() => handleCreateUsdtDeposit('TRC20')} disabled={usdtLoading}
                                className="group relative p-5 rounded-2xl border-2 border-red-100 hover:border-red-400 bg-gradient-to-br from-red-50 to-rose-50 transition-all hover:shadow-lg text-left">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">TRX</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">USDT (TRC20)</h3>
                                        <p className="text-xs text-gray-500">Mạng TRON</p>
                                    </div>
                                </div>
                                <div className="space-y-1 text-xs text-gray-500">
                                    <p>✓ Phí chuyển thấp (~1 TRX)</p>
                                    <p>✓ Xác nhận nhanh (~1 phút)</p>
                                    <p>✓ Phổ biến nhất</p>
                                </div>
                                {usdtLoading && usdtNetwork === 'TRC20' && (
                                    <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                                    </div>
                                )}
                            </button>

                            {/* BEP20 */}
                            <button onClick={() => handleCreateUsdtDeposit('BEP20')} disabled={usdtLoading}
                                className="group relative p-5 rounded-2xl border-2 border-yellow-100 hover:border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 transition-all hover:shadow-lg text-left">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-yellow-500 flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">BNB</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">USDT (BEP20)</h3>
                                        <p className="text-xs text-gray-500">Mạng BNB Chain</p>
                                    </div>
                                </div>
                                <div className="space-y-1 text-xs text-gray-500">
                                    <p>✓ Phí rất thấp (~$0.05)</p>
                                    <p>✓ Xác nhận nhanh (~15 giây)</p>
                                    <p>✓ Binance Smart Chain</p>
                                </div>
                                {usdtLoading && usdtNetwork === 'BEP20' && (
                                    <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ USDT STEP: Payment Details ═══ */}
            {step === 'usdt_payment' && usdtData && (
                <div className="space-y-4">
                    <button onClick={handleCancel} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <ArrowLeft className="w-3.5 h-3.5" /> Hủy & Quay lại
                    </button>

                    {/* ── SUCCESS ── */}
                    {usdtStatus === 'CONFIRMED' && (
                        <div className="bg-white rounded-2xl border-2 border-green-200 p-8 shadow-lg text-center space-y-4">
                            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                            </div>
                            <h3 className="text-2xl font-bold text-green-700">Nạp tiền thành công!</h3>
                            <p className="text-gray-500">
                                <strong className="text-green-600">{usdtData.amountVnd.toLocaleString('vi-VN')}đ</strong> đã được cộng vào ví
                            </p>
                            {usdtTxHash && (
                                <div className="bg-green-50 rounded-xl p-3 text-xs">
                                    <p className="text-gray-500">Transaction Hash:</p>
                                    <p className="font-mono text-green-700 break-all text-[11px]">{usdtTxHash}</p>
                                    {usdtExplorerUrl && (
                                        <a href={usdtExplorerUrl} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 mt-2 text-green-600 hover:text-green-700">
                                            <ExternalLink className="w-3 h-3" /> Xem trên blockchain
                                        </a>
                                    )}
                                </div>
                            )}
                            <div className="flex gap-3 justify-center pt-2">
                                <button onClick={handleCancel} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700 transition-all">Nạp thêm</button>
                                <button onClick={() => window.location.href = '/dashboard'} className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-all">Về Dashboard</button>
                            </div>
                        </div>
                    )}

                    {/* ── EXPIRED ── */}
                    {usdtStatus === 'EXPIRED' && (
                        <div className="bg-white rounded-2xl border border-orange-200 p-8 shadow-sm text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-8 h-8 text-orange-500" />
                            </div>
                            <h3 className="text-xl font-bold text-orange-700">Hết thời gian thanh toán</h3>
                            <p className="text-gray-500">Đơn đã hết hạn sau 15 phút. Vui lòng tạo đơn mới.</p>
                            <p className="text-xs text-gray-400">Nếu bạn đã chuyển tiền sau khi hết hạn, hệ thống sẽ tự phát hiện và xử lý.</p>
                            <button onClick={handleCancel} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-all">Tạo đơn mới</button>
                        </div>
                    )}

                    {/* ── PENDING: Payment Details ── */}
                    {usdtStatus === 'PENDING' && (
                        <>
                            {/* Network Tabs */}
                            <div className="flex gap-2">
                                <button onClick={() => handleSwitchNetwork('TRC20')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                                        usdtData.network === 'TRC20'
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}>
                                    <span className="font-bold">TRX</span> TRC20
                                </button>
                                <button onClick={() => handleSwitchNetwork('BEP20')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                                        usdtData.network === 'BEP20'
                                            ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}>
                                    <span className="font-bold">BNB</span> BEP20
                                </button>
                            </div>

                            {/* Countdown */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-emerald-500" />
                                        <span className="text-sm font-semibold text-gray-700">Thời gian thanh toán</span>
                                    </div>
                                    <span className={`text-sm font-bold tabular-nums ${usdtCountdown < 120 ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {formatTime(usdtCountdown)}
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-1000 ${usdtCountdown < 120 ? 'bg-red-400' : 'bg-emerald-400'}`}
                                        style={{ width: `${(usdtCountdown / USDT_COUNTDOWN_SECONDS) * 100}%` }} />
                                </div>
                                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Đang chờ thanh toán... hệ thống tự kiểm tra blockchain
                                </p>
                            </div>

                            {/* Main content: QR + Details */}
                            <div className="grid md:grid-cols-2 gap-4">
                                {/* QR Code */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col items-center">
                                    <h3 className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                        <QrCode className="w-4 h-4 text-emerald-500" /> Quét mã QR
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <img src={usdtData.qrImageUrl} alt="USDT QR Code"
                                            className="w-44 h-44 sm:w-56 sm:h-56 object-contain" />
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-3 text-center">
                                        Mở ví crypto → Quét QR → Gửi đúng số tiền USDT
                                    </p>
                                </div>

                                {/* Payment Info */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
                                    <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-emerald-500" /> Thông tin chuyển tiền
                                    </h3>

                                    {/* Network badge */}
                                    <div className={`rounded-xl p-3 flex items-center gap-3 ${
                                        usdtData.network === 'TRC20' ? 'bg-red-50' : 'bg-yellow-50'
                                    }`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[10px] ${
                                            usdtData.network === 'TRC20' ? 'bg-red-500' : 'bg-yellow-500'
                                        }`}>
                                            {usdtData.network === 'TRC20' ? 'TRX' : 'BNB'}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-700">{usdtData.networkLabel}</p>
                                            <p className="text-[10px] text-gray-500">{usdtData.chainName}</p>
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div className="bg-gray-50 rounded-xl p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[11px] text-gray-400 font-medium">ĐỊA CHỈ VÍ NHẬN</p>
                                            <button onClick={() => copy(usdtData.receivingAddress, 'addr')}
                                                className={`p-1.5 rounded-lg transition-all ${copied === 'addr' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-400 hover:text-blue-500 border border-gray-200'}`}>
                                                {copied === 'addr' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                        <p className="text-[11px] font-mono text-gray-900 break-all leading-relaxed">{usdtData.receivingAddress}</p>
                                    </div>

                                    {/* Amount USDT */}
                                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[11px] text-emerald-600 font-medium">SỐ TIỀN USDT CẦN GỬI</p>
                                                <p className="text-xl font-bold text-emerald-700">{usdtData.expectedUsdt} USDT</p>
                                                <p className="text-[10px] text-gray-400">= {usdtData.amountVnd.toLocaleString('vi-VN')}đ</p>
                                            </div>
                                            <button onClick={() => copy(usdtData.expectedUsdt.toString(), 'usdt')}
                                                className={`p-2 rounded-lg transition-all ${copied === 'usdt' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-400 hover:text-emerald-500 border border-emerald-200'}`}>
                                                {copied === 'usdt' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Warning */}
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                    <p className="text-sm font-bold text-red-700">Lưu ý quan trọng</p>
                                </div>
                                <ul className="text-xs text-red-600 space-y-1 pl-6">
                                    <li>• Chỉ gửi <strong>USDT</strong> đúng mạng <strong>{usdtData.networkLabel}</strong></li>
                                    <li>• Gửi sai mạng hoặc sai token sẽ <strong>không tự xác nhận</strong></li>
                                    <li>• Gửi <strong>đúng {usdtData.expectedUsdt} USDT</strong> để hệ thống tự nhận diện</li>
                                    <li>• Gửi thiếu có thể bị chờ xử lý thủ công</li>
                                    <li>• Thanh toán sẽ tự xác nhận trong vòng <strong>1-2 phút</strong></li>
                                </ul>
                            </div>

                            {/* Manual check button */}
                            <button onClick={async () => {
                                showToast('Đang kiểm tra blockchain...', 'info');
                                try {
                                    const token = localStorage.getItem('token') || '';
                                    const res = await fetch(`/api/v1/wallet/usdt?depositId=${usdtData.depositId}`, {
                                        headers: { 'Authorization': `Bearer ${token}` },
                                    });
                                    const data = await res.json();
                                    if (data.success && data.data.status === 'CONFIRMED') {
                                        setUsdtStatus('CONFIRMED');
                                        setUsdtTxHash(data.data.txHash);
                                        setUsdtExplorerUrl(data.data.explorerUrl);
                                        cleanup();
                                        if (user) updateUser({ walletBalance: (user.walletBalance || 0) + finalAmount });
                                    } else {
                                        showToast('Chưa phát hiện giao dịch. Hệ thống sẽ tự kiểm tra.', 'info');
                                    }
                                } catch {
                                    showToast('Lỗi kết nối', 'error');
                                }
                            }}
                                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4" /> Tôi đã chuyển tiền — Kiểm tra lại
                            </button>

                            {/* Cancel */}
                            <button onClick={handleCancel}
                                className="w-full py-2.5 text-gray-400 hover:text-gray-600 text-sm transition-all flex items-center justify-center gap-1">
                                <X className="w-3.5 h-3.5" /> Hủy đơn nạp tiền
                            </button>
                        </>
                    )}

                    {/* ── PARTIAL ── */}
                    {usdtStatus === 'PARTIAL' && (
                        <div className="bg-white rounded-2xl border border-yellow-200 p-6 shadow-sm text-center space-y-3">
                            <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto" />
                            <h3 className="text-lg font-bold text-yellow-700">Thanh toán thiếu</h3>
                            <p className="text-sm text-gray-500">Số tiền nhận được chưa đủ. Vui lòng liên hệ hỗ trợ hoặc chờ hệ thống xử lý.</p>
                            <button onClick={handleCancel} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700 transition-all">Quay lại</button>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ MBBANK Invoice Step ═══ */}
            {step === 'invoice' && deposit && (
                <div className="space-y-4">
                    <button onClick={handleCancel} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" /> Tạo đơn khác
                    </button>

                    {status === 'success' && (
                        <div className="bg-white rounded-2xl border border-green-200 p-8 shadow-sm text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                            </div>
                            <h3 className="text-xl font-bold text-green-700">Nạp tiền thành công!</h3>
                            <p className="text-gray-500">
                                <strong className="text-green-600">{deposit.amount.toLocaleString('vi-VN')}đ</strong> đã được cộng vào ví
                            </p>
                            <div className="flex gap-3 justify-center pt-2">
                                <button onClick={handleCancel} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-semibold text-gray-700 transition-all">Nạp thêm</button>
                                <button onClick={() => window.location.href = '/dashboard'} className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-all">Về Dashboard</button>
                            </div>
                        </div>
                    )}

                    {status === 'expired' && (
                        <div className="bg-white rounded-2xl border border-orange-200 p-8 shadow-sm text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-8 h-8 text-orange-500" />
                            </div>
                            <h3 className="text-xl font-bold text-orange-700">Hết thời gian chờ</h3>
                            <p className="text-gray-500">Đơn đã hết hạn. Vui lòng tạo đơn mới.</p>
                            <button onClick={handleCancel} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-all">Tạo đơn mới</button>
                        </div>
                    )}

                    {status === 'pending' && (
                        <>
                            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                        <span className="text-sm font-semibold text-gray-700">Thời gian chờ thanh toán</span>
                                    </div>
                                    <span className={`text-sm font-bold tabular-nums ${countdown < 60 ? 'text-red-500' : 'text-blue-600'}`}>{formatTime(countdown)}</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-1000 ${countdown < 60 ? 'bg-red-400' : 'bg-blue-400'}`}
                                        style={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }} />
                                </div>
                                {checkMsg && (
                                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" /> {checkMsg}
                                    </p>
                                )}
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm flex flex-col items-center">
                                    <h3 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                                        <QrCode className="w-4 h-4 text-blue-500" /> Quét mã QR
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <img src={deposit.qrUrl} alt="QR Code" className="w-44 h-44 sm:w-56 sm:h-56" />
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-3 text-center">Mở app ngân hàng → Quét QR → Xác nhận</p>
                                </div>

                                <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-blue-500" /> Chuyển khoản thủ công
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-[11px] text-gray-400 font-medium">NGÂN HÀNG</p>
                                                <p className="text-sm font-bold text-gray-800">{deposit.bankName || 'MB Bank'}</p>
                                            </div>
                                            <img src="https://cdn.haitrieu.com/wp-content/uploads/2022/02/Logo-MB-Bank-MBB.png" className="h-8 w-8 rounded bg-white p-0.5" alt="MB" />
                                        </div>
                                        <div className="bg-gray-50 rounded-xl p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[11px] text-gray-400 font-medium">SỐ TÀI KHOẢN</p>
                                                    <p className="text-lg font-bold text-gray-900 tracking-wider font-mono">{deposit.bankAccount}</p>
                                                </div>
                                                <button onClick={() => copy(deposit.bankAccount, 'stk')}
                                                    className={`p-2 rounded-lg transition-all ${copied === 'stk' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-400 hover:text-blue-500 border border-gray-200'}`}>
                                                    {copied === 'stk' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 rounded-xl p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[11px] text-blue-500 font-medium">SỐ TIỀN</p>
                                                    <p className="text-lg font-bold text-blue-700">{deposit.amount.toLocaleString('vi-VN')}đ</p>
                                                </div>
                                                <button onClick={() => copy(deposit.amount.toString(), 'amount')}
                                                    className={`p-2 rounded-lg transition-all ${copied === 'amount' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-400 hover:text-blue-500 border border-blue-200'}`}>
                                                    {copied === 'amount' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bg-yellow-50 border-2 border-yellow-200 border-dashed rounded-xl p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] text-yellow-600 font-bold">⚠️ NỘI DUNG CK (BẮT BUỘC)</p>
                                                    <p className="text-base font-bold text-yellow-800 font-mono tracking-wide break-all">{deposit.transferContent}</p>
                                                </div>
                                                <button onClick={() => copy(deposit.transferContent, 'content')}
                                                    className={`p-2 rounded-lg transition-all ml-2 shrink-0 ${copied === 'content' ? 'bg-green-100 text-green-600' : 'bg-white text-gray-400 hover:text-yellow-600 border border-yellow-300'}`}>
                                                    {copied === 'content' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleCancel}
                                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                                <X className="w-4 h-4" /> Hủy đơn nạp tiền
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
