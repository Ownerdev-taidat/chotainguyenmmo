'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CreditCard, QrCode, Copy, CheckCircle2, RefreshCw, Clock, AlertTriangle, ArrowRight, Wallet } from 'lucide-react';

const DEPOSIT_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

export default function DepositPage() {
    const { user, updateUser } = useAuth();
    const [amount, setAmount] = useState(0);
    const [customAmount, setCustomAmount] = useState('');
    const [step, setStep] = useState<'select' | 'transfer' | 'verify'>('select');
    const [depositCode, setDepositCode] = useState('');
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<any>(null);
    const [copied, setCopied] = useState('');
    const [autoCheckCount, setAutoCheckCount] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
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
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(''), 2000);
    };

    const checkDeposit = async () => {
        setChecking(true);
        try {
            const res = await fetch('/api/payment/mbbank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ depositCode, amount: selectedAmount }),
            });
            const data = await res.json();
            setCheckResult(data);

            if (data.status === 'found') {
                // Auto-approve: update user balance
                if (user) {
                    updateUser({ walletBalance: (user.walletBalance || 0) + selectedAmount });
                }
                setStep('verify');
                // Stop auto-checking
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            }
        } catch {
            setCheckResult({ status: 'error', message: 'Lỗi kết nối. Thử lại sau.' });
        }
        setChecking(false);
    };

    // Auto-check every 15 seconds
    const startAutoCheck = () => {
        if (intervalRef.current) return;
        intervalRef.current = setInterval(() => {
            setAutoCheckCount(prev => prev + 1);
            checkDeposit();
        }, 15000);
    };

    useEffect(() => {
        if (step === 'transfer') {
            startAutoCheck();
        }
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [step]);

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

            {/* Step 2: Transfer */}
            {step === 'transfer' && (
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

                        {/* Auto-check Status */}
                        <div className="bg-brand-surface-2 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-center gap-2 text-sm text-brand-text-secondary">
                                {checking ? (
                                    <><RefreshCw className="w-4 h-4 animate-spin text-brand-primary" /> Đang kiểm tra giao dịch...</>
                                ) : (
                                    <><Clock className="w-4 h-4 text-brand-text-muted" /> Tự động kiểm tra mỗi 15 giây</>
                                )}
                            </div>
                            {autoCheckCount > 0 && (
                                <div className="text-[10px] text-brand-text-muted">Đã kiểm tra {autoCheckCount} lần</div>
                            )}
                            <button onClick={checkDeposit} disabled={checking}
                                className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /> Kiểm tra ngay
                            </button>
                            {checkResult?.status === 'not_found' && (
                                <p className="text-xs text-brand-text-muted">{checkResult.message}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Success */}
            {step === 'verify' && (
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
                            <div className="text-brand-text-muted">Mã GD: <span className="text-brand-text-primary font-medium">{checkResult.transaction.transactionID}</span></div>
                            <div className="text-brand-text-muted">Thời gian: <span className="text-brand-text-primary font-medium">{checkResult.transaction.transactionDate}</span></div>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={() => { setStep('select'); setAmount(0); setCustomAmount(''); setCheckResult(null); setAutoCheckCount(0); }}
                            className="btn-secondary flex-1 text-sm">Nạp thêm</button>
                        <button onClick={() => window.location.href = '/dashboard/vi'} className="btn-primary flex-1 text-sm">Xem ví</button>
                    </div>
                </div>
            )}
        </div>
    );
}
