'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Lock, ArrowRight, Eye, EyeOff, AtSign, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState({ username: '', password: '' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!form.username || !form.password) {
            setError('Vui lòng nhập tên đăng nhập và mật khẩu.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.message || 'Đăng nhập thất bại.');
                setLoading(false);
                return;
            }

            // Save to auth context (updates Header immediately)
            if (data.data?.token) {
                login(data.data.token, data.data.user);
            }

            setSuccess('✅ Đăng nhập thành công! Đang chuyển hướng...');

            // Check for redirect param first
            const params = new URLSearchParams(window.location.search);
            const redirectTo = params.get('redirect');

            // Redirect based on role or redirect param
            const role = data.data?.user?.role;
            setTimeout(() => {
                if (redirectTo) {
                    router.push(redirectTo);
                } else if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
                    router.push('/admin');
                } else {
                    router.push('/');
                }
            }, 1000);
        } catch {
            setError('Không thể kết nối đến server.');
            setLoading(false);
        }
    };

    return (
        <>
            <Header />
            <main className="min-h-screen flex items-center justify-center py-6 md:py-12 pt-24 md:pt-12">
                <div className="max-w-container mx-auto px-4 w-full">
                    <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center max-w-5xl mx-auto">
                        {/* Left - Brand */}
                        <div className="hidden lg:block">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                    <span className="text-white font-bold text-lg">CT</span>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold text-brand-text-primary">ChoTaiNguyen</div>
                                    <div className="text-sm text-brand-text-muted">Chợ Tài Nguyên</div>
                                </div>
                            </div>
                            <h2 className="text-3xl font-bold text-brand-text-primary mb-4">
                                Chợ tài nguyên số,<br />
                                <span className="gradient-text">giao dịch nhanh và an toàn</span>
                            </h2>
                            <p className="text-brand-text-secondary leading-relaxed mb-8">
                                Mua bán tài nguyên số tự động, minh bạch, tiện lợi. Quản lý ví, đơn hàng và giao dịch trên một nền tảng duy nhất.
                            </p>
                            <div className="space-y-3">
                                {['Giao dịch nhanh, nhận hàng tự động', 'Ví nội bộ quản lý chi tiêu', 'Hệ thống minh bạch, dễ theo dõi'].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm text-brand-text-secondary">
                                        <div className="w-6 h-6 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
                                            <ArrowRight className="w-3 h-3 text-brand-primary" />
                                        </div>
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right - Form */}
                        <div className="card !p-5 md:!p-8 max-w-md mx-auto w-full lg:max-w-none">
                            <div className="lg:hidden flex items-center gap-2 mb-6 justify-center">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">CT</span>
                                </div>
                                <span className="text-lg font-bold text-brand-text-primary">ChoTaiNguyen</span>
                            </div>

                            <h1 className="text-xl font-bold text-brand-text-primary mb-2">Chào mừng quay lại</h1>
                            <p className="text-sm text-brand-text-secondary mb-8">
                                Đăng nhập để quản lý ví, đơn hàng, thông báo và toàn bộ hoạt động trên hệ thống.
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
                                    <label className="block text-sm font-medium text-brand-text-primary mb-2">Tên đăng nhập</label>
                                    <div className="relative">
                                        <AtSign className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                        <input type="text" name="username" value={form.username} onChange={handleChange} placeholder="Nhập tên đăng nhập của bạn" className="input-field !pl-11" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-primary mb-2">Mật khẩu</label>
                                    <div className="relative">
                                        <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                        <input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="Nhập mật khẩu" className="input-field !pl-11 !pr-11" required />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text-primary">
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <label className="flex items-center gap-2 text-sm text-brand-text-secondary cursor-pointer">
                                        <input type="checkbox" className="rounded border-brand-border bg-brand-surface-2" />
                                        Ghi nhớ đăng nhập
                                    </label>
                                    <Link href="/quen-mat-khau" className="text-sm text-brand-primary hover:underline">
                                        Quên mật khẩu?
                                    </Link>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`btn-primary w-full !py-3.5 flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {loading ? 'Đang xử lý...' : 'Đăng nhập'}
                                </button>
                            </form>


                            <p className="text-center text-sm text-brand-text-muted mt-4">
                                Chưa có tài khoản?{' '}
                                <Link href="/dang-ky" className="text-brand-primary font-medium hover:underline">
                                    Đăng ký ngay
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
