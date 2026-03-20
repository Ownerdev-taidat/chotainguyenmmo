'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { User, Mail, Lock, AtSign, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        fullName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!agreed) {
            setError('Bạn phải đồng ý với điều khoản sử dụng để đăng ký tài khoản.');
            return;
        }

        if (!form.fullName || !form.username || !form.email || !form.password) {
            setError('Vui lòng điền đầy đủ thông tin.');
            return;
        }

        if (!/^[a-zA-Z0-9_.]{3,30}$/.test(form.username)) {
            setError('Tên đăng nhập chỉ chứa chữ, số, dấu chấm và gạch dưới (3–30 ký tự).');
            return;
        }

        if (form.password.length < 8) {
            setError('Mật khẩu phải có ít nhất 8 ký tự.');
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: form.fullName,
                    username: form.username,
                    email: form.email,
                    password: form.password,
                    termsAccepted: true,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.message || 'Đăng ký thất bại. Vui lòng thử lại.');
                setLoading(false);
                return;
            }

            // Save to auth context
            if (data.data?.token) {
                login(data.data.token, data.data.user);
            }

            setSuccess('🎉 Tạo tài khoản thành công! Đang chuyển hướng...');
            setTimeout(() => {
                router.push('/');
            }, 1500);
        } catch {
            setError('Không thể kết nối đến server. Vui lòng kiểm tra lại.');
            setLoading(false);
        }
    };

    return (
        <>
            <Header />
            <main className="min-h-screen flex items-center justify-center py-6 md:py-12 pt-24 md:pt-12">
                <div className="max-w-md mx-auto w-full px-4">
                    <div className="card !p-5 md:!p-8">
                        <div className="flex items-center gap-2 mb-6 justify-center">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                <span className="text-white font-bold text-sm">CT</span>
                            </div>
                            <span className="text-lg font-bold text-brand-text-primary">ChoTaiNguyen</span>
                        </div>

                        <h1 className="text-xl font-bold text-brand-text-primary mb-2 text-center">Tạo tài khoản mới</h1>
                        <p className="text-sm text-brand-text-secondary mb-8 text-center">
                            Bắt đầu sử dụng ChoTaiNguyen để tìm kiếm, mua bán và quản lý tài nguyên số trên một nền tảng duy nhất.
                        </p>

                        {error && (
                            <div className="flex items-center gap-2 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-sm rounded-xl px-4 py-3 mb-5">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="flex items-center gap-2 bg-brand-success/10 border border-brand-success/20 text-brand-success text-sm rounded-xl px-4 py-3 mb-5">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                {success}
                            </div>
                        )}

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">Họ và tên</label>
                                <div className="relative">
                                    <User className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="text" name="fullName" value={form.fullName} onChange={handleChange} placeholder="Nhập họ và tên" className="input-field !pl-11" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">
                                    Tên đăng nhập <span className="text-brand-danger">*</span>
                                </label>
                                <div className="relative">
                                    <AtSign className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="text" name="username" value={form.username} onChange={handleChange} placeholder="Nhập tên đăng nhập (VD: nguyenvana)" className="input-field !pl-11" required minLength={3} maxLength={30} />
                                </div>
                                <p className="text-xs text-brand-text-muted mt-1.5">Chỉ chứa chữ cái, số, dấu chấm (.) và dấu gạch dưới (_). Dùng để đăng nhập.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">Email</label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Nhập email của bạn" className="input-field !pl-11" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">Mật khẩu</label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Nhập mật khẩu (tối thiểu 8 ký tự)" className="input-field !pl-11" required minLength={8} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">Xác nhận mật khẩu</label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Nhập lại mật khẩu" className="input-field !pl-11" required />
                                </div>
                            </div>

                            {/* Required agreement checkboxes */}
                            <div className="space-y-3 bg-brand-surface-2 border border-brand-border rounded-xl p-4">
                                <label className="flex items-start gap-2.5 text-sm text-brand-text-secondary cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={agreed}
                                        onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setError(''); }}
                                        className="rounded border-brand-border bg-brand-surface mt-0.5 w-4 h-4 accent-brand-primary shrink-0"
                                    />
                                    <span>
                                        Tôi đã đọc và đồng ý với{' '}
                                        <Link href="/chinh-sach" className="text-brand-primary hover:underline font-medium">Điều khoản sử dụng</Link>,{' '}
                                        <Link href="/chinh-sach" className="text-brand-primary hover:underline font-medium">Chính sách giao dịch</Link> và{' '}
                                        <Link href="/chinh-sach" className="text-brand-primary hover:underline font-medium">Chính sách bảo mật</Link> của ChoTaiNguyen.
                                    </span>
                                </label>
                                <label className="flex items-start gap-2.5 text-sm text-brand-text-secondary cursor-pointer">
                                    <input
                                        type="checkbox"
                                        required
                                        className="rounded border-brand-border bg-brand-surface mt-0.5 w-4 h-4 accent-brand-primary shrink-0"
                                    />
                                    <span>
                                        Tôi xác nhận mọi thông tin tôi cung cấp là đúng sự thật và tôi chịu trách nhiệm đối với hoạt động sử dụng tài khoản của mình.
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={!agreed || loading}
                                className={`btn-primary w-full !py-3.5 flex items-center justify-center gap-2 ${(!agreed || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {loading ? 'Đang xử lý...' : 'Đăng ký'}
                            </button>
                        </form>

                        <p className="text-center text-sm text-brand-text-muted mt-6">
                            Đã có tài khoản?{' '}
                            <Link href="/dang-nhap" className="text-brand-primary font-medium hover:underline">
                                Đăng nhập
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
