'use client';

import { useState, useEffect } from 'react';
import { Save, Globe, Shield, Percent, UserCheck, AlertTriangle, Store, CheckCircle, Loader2, DollarSign, CreditCard } from 'lucide-react';

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
    const [fees, setFees] = useState<PlatformFees>({ commissionRate: '5', withdrawalFee: '15000', minWithdraw: '500000', minDeposit: '10000', bankName: 'MB Bank', bankAccount: '0393959643', bankOwner: 'NGUYEN TAI DAT' });
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [saving, setSaving] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

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

            {/* Platform Earnings Stats */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="card !p-4 border-l-4 border-brand-primary">
                        <div className="text-xs text-brand-text-muted">Phí sàn hiện tại</div>
                        <div className="text-2xl font-bold text-brand-primary">{stats.commissionRate}%</div>
                    </div>
                    <div className="card !p-4 border-l-4 border-brand-success">
                        <div className="text-xs text-brand-text-muted">💰 Sàn đã thu</div>
                        <div className="text-lg font-bold text-brand-success">{fmt(stats.totalPlatformFees)}</div>
                    </div>
                    <div className="card !p-4 border-l-4 border-brand-info">
                        <div className="text-xs text-brand-text-muted">Tổng doanh thu</div>
                        <div className="text-lg font-bold text-brand-info">{fmt(stats.totalRevenue)}</div>
                    </div>
                    <div className="card !p-4 border-l-4 border-brand-warning">
                        <div className="text-xs text-brand-text-muted">Seller nhận</div>
                        <div className="text-lg font-bold text-brand-warning">{fmt(stats.totalSellerEarnings)}</div>
                    </div>
                </div>
            )}

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
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Email hỗ trợ</label>
                        <input type="email" value={general.email} onChange={e => setGeneral({ ...general, email: e.target.value })} className="input-field" />
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
