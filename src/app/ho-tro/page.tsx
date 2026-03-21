'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Phone, MessageSquare, Clock, HelpCircle, ChevronDown, Send } from 'lucide-react';

const faqs = [
    { q: 'Sản phẩm được giao như thế nào?', a: 'Sau khi thanh toán, sản phẩm số được giao tự động qua hệ thống. Bạn có thể xem thông tin sản phẩm trong mục Đơn hàng.' },
    { q: 'Tôi có thể hoàn tiền không?', a: 'Có. Nếu sản phẩm không đúng mô tả hoặc không hoạt động, bạn có thể tạo khiếu nại trong vòng 24-48 giờ để được hoàn tiền.' },
    { q: 'Nạp tiền mất bao lâu?', a: 'MoMo và VNPay: ngay lập tức. Chuyển khoản ngân hàng: 1-5 phút (giờ hành chính) hoặc tối đa 24 giờ.' },
    { q: 'Làm sao để trở thành seller?', a: 'Đăng ký tài khoản → Vào trang "Đăng ký bán hàng" → Điền thông tin shop → Chờ admin duyệt (1-2 ngày).' },
    { q: 'Phí giao dịch trên sàn là bao nhiêu?', a: 'Người mua: 0% phí (không mất phí khi mua hàng). Người bán (Seller): Sàn thu phí trên doanh thu mỗi đơn hàng thành công (mặc định 5%, admin có thể điều chỉnh). Phí rút tiền: 15.000đ/lần (cố định, chỉ thu seller).' },
    { q: 'Tài khoản bị khóa thì sao?', a: 'Liên hệ support qua Telegram hoặc hotline để được hỗ trợ giải quyết. Cung cấp thông tin tài khoản khi liên hệ.' },
];

export default function SupportPage() {
    const [hotline, setHotline] = useState('1900 6868');
    const [telegramAdmins, setTelegramAdmins] = useState<{ name: string; link: string }[]>([]);
    const [showTelegramPopup, setShowTelegramPopup] = useState(false);

    useEffect(() => {
        fetch('/api/v1/admin/settings')
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    const s = data.data.settings;
                    if (s.hotline) setHotline(s.hotline);
                    if (s.telegramAdmins && Array.isArray(s.telegramAdmins)) {
                        setTelegramAdmins(s.telegramAdmins.filter((a: any) => a.link));
                    } else if (s.telegramSupport) {
                        setTelegramAdmins([{ name: 'Admin 1', link: s.telegramSupport }]);
                    }
                }
            })
            .catch(() => {});
    }, []);

    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg py-12">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h1 className="text-3xl font-bold text-brand-text-primary mb-2">Trung tâm hỗ trợ</h1>
                        <p className="text-brand-text-secondary">Chúng tôi luôn sẵn sàng hỗ trợ bạn. Liên hệ qua các kênh bên dưới.</p>
                    </div>

                    {/* Contact Cards — Telegram + Hotline + Live Chat */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                        {/* Telegram Card — FIRST (primary support channel) */}
                        <div className="relative">
                            <button
                                onClick={() => setShowTelegramPopup(!showTelegramPopup)}
                                className="card-hover text-center w-full cursor-pointer"
                            >
                                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                                    <Send className="w-7 h-7 text-blue-500" />
                                </div>
                                <h3 className="text-base font-semibold text-brand-text-primary">Telegram</h3>
                                <p className="text-sm text-blue-500 font-medium mt-1">Hỗ trợ 24/7</p>
                                <p className="text-xs text-brand-text-muted mt-1">
                                    {telegramAdmins.length > 0 ? `${telegramAdmins.length} admin online` : 'Liên hệ nhanh'}
                                </p>
                            </button>

                            {/* Popup danh sách admin Telegram */}
                            {showTelegramPopup && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowTelegramPopup(false)} />
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-72 bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="px-4 py-3 border-b border-brand-border bg-brand-surface-2/50">
                                            <h4 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                                                <Send className="w-4 h-4 text-blue-500" />
                                                Admin Telegram
                                            </h4>
                                        </div>
                                        <div className="p-2 max-h-64 overflow-y-auto">
                                            {telegramAdmins.length > 0 ? (
                                                telegramAdmins.map((admin, i) => {
                                                    // Ensure link always has full https://t.me/ URL
                                                    const teleLink = admin.link.startsWith('http')
                                                        ? admin.link
                                                        : admin.link.startsWith('@')
                                                            ? `https://t.me/${admin.link.slice(1)}`
                                                            : `https://t.me/${admin.link}`;
                                                    const username = teleLink.replace('https://t.me/', '@');
                                                    return (
                                                        <a
                                                            key={i}
                                                            href={teleLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-surface-2 transition-colors group"
                                                        >
                                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                                                                <Send className="w-4 h-4 text-white" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-semibold text-brand-text-primary truncate group-hover:text-blue-500 transition-colors">
                                                                    {admin.name}
                                                                </div>
                                                                <div className="text-xs text-brand-text-muted truncate">
                                                                    {username}
                                                                </div>
                                                            </div>
                                                            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" title="Online" />
                                                        </a>
                                                    );
                                                })
                                            ) : (
                                                <div className="text-center py-4">
                                                    <p className="text-sm text-brand-text-muted">Đang cập nhật...</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <a href={`tel:${hotline.replace(/\s/g, '')}`} className="card-hover text-center block">
                            <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
                                <Phone className="w-7 h-7 text-brand-primary" />
                            </div>
                            <h3 className="text-base font-semibold text-brand-text-primary">Hotline</h3>
                            <p className="text-sm text-brand-primary font-medium mt-1">{hotline}</p>
                            <p className="text-xs text-brand-text-muted mt-1">Thứ 2-7, 8:00-22:00</p>
                        </a>
                        <a href="/dashboard/tin-nhan" className="card-hover text-center block">
                            <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-7 h-7 text-brand-primary" />
                            </div>
                            <h3 className="text-base font-semibold text-brand-text-primary">Live Chat</h3>
                            <p className="text-sm text-brand-primary font-medium mt-1">Chat trực tuyến</p>
                            <p className="text-xs text-brand-text-muted mt-1">Hỗ trợ ngay lập tức</p>
                        </a>
                    </div>

                    {/* FAQ */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <HelpCircle className="w-5 h-5 text-brand-primary" />
                            <h2 className="text-xl font-bold text-brand-text-primary">Câu hỏi thường gặp</h2>
                        </div>
                        <div className="space-y-3">
                            {faqs.map((faq, i) => (
                                <details key={i} className="card group cursor-pointer">
                                    <summary className="flex items-center justify-between text-sm font-semibold text-brand-text-primary list-none">
                                        {faq.q}
                                        <ChevronDown className="w-4 h-4 text-brand-text-muted group-open:rotate-180 transition-transform shrink-0" />
                                    </summary>
                                    <p className="text-sm text-brand-text-secondary mt-3 pt-3 border-t border-brand-border/50">{faq.a}</p>
                                </details>
                            ))}
                        </div>
                    </div>

                    {/* Working Hours */}
                    <div className="card mt-8 bg-brand-surface-2/30 border-dashed">
                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-brand-text-primary mb-1">Giờ làm việc</h3>
                                <p className="text-xs text-brand-text-secondary">Thứ 2 - Thứ 7: 08:00 - 22:00 (GMT+7). Chủ nhật &amp; lễ: 09:00 - 18:00.</p>
                                <p className="text-xs text-brand-text-muted mt-1">Hệ thống giao dịch tự động hoạt động 24/7.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
