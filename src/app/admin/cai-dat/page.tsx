'use client';

import { useState, useEffect } from 'react';
import { Save, Globe, Shield, Percent, UserCheck, AlertTriangle, Store, CheckCircle, Loader2, DollarSign, CreditCard, Send, Plus, Trash2 } from 'lucide-react';
import { useUI } from '@/components/shared/UIProvider';

interface Settings {
    kycRequired: boolean;
    autoApprove: boolean;
    autoApproveWhenKycOff: boolean;
}

interface PlatformFees {
    commissionRate: string;
    withdrawalFee: string;
    minWithdraw: string;
    minDeposit: string;
    bankName: string;
    bankAccount: string;
    bankOwner: string;
}

interface PlatformStats {
    totalOrders: number;
    totalRevenue: number;
    totalPlatformFees: number;
    totalSellerEarnings: number;
    pendingOrders: number;
    completedOrders: number;
    commissionRate: number;
}

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<Settings>({ kycRequired: false, autoApprove: false, autoApproveWhenKycOff: true });
    const [security, setSecurity] = useState({ emailVerification: true, manualProductApproval: false, withdrawalLimit: true });
    const [general, setGeneral] = useState({ name: 'ChoTaiNguyen', email: 'support@chotainguyen.vn', hotline: '1900 6868', status: 'active' });
    const [telegramAdmins, setTelegramAdmins] = useState<{ name: string; link: string }[]>([]);
    const [fees, setFees] = useState<PlatformFees>({ commissionRate: '5', withdrawalFee: '15000', minWithdraw: '500000', minDeposit: '2000', bankName: 'MB Bank', bankAccount: '0393959643', bankOwner: 'NGUYEN TAI DAT' });
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [saving, setSaving] = useState(false);
    const { showToast: globalToast, showConfirm } = useUI();

    const showToast = (msg: string) => { globalToast(msg.replace(/^[✅❌] */, ''), msg.startsWith('✅') ? 'success' : msg.startsWith('❌') ? 'error' : 'info'); };

    // Load KYC settings
    useEffect(() => {
        Promise.all([
            fetch('/api/v1/seller/register?view=settings').then(r => r.json()).catch(() => null),
            fetch('/api/v1/admin/settings').then(r => r.json()).catch(() => null),
        ]).then(([kycData, platformData]) => {
            if (kycData?.success) setSettings(kycData.data);
            if (platformData?.success) {
                const s = platformData.data.settings;
                setFees({
                    commissionRate: String(s.commissionRate),
                    withdrawalFee: String(s.withdrawalFee),
                    minWithdraw: String(s.minWithdraw),
                    minDeposit: String(s.minDeposit),
                    bankName: s.bankName || 'MB Bank',
                    bankAccount: s.bankAccount || '',
                    bankOwner: s.bankOwner || '',
                });
                if (s.hotline) {
                    setGeneral(prev => ({
                        ...prev,
                        hotline: s.hotline || prev.hotline,
                    }));
                }
                if (s.telegramAdmins && Array.isArray(s.telegramAdmins)) {
                    setTelegramAdmins(s.telegramAdmins);
                } else if (s.telegramSupport) {
                    // migrate old single-field to array
                    setTelegramAdmins([{ name: 'Admin 1', link: s.telegramSupport }]);
                }
                setStats(platformData.data.stats);
            }
        }).finally(() => setLoading(false));
    }, []);

    const updateSetting = async (key: string, value: boolean) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        try {
            await fetch('/api/v1/seller/register', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateSettings', [key]: value }),
            });
            showToast(`✅ Đã ${value ? 'bật' : 'tắt'} ${key === 'kycRequired' ? 'KYC' : key === 'autoApprove' ? 'auto duyệt' : 'auto duyệt (không KYC)'}`);
        } catch { showToast('❌ Lỗi cập nhật'); }
    };

    const toggleSecurity = (key: keyof typeof security) => {
        setSecurity(prev => {
            const newVal = !prev[key];
            showToast(`✅ Đã ${newVal ? 'bật' : 'tắt'} ${key === 'emailVerification' ? 'xác minh email' : key === 'manualProductApproval' ? 'duyệt SP thủ công' : 'giới hạn rút tiền'}`);
            return { ...prev, [key]: newVal };
        });
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/v1/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    commissionRate: Number(fees.commissionRate),
                    withdrawalFee: Number(fees.withdrawalFee),
                    minWithdraw: Number(fees.minWithdraw),
                    minDeposit: Number(fees.minDeposit),
                    bankName: fees.bankName,
                    bankAccount: fees.bankAccount,
                    bankOwner: fees.bankOwner,
                    hotline: general.hotline,
                    telegramAdmins: telegramAdmins,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ Đã lưu tất cả cài đặt — phí sàn, ngân hàng, giới hạn');
                // Reload stats
                const statsRes = await fetch('/api/v1/admin/settings');
                const statsData = await statsRes.json();
                if (statsData.success) setStats(statsData.data.stats);
            } else {
                showToast(`❌ ${data.message}`);
            }
        } catch {
            showToast('❌ Lỗi kết nối server');
        }
        setSaving(false);
    };

    const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Cài đặt hệ thống</h1>
                <p className="text-sm text-brand-text-muted">Cấu hình KYC, phí sàn (hoa hồng), ngân hàng nạp tiền, và thiết lập bảo mật.</p>
            </div>




            {/* KYC Toggle */}
            <div className="card border-2 border-brand-primary/20 space-y-5">
                <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-brand-primary" /> Quản lý KYC
                </h3>
                <div className="p-4 rounded-xl bg-brand-surface-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                                {settings.kycRequired ? <Shield className="w-4 h-4 text-brand-warning" /> : <Store className="w-4 h-4 text-brand-success" />}
                                Yêu cầu KYC (Xác minh danh tính)
                            </div>
                            <div className="text-xs text-brand-text-muted mt-0.5">
                                {settings.kycRequired
                                    ? '🔒 BẬT — Seller phải cung cấp CCCD, SĐT, họ tên.'
                                    : '🟢 TẮT — Seller chỉ cần tạo tên shop + TK ngân hàng.'}
                            </div>
                        </div>
                        <button onClick={() => updateSetting('kycRequired', !settings.kycRequired)}
                            className={`w-14 h-7 rounded-full cursor-pointer transition-all relative ${settings.kycRequired ? 'bg-brand-warning' : 'bg-brand-surface-3'}`}>
                            <div className={`bg-white rounded-full absolute top-[3px] shadow transition-all ${settings.kycRequired ? 'left-[30px]' : 'left-[3px]'}`}
                                style={{ width: '22px', height: '22px' }} />
                        </button>
                    </div>
                    {settings.kycRequired && (
                        <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-lg p-3 text-xs text-brand-text-secondary flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
                            <span><strong>Lưu ý:</strong> Khi bật KYC, tất cả gian hàng chưa hoàn tất KYC sẽ bị yêu cầu bổ sung.</span>
                        </div>
                    )}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-brand-surface-2/50">
                        <div>
                            <div className="text-xs font-medium text-brand-text-primary">Auto duyệt (khi KYC tắt)</div>
                            <div className="text-[10px] text-brand-text-muted">Tự động duyệt shop khi không yêu cầu KYC</div>
                        </div>
                        <button onClick={() => updateSetting('autoApproveWhenKycOff', !settings.autoApproveWhenKycOff)}
                            className={`w-11 h-6 rounded-full cursor-pointer transition-all ${settings.autoApproveWhenKycOff ? 'bg-brand-primary' : 'bg-brand-surface-3'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow transition-all ${settings.autoApproveWhenKycOff ? 'ml-[22px]' : 'ml-0.5'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-brand-surface-2/50">
                        <div>
                            <div className="text-xs font-medium text-brand-text-primary">Auto duyệt (khi KYC bật)</div>
                            <div className="text-[10px] text-brand-text-muted">Tự động duyệt cả khi có KYC</div>
                        </div>
                        <button onClick={() => updateSetting('autoApprove', !settings.autoApprove)}
                            className={`w-11 h-6 rounded-full cursor-pointer transition-all ${settings.autoApprove ? 'bg-brand-primary' : 'bg-brand-surface-3'}`}>
                            <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow transition-all ${settings.autoApprove ? 'ml-[22px]' : 'ml-0.5'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Commission & Fees */}
            <div className="card border-2 border-brand-success/20">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-brand-success" /> Hoa hồng & Phí sàn
                </h3>
                <div className="bg-brand-success/5 rounded-xl p-4 mb-5">
                    <div className="text-xs text-brand-text-muted mb-1">📌 <strong>Chỉ thu từ Seller</strong> — Khách mua hàng KHÔNG bị tính phí. Phí sàn trừ trực tiếp trên doanh thu đơn hàng của seller.</div>
                    <div className="text-xs text-brand-text-muted mb-1">Cách tính: Khách trả 100% giá → Sàn thu <strong>{fees.commissionRate}%</strong> trên doanh thu → Seller nhận <strong>{100 - Number(fees.commissionRate)}%</strong></div>
                    <div className="text-xs text-brand-text-muted">Ví dụ: Đơn 100.000đ → Sàn thu <strong>{(100000 * Number(fees.commissionRate) / 100).toLocaleString('vi-VN')}đ</strong> từ seller → Seller nhận <strong>{(100000 * (100 - Number(fees.commissionRate)) / 100).toLocaleString('vi-VN')}đ</strong></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Phí sàn trên doanh thu seller (%)</label>
                        <input type="number" value={fees.commissionRate} onChange={e => setFees({ ...fees, commissionRate: e.target.value })} className="input-field" min="0" max="50" step="0.5" />
                        <div className="text-[10px] text-brand-text-muted mt-1">Thu trên mỗi đơn hàng seller • 0% đến 50%</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Phí rút tiền seller (đ/lần)</label>
                        <input type="number" value={fees.withdrawalFee} onChange={e => setFees({ ...fees, withdrawalFee: e.target.value })} className="input-field" />
                        <div className="text-[10px] text-brand-text-muted mt-1">Cố định mỗi lần rút • Chỉ thu seller</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Rút tối thiểu (đ)</label>
                        <input type="number" value={fees.minWithdraw} onChange={e => setFees({ ...fees, minWithdraw: e.target.value })} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Nạp tối thiểu (đ)</label>
                        <input type="number" value={fees.minDeposit} onChange={e => setFees({ ...fees, minDeposit: e.target.value })} className="input-field" />
                    </div>
                </div>
            </div>

            {/* Tax Collection */}
            <TaxSettingsSection />

            {/* Bank Config for Deposits */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-brand-primary" /> Ngân hàng nhận nạp tiền
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Ngân hàng</label>
                        <input type="text" value={fees.bankName} onChange={e => setFees({ ...fees, bankName: e.target.value })} className="input-field" placeholder="MB Bank" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Số tài khoản</label>
                        <input type="text" value={fees.bankAccount} onChange={e => setFees({ ...fees, bankAccount: e.target.value })} className="input-field" placeholder="0965268536" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Chủ tài khoản</label>
                        <input type="text" value={fees.bankOwner} onChange={e => setFees({ ...fees, bankOwner: e.target.value })} className="input-field" placeholder="NGUYEN TAI DAT" />
                    </div>
                </div>
            </div>

            {/* General */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-brand-primary" /> Cài đặt chung
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Tên marketplace</label>
                        <input type="text" value={general.name} onChange={e => setGeneral({ ...general, name: e.target.value })} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Hotline</label>
                        <input type="tel" value={general.hotline} onChange={e => setGeneral({ ...general, hotline: e.target.value })} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Trạng thái</label>
                        <select value={general.status} onChange={e => setGeneral({ ...general, status: e.target.value })} className="input-field">
                            <option value="active">Hoạt động</option>
                            <option value="maintenance">Bảo trì</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Telegram Support Admins */}
            <div className="card border-2 border-blue-400/20">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                        <Send className="w-4 h-4 text-blue-500" /> Telegram hỗ trợ
                    </h3>
                    <button
                        onClick={() => setTelegramAdmins(prev => [...prev, { name: `Admin ${prev.length + 1}`, link: '' }])}
                        className="flex items-center gap-1.5 text-xs text-brand-primary font-medium hover:underline"
                    >
                        <Plus className="w-3.5 h-3.5" /> Thêm admin
                    </button>
                </div>
                <div className="text-xs text-brand-text-muted mb-4">
                    Quản lý danh sách admin hỗ trợ qua Telegram. Người dùng sẽ thấy danh sách này ở trang Hỗ trợ và chọn admin để liên hệ.
                </div>
                {telegramAdmins.length === 0 ? (
                    <div className="text-center py-6 text-sm text-brand-text-muted bg-brand-surface-2 rounded-xl">
                        Chưa có admin Telegram nào. Bấm &quot;Thêm admin&quot; để bắt đầu.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {telegramAdmins.map((admin, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-brand-surface-2/50 border border-brand-border/30">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-xs font-bold text-blue-500">{idx + 1}</span>
                                </div>
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] uppercase text-brand-text-muted font-medium mb-1">Tên hiển thị</label>
                                        <input
                                            type="text"
                                            value={admin.name}
                                            onChange={e => {
                                                const updated = [...telegramAdmins];
                                                updated[idx] = { ...updated[idx], name: e.target.value };
                                                setTelegramAdmins(updated);
                                            }}
                                            className="input-field !py-1.5 text-sm"
                                            placeholder="VD: Admin Hỗ trợ"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase text-brand-text-muted font-medium mb-1">Link Telegram</label>
                                        <input
                                            type="text"
                                            value={admin.link}
                                            onChange={e => {
                                                const updated = [...telegramAdmins];
                                                updated[idx] = { ...updated[idx], link: e.target.value };
                                                setTelegramAdmins(updated);
                                            }}
                                            className="input-field !py-1.5 text-sm"
                                            placeholder="https://t.me/username"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTelegramAdmins(prev => prev.filter((_, i) => i !== idx))}
                                    className="p-1.5 rounded-lg text-brand-danger/60 hover:text-brand-danger hover:bg-brand-danger/10 transition-all shrink-0 mt-0.5"
                                    title="Xóa admin"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Security */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-brand-primary" /> Bảo mật
                </h3>
                <div className="space-y-4">
                    {([
                        { key: 'emailVerification' as const, label: 'Yêu cầu xác minh email', desc: 'Người dùng phải xác minh email khi đăng ký' },
                        { key: 'manualProductApproval' as const, label: 'Duyệt sản phẩm thủ công', desc: 'Sản phẩm mới cần admin duyệt trước khi hiển thị' },
                        { key: 'withdrawalLimit' as const, label: 'Giới hạn rút tiền', desc: 'Giới hạn số lần rút tiền mỗi ngày' },
                    ]).map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-brand-surface-2/50">
                            <div>
                                <div className="text-sm font-medium text-brand-text-primary">{item.label}</div>
                                <div className="text-xs text-brand-text-muted">{item.desc}</div>
                            </div>
                            <button onClick={() => toggleSecurity(item.key)}
                                className={`w-11 h-6 rounded-full cursor-pointer transition-all ${security[item.key] ? 'bg-brand-primary' : 'bg-brand-surface-3'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow transition-all ${security[item.key] ? 'ml-[22px]' : 'ml-0.5'}`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <button onClick={handleSaveAll} disabled={saving} className="btn-primary flex items-center gap-2 !px-8">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Đang lưu...' : 'Lưu tất cả cài đặt'}
                </button>
            </div>

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up">
                    <span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}

// ======== Tax Settings Component ========
interface TaxBracket { minRevenue: number; rate: number; label: string; }

function TaxSettingsSection() {
    const { showConfirm } = useUI();
    const [taxSettings, setTaxSettings] = useState<{
        enabled: boolean; taxRate: number; paymentDay: number;
        lastCollectionDate: string | null; taxBrackets: TaxBracket[];
    }>({
        enabled: false, taxRate: 1, paymentDay: 25, lastCollectionDate: null,
        taxBrackets: [
            { minRevenue: 0, rate: 0, label: 'Dưới 100 triệu' },
            { minRevenue: 100000000, rate: 5, label: '100 triệu - 500 triệu' },
            { minRevenue: 500000000, rate: 10, label: '500 triệu - 1 tỷ' },
            { minRevenue: 1000000000, rate: 15, label: 'Trên 1 tỷ' },
        ],
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [collecting, setCollecting] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetch('/api/v1/admin/tax').then(r => r.json()).then(d => {
            if (d.success) setTaxSettings(prev => ({ ...prev, ...d.data }));
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save tax-specific settings
            const res = await fetch('/api/v1/admin/tax', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taxSettings),
            });
            const data = await res.json();

            // Also sync taxEnabled + vatRate to platform settings (used by invoice APIs)
            await fetch('/api/v1/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taxEnabled: taxSettings.enabled,
                    vatRate: taxSettings.taxRate || 10,
                }),
            });

            setMessage(data.success ? '✅ Đã lưu cài đặt thuế' : '❌ ' + data.message);
        } catch { setMessage('❌ Lỗi kết nối'); }
        setSaving(false);
        setTimeout(() => setMessage(''), 3000);
    };

    const handleCollect = async () => {
        showConfirm({
            title: 'Thu thuế',
            message: 'Xác nhận thu thuế tháng này từ tất cả seller?',
            confirmText: 'Thu thuế',
            variant: 'warning',
            onConfirm: async () => {
                setCollecting(true);
                try {
                    const res = await fetch('/api/v1/admin/tax', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({}),
                    });
                    const data = await res.json();
                    setMessage(data.success ? `✅ ${data.message}` : '❌ ' + data.message);
                    if (data.success) {
                        setTaxSettings(prev => ({ ...prev, lastCollectionDate: new Date().toISOString() }));
                    }
                } catch { setMessage('❌ Lỗi kết nối'); }
                setCollecting(false);
                setTimeout(() => setMessage(''), 5000);
            }
        });
    };

    const updateBracket = (idx: number, field: keyof TaxBracket, value: string | number) => {
        setTaxSettings(prev => {
            const brackets = [...prev.taxBrackets];
            brackets[idx] = { ...brackets[idx], [field]: field === 'label' ? value : Number(value) };
            return { ...prev, taxBrackets: brackets };
        });
    };

    const addBracket = () => {
        setTaxSettings(prev => ({
            ...prev,
            taxBrackets: [...prev.taxBrackets, { minRevenue: 0, rate: 0, label: 'Mốc mới' }],
        }));
    };

    const removeBracket = (idx: number) => {
        setTaxSettings(prev => ({
            ...prev,
            taxBrackets: prev.taxBrackets.filter((_, i) => i !== idx),
        }));
    };

    const fmtVND = (n: number) => n >= 1000000000 ? `${(n / 1000000000).toFixed(1)} tỷ` : n >= 1000000 ? `${(n / 1000000).toFixed(0)} triệu` : n.toLocaleString('vi-VN') + 'đ';

    if (loading) return null;

    return (
        <div className="card border-2 border-brand-warning/20">
            <h3 className="text-sm font-semibold text-brand-text-primary mb-4 flex items-center gap-2">
                📋 Thu thuế Seller
            </h3>
            <div className="bg-brand-warning/5 rounded-xl p-4 mb-4">
                <div className="text-xs text-brand-text-muted">Thu thuế trên doanh thu bán hàng của seller theo tháng. Tiền sẽ bị trừ thẳng từ ví seller — nếu không đủ sẽ trừ <strong>âm</strong> và bù lại khi có tiền. Thuế suất tính theo <strong>mốc doanh thu lũy tiến</strong> bên dưới.</div>
            </div>

            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-brand-text-primary">Bật thu thuế</span>
                    {taxSettings.enabled ? (
                        <span className="badge badge-success text-[10px]">ĐANG BẬT</span>
                    ) : (
                        <span className="badge badge-neutral text-[10px]">ĐANG TẮT</span>
                    )}
                </div>
                <button
                    onClick={() => setTaxSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                    className={`w-12 h-6 rounded-full transition-colors relative ${taxSettings.enabled ? 'bg-brand-success' : 'bg-brand-text-muted/30'}`}
                >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${taxSettings.enabled ? 'left-6' : 'left-0.5'}`} />
                </button>
            </div>

            {/* Tax Brackets Editor */}
            <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-brand-text-primary">📊 Mốc doanh thu → Thuế suất</label>
                    <button onClick={addBracket} className="text-xs text-brand-primary hover:underline">+ Thêm mốc</button>
                </div>
                <div className="bg-brand-surface-2 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-brand-border/50 text-left">
                                <th className="px-3 py-2 text-[10px] uppercase text-brand-text-muted font-medium">Doanh thu từ (VNĐ)</th>
                                <th className="px-3 py-2 text-[10px] uppercase text-brand-text-muted font-medium">Thuế suất (%)</th>
                                <th className="px-3 py-2 text-[10px] uppercase text-brand-text-muted font-medium">Mô tả</th>
                                <th className="px-3 py-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {taxSettings.taxBrackets.sort((a, b) => a.minRevenue - b.minRevenue).map((bracket, idx) => (
                                <tr key={idx} className="border-b border-brand-border/20 hover:bg-brand-surface">
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            value={bracket.minRevenue}
                                            onChange={e => updateBracket(idx, 'minRevenue', e.target.value)}
                                            className="input-field !py-1 !px-2 text-xs w-full"
                                            min="0"
                                            step="1000000"
                                        />
                                        <div className="text-[10px] text-brand-text-muted mt-0.5">{fmtVND(bracket.minRevenue)}</div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            value={bracket.rate}
                                            onChange={e => updateBracket(idx, 'rate', e.target.value)}
                                            className="input-field !py-1 !px-2 text-xs w-20"
                                            min="0"
                                            max="50"
                                            step="0.5"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="text"
                                            value={bracket.label}
                                            onChange={e => updateBracket(idx, 'label', e.target.value)}
                                            className="input-field !py-1 !px-2 text-xs w-full"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <button onClick={() => removeBracket(idx)} className="text-brand-danger hover:text-brand-danger/80 text-xs">✕</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="text-[10px] text-brand-text-muted mt-2">Hệ thống sẽ áp dụng mốc cao nhất mà doanh thu seller đạt được. VD: DT 200 triệu → áp mốc &quot;100 triệu&quot; = thuế 5%.</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-brand-text-primary mb-1">Thuế mặc định (%)</label>
                    <input type="number" value={taxSettings.taxRate} onChange={e => setTaxSettings(prev => ({ ...prev, taxRate: Number(e.target.value) }))} className="input-field" min="0" max="30" step="0.5" />
                    <div className="text-[10px] text-brand-text-muted mt-1">Dùng khi không khớp mốc nào</div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-brand-text-primary mb-1">Ngày thu thuế</label>
                    <input type="number" value={taxSettings.paymentDay} onChange={e => setTaxSettings(prev => ({ ...prev, paymentDay: Number(e.target.value) }))} className="input-field" min="1" max="28" />
                    <div className="text-[10px] text-brand-text-muted mt-1">Ngày 1-28 hàng tháng</div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-brand-text-primary mb-1">Lần thu gần nhất</label>
                    <div className="input-field bg-brand-surface-2 text-brand-text-muted text-sm">
                        {taxSettings.lastCollectionDate ? new Date(taxSettings.lastCollectionDate).toLocaleDateString('vi-VN') : 'Chưa thu lần nào'}
                    </div>
                </div>
            </div>

            <div className="flex gap-3">
                <button onClick={handleSave} disabled={saving} className="btn-primary !py-2 !px-6 text-sm flex items-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Lưu cài đặt thuế
                </button>
                {taxSettings.enabled && (
                    <button onClick={handleCollect} disabled={collecting} className="btn-secondary !py-2 !px-6 text-sm flex items-center gap-2 border-brand-warning text-brand-warning hover:bg-brand-warning/10">
                        {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : '💰'}
                        {collecting ? 'Đang thu thuế...' : 'Thu thuế tháng này'}
                    </button>
                )}
            </div>

            {message && (
                <div className="mt-3 text-sm text-brand-text-primary bg-brand-surface-2 rounded-lg px-4 py-2">{message}</div>
            )}
        </div>
    );
}
