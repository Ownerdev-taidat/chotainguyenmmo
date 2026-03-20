'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CheckCircle2, Copy, Loader2, AlertTriangle, Wallet, QrCode, Clock, X, ArrowLeft, CreditCard, Shield } from 'lucide-react';
import { useUI } from '@/components/shared/UIProvider';

const DEPOSIT_AMOUNTS = [2000, 5000, 10000, 50000, 100000, 200000, 500000, 1000000];
const CHECK_INTERVAL_MS = 1500;
const COUNTDOWN_SECONDS = 250;

export default function DepositPage() {
    const { user, updateUser } = useAuth();
    const { showToast } = useUI();
    const [step, setStep] = useState<'select' | 'invoice'>('select');
    const [selectedAmount, setSelectedAmount] = useState<number>(0);
    const [customAmount, setCustomAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [deposit, setDeposit] = useState<any>(null);
    const [status, setStatus] = useState<'pending' | 'success' | 'expired'>('pending');
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
    const [checkMsg, setCheckMsg] = useState('');
    const [copied, setCopied] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'mbbank' | 'momo'>('mbbank');
    const [momoLoading, setMomoLoading] = useState(false);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const statusRef = useRef('pending');
    const depositRef = useRef<any>(null);

    useEffect(() => { statusRef.current = status; }, [status]);
    useEffect(() => { depositRef.current = deposit; }, [deposit]);

    const finalAmount = selectedAmount || parseInt(customAmount) || 0;

    const copy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(''), 2000);
    };

    const cleanup = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    }, []);

    // Create deposit via API (creates record in DB with proper NAPCTN code)
    const handleCreateDeposit = async () => {
        if (finalAmount < 2000) return;
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
        } catch (e) {
            showToast('Không thể kết nối server', 'error');
        }
        setLoading(false);
    };

    // Auto-check when deposit is created
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
                    body: JSON.stringify({
                        depositCode: depositRef.current.transferContent,
                        amount: depositRef.current.amount,
                    }),
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

        // Countdown
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    statusRef.current = 'expired';
                    setStatus('expired');
                    setCheckMsg('');
                    cleanup();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return cleanup;
    }, [step, deposit, status]);

    const [cancelMsg, setCancelMsg] = useState('');

    const handleCancel = () => {
        cleanup();
        setDeposit(null);
        setStep('select');
        setStatus('pending');
        setCheckMsg('');
        setCountdown(COUNTDOWN_SECONDS);
        setCancelMsg('Đã hủy đơn nạp tiền');
        setTimeout(() => setCancelMsg(''), 3000);
    };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    const countdownPercent = (countdown / COUNTDOWN_SECONDS) * 100;

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Nạp tiền</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Chuyển khoản MBBank · Tự động xác nhận</p>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">{(user?.walletBalance || 0).toLocaleString('vi-VN')}đ</span>
                </div>
            </div>

            {/* Cancel toast */}
            {cancelMsg && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 animate-pulse">
                    <AlertTriangle className="w-4 h-4" /> {cancelMsg}
                </div>
            )}

            {/* STEP 1: Select Amount */}
            {step === 'select' && (
                <div className="space-y-4">
                    {/* Amount grid */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-500" /> Chọn mệnh giá
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                            {DEPOSIT_AMOUNTS.map(a => (
                                <button key={a} onClick={() => { setSelectedAmount(a); setCustomAmount(''); }}
                                    className={`relative py-4 rounded-xl text-center font-semibold transition-all border-2 ${
                                        selectedAmount === a
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                            : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-blue-200 hover:bg-blue-50/50'
                                    }`}>
                                    <span className="text-base">{a.toLocaleString('vi-VN')}</span>
                                    <span className="text-xs text-gray-400 ml-0.5">đ</span>
                                    {selectedAmount === a && (
                                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Custom amount */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <label className="text-xs font-medium text-gray-500 mb-2 block">Hoặc nhập số tiền khác</label>
                            <div className="relative">
                                <input type="number" value={customAmount}
                                    onChange={e => { setCustomAmount(e.target.value); setSelectedAmount(0); }}
                                    placeholder="Nhập số tiền (tối thiểu 2,000đ)" min={2000}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">VNĐ</span>
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
                                <p>• Tiền sẽ được cộng ngay vào ví sau khi xác nhận</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-700 mb-3">Phương thức thanh toán</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setPaymentMethod('mbbank')}
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
                                {paymentMethod === 'mbbank' && (
                                    <CheckCircle2 className="w-5 h-5 text-blue-500 ml-auto" />
                                )}
                            </button>
                            {/* MoMo - tạm ẩn, bật lại khi MoMo Business được duyệt */}
                        </div>
                    </div>

                    {/* Submit */}
                    <button onClick={handleCreateDeposit} disabled={finalAmount < 2000 || loading}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                        {loading ? 'Đang tạo...' : finalAmount >= 2000
                            ? `Nạp ${finalAmount.toLocaleString('vi-VN')}đ qua MBBank`
                            : 'Chọn số tiền để tiếp tục'}
                    </button>
                </div>
            )}

            {/* STEP 2: Invoice / QR Code */}
            {step === 'invoice' && deposit && (
                <div className="space-y-4">
                    {/* Back button */}
                    <button onClick={handleCancel} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" /> Tạo đơn khác
                    </button>

                    {/* PAID */}
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

                    {/* EXPIRED */}
                    {status === 'expired' && (
                        <div className="bg-white rounded-2xl border border-orange-200 p-8 shadow-sm text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-8 h-8 text-orange-500" />
                            </div>
                            <h3 className="text-xl font-bold text-orange-700">Hết thời gian chờ</h3>
                            <p className="text-gray-500">Đơn đã hết hạn sau {COUNTDOWN_SECONDS / 60} phút. Vui lòng tạo đơn mới.</p>
                            <button onClick={handleCancel} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-all">Tạo đơn mới</button>
                        </div>
                    )}

                    {/* PENDING — QR + Bank Info */}
                    {status === 'pending' && (
                        <>
                            {/* Countdown bar */}
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
                                        style={{ width: `${countdownPercent}%` }} />
                                </div>
                                {checkMsg && (
                                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" /> {checkMsg}
                                    </p>
                                )}
                            </div>

                            {/* Main content: two columns */}
                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Left: QR Code */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm flex flex-col items-center">
                                    <h3 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                                        <QrCode className="w-4 h-4 text-blue-500" /> Quét mã QR
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <img src={deposit.qrUrl} alt="QR Code" className="w-44 h-44 sm:w-56 sm:h-56" />
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-3 text-center">Mở app ngân hàng → Quét QR → Xác nhận</p>
                                </div>

                                {/* Right: Bank Info */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-sm space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-blue-500" /> Chuyển khoản thủ công
                                    </h3>

                                    {/* Bank */}
                                    <div className="space-y-3">
                                        <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-[11px] text-gray-400 font-medium">NGÂN HÀNG</p>
                                                <p className="text-sm font-bold text-gray-800">{deposit.bankName || 'MB Bank'}</p>
                                            </div>
                                            <img src="https://cdn.haitrieu.com/wp-content/uploads/2022/02/Logo-MB-Bank-MBB.png" className="h-8 w-8 rounded bg-white p-0.5" alt="MB" />
                                        </div>

                                        {/* STK */}
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

                                        {/* Amount */}
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

                                        {/* Transfer content — CRITICAL */}
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

                            {/* Cancel button */}
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
