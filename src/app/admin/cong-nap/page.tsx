'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, Eye, EyeOff, CheckCircle2, AlertTriangle, CreditCard, Wifi, WifiOff, Settings, Key, User, Lock, Smartphone, Hash, Globe, Cookie } from 'lucide-react';

interface GatewayConfig {
    [key: string]: string;
}

const FIELD_META: Record<string, { label: string; icon: any; sensitive: boolean; description: string }> = {
    botToken: { label: 'Bot Token (Telegram)', icon: Key, sensitive: true, description: 'Token của Telegram Bot để gửi thông báo giao dịch' },
    chat_id: { label: 'Chat ID (Telegram)', icon: Hash, sensitive: false, description: 'ID chat Telegram nhận thông báo' },
    apicanhanKey: { label: 'API Key (apicanhan)', icon: Key, sensitive: true, description: 'API key từ apicanhan.com để truy vấn giao dịch' },
    apicanhanUser: { label: 'Username (apicanhan)', icon: User, sensitive: false, description: 'Username đăng nhập apicanhan' },
    apicanhanPass: { label: 'Password (apicanhan)', icon: Lock, sensitive: true, description: 'Mật khẩu apicanhan' },
    apicanhanAccount: { label: 'Số tài khoản (apicanhan)', icon: CreditCard, sensitive: false, description: 'STK MB Bank liên kết' },
    sessionId: { label: 'Session ID (MB)', icon: Globe, sensitive: true, description: 'Session ID phiên đăng nhập MBBank' },
    id_run: { label: 'ID Run (MB)', icon: Hash, sensitive: false, description: 'ID chạy phiên MBBank' },
    token: { label: 'Token (MB)', icon: Key, sensitive: true, description: 'JWT/Auth token MBBank' },
    cookie: { label: 'Cookie (MB)', icon: Cookie, sensitive: true, description: 'Cookie phiên MBBank — cập nhật khi hết hạn' },
    deviceid: { label: 'Device ID', icon: Smartphone, sensitive: false, description: 'ID thiết bị đăng nhập MBBank' },
    user: { label: 'User (MB)', icon: User, sensitive: false, description: 'Username MBBank' },
    accountNo: { label: 'Số tài khoản (MB)', icon: CreditCard, sensitive: false, description: 'Số tài khoản nhận tiền' },
    accountOwner: { label: 'Chủ tài khoản', icon: User, sensitive: false, description: 'Tên chủ tài khoản MBBank hiển thị trên QR' },
};

export default function AdminPaymentConfigPage() {
    const [config, setConfig] = useState<GatewayConfig>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
    const [toast, setToast] = useState('');
    const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [testResult, setTestResult] = useState<any>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    useEffect(() => {
        loadConfig();
        checkApiStatus();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/payment/config');
            const data = await res.json();
            if (data.config) {
                setConfig(data.config);
            }
        } catch (err) {
            showToast('❌ Không thể tải config');
        }
        setLoading(false);
    };

    const checkApiStatus = async () => {
        setApiStatus('checking');
        try {
            const res = await fetch('/api/payment/mbbank');
            const data = await res.json();
            if (data.status === 'success') {
                setApiStatus('online');
                setTestResult(data);
            } else {
                setApiStatus('offline');
            }
        } catch {
            setApiStatus('offline');
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/payment/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (data.status === 'success') {
                showToast('✅ Đã lưu cấu hình thành công');
            } else {
                showToast('❌ Lỗi: ' + data.error);
            }
        } catch (err) {
            showToast('❌ Không thể lưu config');
        }
        setSaving(false);
    };

    const toggleSensitive = (key: string) => {
        setShowSensitive(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Cấu hình cổng nạp tiền</h1>
                    <p className="text-sm text-brand-text-muted">Quản lý và cập nhật thông tin kết nối MBBank API, Telegram Bot, apicanhan.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadConfig} className="btn-secondary !py-2 text-sm flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4" /> Tải lại
                    </button>
                    <button onClick={saveConfig} disabled={saving} className="btn-primary !py-2 text-sm flex items-center gap-1.5 disabled:opacity-50">
                        <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu config'}
                    </button>
                </div>
            </div>

            {/* API Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`card !p-4 border ${apiStatus === 'online' ? 'border-brand-success/30 !bg-brand-success/5' : apiStatus === 'offline' ? 'border-brand-danger/30 !bg-brand-danger/5' : 'border-brand-warning/30 !bg-brand-warning/5'}`}>
                    <div className="flex items-center gap-3">
                        {apiStatus === 'online' ? <Wifi className="w-5 h-5 text-brand-success" /> : apiStatus === 'offline' ? <WifiOff className="w-5 h-5 text-brand-danger" /> : <RefreshCw className="w-5 h-5 text-brand-warning animate-spin" />}
                        <div>
                            <div className="text-sm font-semibold text-brand-text-primary">
                                {apiStatus === 'online' ? 'MBBank API: Online' : apiStatus === 'offline' ? 'MBBank API: Offline' : 'Đang kiểm tra...'}
                            </div>
                            <div className="text-xs text-brand-text-muted">
                                {testResult?.source === 'local_cache' ? 'Dùng cache cục bộ' : testResult?.source === 'live' ? 'Kết nối trực tiếp' : 'Chưa kết nối'}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card !p-4">
                    <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-brand-primary" />
                        <div>
                            <div className="text-sm font-semibold text-brand-text-primary">STK: {config.accountNo || '---'}</div>
                            <div className="text-xs text-brand-text-muted">MBBank — {config.accountOwner || 'Chưa cấu hình'}</div>
                        </div>
                    </div>
                </div>
                <div className="card !p-4">
                    <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-brand-info" />
                        <div>
                            <div className="text-sm font-semibold text-brand-text-primary">{testResult?.transactions?.length || 0} giao dịch gần đây</div>
                            <div className="text-xs text-brand-text-muted">Dữ liệu từ API</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Config Fields */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-brand-primary" /> Cấu hình MBBank & Telegram
                </h3>
                <div className="space-y-4">
                    {Object.entries(FIELD_META).map(([key, meta]) => {
                        const value = config[key] || '';
                        const isHidden = meta.sensitive && !showSensitive[key];
                        return (
                            <div key={key} className="group">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <meta.icon className="w-3.5 h-3.5 text-brand-text-muted" />
                                    <label className="text-sm font-medium text-brand-text-secondary">{meta.label}</label>
                                    {meta.sensitive && (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-brand-warning/10 text-brand-warning rounded-full font-medium">Nhạy cảm</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={isHidden ? 'password' : 'text'}
                                            value={value}
                                            onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                                            placeholder={meta.description}
                                            className="input-field w-full text-sm !pr-10"
                                        />
                                        {meta.sensitive && (
                                            <button onClick={() => toggleSensitive(key)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text-primary">
                                                {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-[10px] text-brand-text-muted mt-1 ml-5">{meta.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Recent Transactions Preview */}
            {testResult?.transactions?.length > 0 && (
                <div className="card">
                    <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Giao dịch gần đây (Preview)</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {testResult.transactions.slice(0, 10).map((tx: any, i: number) => (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${tx.type === 'IN' ? 'bg-brand-success/5' : 'bg-brand-danger/5'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'IN' ? 'bg-brand-success/15' : 'bg-brand-danger/15'}`}>
                                    <span className={`text-xs font-bold ${tx.type === 'IN' ? 'text-brand-success' : 'text-brand-danger'}`}>{tx.type}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-brand-text-primary font-medium truncate">{tx.description?.substring(0, 80)}</div>
                                    <div className="text-[10px] text-brand-text-muted">{tx.transactionDate} · {tx.transactionID}</div>
                                </div>
                                <div className={`text-sm font-bold shrink-0 ${tx.type === 'IN' ? 'text-brand-success' : 'text-brand-danger'}`}>
                                    {tx.type === 'IN' ? '+' : '-'}{parseInt(tx.amount).toLocaleString('vi-VN')}đ
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Warning */}
            <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-brand-warning shrink-0 mt-0.5" />
                <div>
                    <div className="text-sm font-medium text-brand-warning">Lưu ý bảo mật</div>
                    <div className="text-xs text-brand-text-muted mt-0.5">
                        Các thông tin nhạy cảm (API key, password, token, cookie) chỉ hiển thị trên giao diện Admin.
                        Cookie & Session ID cần được cập nhật định kỳ khi hết hạn.
                        Khi thay đổi, hệ thống sẽ ghi đè file config gốc tại <code className="text-brand-primary">MY_BOT/mbbank-main/config/config.json</code>.
                    </div>
                </div>
            </div>

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 flex items-center gap-2 animate-slide-up">
                    <CheckCircle2 className="w-5 h-5 text-brand-success" /><span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
