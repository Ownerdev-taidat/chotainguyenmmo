'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CreditCard, QrCode, Copy, CheckCircle2, RefreshCw, Clock, AlertTriangle, ArrowRight, Wallet, XCircle, Timer } from 'lucide-react';

const DEPOSIT_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];
const COUNTDOWN_SECONDS = 250;
const CHECK_INTERVAL_MS = 3000; // 3 seconds

export default function DepositPage() {
    const { user, updateUser } = useAuth();
    const [amount, setAmount] = useState(0);
    const [customAmount, setCustomAmount] = useState('');
    const [step, setStep] = useState<'select' | 'transfer' | 'success' | 'expired'>('select');
    const [depositCode, setDepositCode] = useState('');
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<any>(null);
    const [copied, setCopied] = useState('');
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const [bankInfo, setBankInfo] = useState({ bank: 'MB Bank', accountNo: '0393959643', accountName: 'NGUYEN TAI DAT' });

    // Load bank info from admin settings
    useEffect(() => {
        fetch('/api/v1/admin/settings')
            .then(r => r.json())
            .then(d => {
                if (d.success && d.data?.settings) {
                    const s = d.data.settings;
                    setBankInfo({
                        bank: s.bankName || 'MB Bank',
                        accountNo: s.bankAccount || '0393959643',
                        accountName: s.bankOwner || 'NGUYEN TAI DAT',
                    });
                }
            })
            .catch(() => {});
    }, []);

    // Generate unique deposit code
    useEffect(() => {
        const code = 'CTN' + Date.now().toString(36).toUpperCase().slice(-6);
        setDepositCode(code);
    }, []);

    const selectedAmount = customAmount ? parseInt(customAmount) : amount;

    const handleProceed = () => {
        if (selectedAmount < 10000) return;
        setStep('transfer');
        setCountdown(COUNTDOWN_SECONDS);
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(''), 2000);
    };

    const stopAllTimers = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
    }, []);

    const checkDeposit = useCallback(async () => {
        if (checking) return;
        setChecking(true);
        try {
            // First try the proper server-side check that updates DB
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/wallet/deposits/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ depositCode, amount: selectedAmount }),
            });
            const data = await res.json();
            setCheckResult(data);

            if (data.status === 'found') {
                // Payment found — update user balance and go to success
                if (user) {
                    updateUser({ walletBalance: (user.walletBalance || 0) + selectedAmount });
                }
                setStep('success');
                stopAllTimers();
            }
        } catch {
            // Fallback: try direct mbbank API
            try {
                const res = await fetch('/api/payment/mbbank', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ depositCode, amount: selectedAmount }),
                });
                const data = await res.json();
                setCheckResult(data);

                if (data.status === 'found') {
                    if (user) {
                        updateUser({ walletBalance: (user.walletBalance || 0) + selectedAmount });
                    }
                    setStep('success');
                    stopAllTimers();
                }
            } catch {
                setCheckResult({ status: 'error', message: 'Lỗi kết nối. Hệ thống sẽ thử lại.' });
            }
        }
        setChecking(false);
    }, [checking, depositCode, selectedAmount, user, updateUser, stopAllTimers]);

    // Start auto-check (3s) and countdown when in transfer step
    useEffect(() => {
        if (step === 'transfer') {
            // Start 3s auto-check
            if (!intervalRef.current) {
                // Do first check immediately
                checkDeposit();
                intervalRef.current = setInterval(checkDeposit, CHECK_INTERVAL_MS);
            }

            // Start countdown
            if (!countdownRef.current) {
                countdownRef.current = setInterval(() => {
                    setCountdown(prev => {
                        if (prev <= 1) {
                            // Time expired — auto-cancel
                            stopAllTimers();
                            setStep('expired');
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }
        }

        return () => {
            stopAllTimers();
        };
    }, [step]);

    const handleCancel = () => {
        stopAllTimers();
        setStep('select');
        setAmount(0);
        setCustomAmount('');
        setCheckResult(null);
        setCountdown(COUNTDOWN_SECONDS);
        // Generate new deposit code
        const code = 'CTN' + Date.now().toString(36).toUpperCase().slice(-6);
        setDepositCode(code);
    };

    const handleRetry = () => {
        setStep('select');
        setAmount(0);
        setCustomAmount('');
        setCheckResult(null);
        setCountdown(COUNTDOWN_SECONDS);
        const code = 'CTN' + Date.now().toString(36).toUpperCase().slice(-6);
        setDepositCode(code);
    };

    // Format countdown
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const countdownPercent = (countdown / COUNTDOWN_SECONDS) * 100;
    const isUrgent = countdown <= 60;

    const qrUrl = `https://img.vietqr.io/image/MBBank-${bankInfo.accountNo}-compact2.jpg?amount=${selectedAmount}&addInfo=${depositCode}&accountName=${encodeURIComponent(bankInfo.accountName)}`;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Nạp tiền</h1>
                <p className="text-sm text-brand-text-muted">Chuyển khoản đến MBBank — hệ thống tự động xác nhận & cộng tiền vào ví.</p>
            </div>

            {/* Current Balance */}
            <div className="card !p-4 bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                        <div className="text-xs text-brand-text-muted">Số dư ví hiện tại</div>
                        <div className="text-xl font-bold text-brand-primary">{(user?.walletBalance || 0).toLocaleString('vi-VN')}đ</div>
                    </div>
                </div>
            </div>

            {/* Step 1: Select Amount */}
            {step === 'select' && (
                <div className="card space-y-5">
                    <h2 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-brand-primary" /> Chọn số tiền nạp
                    </h2>
                    <div className="grid grid-cols-3 gap-3">
                        {DEPOSIT_AMOUNTS.map(a => (
                            <button key={a} onClick={() => { setAmount(a); setCustomAmount(''); }}
                                className={`py-3 rounded-xl text-sm font-semibold transition-all ${amount === a && !customAmount ? 'bg-brand-primary text-white shadow-md' : 'bg-brand-surface-2 text-brand-text-secondary hover:border-brand-primary border border-transparent'}`}>
                                {a.toLocaleString('vi-VN')}đ
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="text-xs text-brand-text-muted mb-1 block">Hoặc nhập số tiền tùy chỉnh:</label>
                        <input type="number" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setAmount(0); }}
                            placeholder="VD: 300000" className="input-field w-full text-sm" min={10000} />
                    </div>
                    <button onClick={handleProceed} disabled={selectedAmount < 10000}
                        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                        Tiếp tục <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Step 2: Transfer — with countdown timer */}
            {step === 'transfer' && (
                <div className="space-y-4">
                    {/* Countdown Timer Bar */}
                    <div className={`card !p-4 border-2 ${isUrgent ? 'border-brand-danger/50 bg-brand-danger/5' : 'border-brand-primary/30 bg-brand-primary/5'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Timer className={`w-5 h-5 ${isUrgent ? 'text-brand-danger animate-pulse' : 'text-brand-primary'}`} />
                                <span className={`text-sm font-semibold ${isUrgent ? 'text-brand-danger' : 'text-brand-text-primary'}`}>
                                    Thời gian chờ thanh toán
                                </span>
                            </div>
                            <div className={`text-2xl font-bold font-mono ${isUrgent ? 'text-brand-danger' : 'text-brand-primary'}`}>
                                {formatTime(countdown)}
                            </div>
                        </div>
                        <div className="w-full bg-brand-surface-3 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? 'bg-brand-danger' : 'bg-brand-primary'}`}
                                style={{ width: `${countdownPercent}%` }}
                            />
                        </div>
                        {checking && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-brand-primary">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Đang kiểm tra giao dịch...
                            </div>
                        )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Bank Info */}
                        <div className="card space-y-4">
                            <h2 className="text-sm font-semibold text-brand-text-primary">Thông tin chuyển khoản</h2>
                            {[
                                { label: 'Ngân hàng', value: bankInfo.bank },
                                { label: 'Số tài khoản', value: bankInfo.accountNo, copyable: true },
                                { label: 'Chủ tài khoản', value: bankInfo.accountName },
                                { label: 'Số tiền', value: selectedAmount.toLocaleString('vi-VN') + 'đ', copyable: true, copyValue: selectedAmount.toString() },
                                { label: 'Nội dung CK', value: depositCode, copyable: true, highlight: true },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between bg-brand-surface-2 rounded-xl p-3">
                                    <div>
                                        <div className="text-[10px] text-brand-text-muted uppercase tracking-wider">{item.label}</div>
                                        <div className={`text-sm font-semibold ${item.highlight ? 'text-brand-primary' : 'text-brand-text-primary'}`}>{item.value}</div>
                                    </div>
                                    {item.copyable && (
                                        <button onClick={() => copyToClipboard(item.copyValue || item.value, item.label)}
                                            className="p-2 rounded-lg hover:bg-brand-surface-3 transition-colors">
                                            {copied === item.label ? <CheckCircle2 className="w-4 h-4 text-brand-success" /> : <Copy className="w-4 h-4 text-brand-text-muted" />}
                                        </button>
                                    )}
                                </div>
                            ))}

                            <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-xl p-3 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
                                <div className="text-xs text-brand-text-secondary">
                                    <span className="font-semibold text-brand-warning">Quan trọng:</span> Nhập đúng nội dung chuyển khoản <span className="font-bold text-brand-primary">{depositCode}</span> để hệ thống tự động xác nhận.
                                </div>
                            </div>
                        </div>

                        {/* QR Code */}
                        <div className="card text-center space-y-4">
                            <h2 className="text-sm font-semibold text-brand-text-primary flex items-center justify-center gap-2">
                                <QrCode className="w-4 h-4 text-brand-primary" /> Quét mã QR
                            </h2>
                            <div className="bg-white rounded-xl p-4 inline-block mx-auto">
                                <img src={qrUrl} alt="QR Code" className="w-56 h-56 mx-auto" />
                            </div>
                            <p className="text-xs text-brand-text-muted">Mở app ngân hàng → Quét QR → Xác nhận chuyển</p>

                            <button onClick={handleCancel}
                                className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
                                <XCircle className="w-4 h-4" /> Hủy giao dịch
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Success */}
            {step === 'success' && (
                <div className="card text-center space-y-4 max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-full bg-brand-success/15 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8 text-brand-success" />
                    </div>
                    <h2 className="text-xl font-bold text-brand-text-primary">Nạp tiền thành công!</h2>
                    <div className="bg-brand-success/10 rounded-xl p-4">
                        <div className="text-sm text-brand-text-muted mb-1">Số tiền đã cộng</div>
                        <div className="text-2xl font-bold text-brand-success">+{selectedAmount.toLocaleString('vi-VN')}đ</div>
                    </div>
                    {checkResult?.transaction && (
                        <div className="bg-brand-surface-2 rounded-xl p-3 text-left text-xs space-y-1">
                            <div className="text-brand-text-muted">Mã GD: <span className="text-brand-text-primary font-medium">{checkResult.transaction.transaction_id || checkResult.transaction.transactionID}</span></div>
                            <div className="text-brand-text-muted">Thời gian: <span className="text-brand-text-primary font-medium">{checkResult.transaction.transaction_date || checkResult.transaction.transactionDate}</span></div>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={handleRetry} className="btn-secondary flex-1 text-sm">Nạp thêm</button>
                        <button onClick={() => window.location.href = '/dashboard/vi'} className="btn-primary flex-1 text-sm">Xem ví</button>
                    </div>
                </div>
            )}

            {/* Step 4: Expired */}
            {step === 'expired' && (
                <div className="card text-center space-y-4 max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-full bg-brand-danger/15 flex items-center justify-center mx-auto">
                        <XCircle className="w-8 h-8 text-brand-danger" />
                    </div>
                    <h2 className="text-xl font-bold text-brand-text-primary">Hết thời gian thanh toán</h2>
                    <p className="text-sm text-brand-text-muted">
                        Hóa đơn đã tự động hủy do không nhận được thanh toán trong {Math.floor(COUNTDOWN_SECONDS / 60)} phút {COUNTDOWN_SECONDS % 60} giây.
                    </p>
                    <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
                        <div className="text-xs text-brand-text-secondary">
                            Nếu bạn đã chuyển tiền nhưng chưa được ghi nhận, vui lòng liên hệ hỗ trợ kèm theo ảnh chụp màn hình giao dịch.
                        </div>
                    </div>
                    <button onClick={handleRetry} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Tạo hóa đơn mới
                    </button>
                </div>
            )}
        </div>
    );
}
