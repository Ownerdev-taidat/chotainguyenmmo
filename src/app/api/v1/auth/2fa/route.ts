export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// TOTP implementation without external deps
function generateSecret(): string {
    const bytes = crypto.randomBytes(20);
    return base32Encode(bytes);
}

function base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0, value = 0, output = '';
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
    return output;
}

function base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanInput = encoded.replace(/=+$/, '').toUpperCase();
    let bits = 0, value = 0;
    const output: number[] = [];
    for (const char of cleanInput) {
        const idx = alphabet.indexOf(char);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(output);
}

function verifyTOTP(secret: string, token: string): boolean {
    for (let i = -1; i <= 1; i++) {
        const time = Math.floor(Date.now() / 1000 / 30) + i;
        const timeBuffer = Buffer.alloc(8);
        timeBuffer.writeUInt32BE(0, 0);
        timeBuffer.writeUInt32BE(time, 4);
        const key = base32Decode(secret);
        const hmac = crypto.createHmac('sha1', key).update(timeBuffer).digest();
        const offset = hmac[hmac.length - 1] & 0xf;
        const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
        const otp = (code % 1000000).toString().padStart(6, '0');
        if (otp === token) return true;
    }
    return false;
}

// POST /api/v1/auth/2fa
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { action, token } = await request.json();
        const user = await prisma.user.findUnique({ where: { id: authResult.userId } });
        if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

        if (action === 'setup') {
            const secret = generateSecret();
            await prisma.user.update({
                where: { id: authResult.userId },
                data: { twoFactorSecret: secret },
            });
            const otpauthUrl = `otpauth://totp/ChoTaiNguyen:${user.email}?secret=${secret}&issuer=ChoTaiNguyen&algorithm=SHA1&digits=6&period=30`;
            return NextResponse.json({ success: true, data: { secret, otpauthUrl } });
        }

        if (action === 'verify') {
            if (!user.twoFactorSecret) return NextResponse.json({ success: false, message: 'Chưa thiết lập 2FA' }, { status: 400 });
            if (!token || token.length !== 6) return NextResponse.json({ success: false, message: 'Mã OTP phải 6 chữ số' }, { status: 400 });
            if (!verifyTOTP(user.twoFactorSecret, token)) return NextResponse.json({ success: false, message: 'Mã OTP không chính xác' }, { status: 400 });
            await prisma.user.update({
                where: { id: authResult.userId },
                data: { twoFactorEnabled: true },
            });
            return NextResponse.json({ success: true, message: '✅ Đã bật xác thực 2FA thành công!' });
        }

        if (action === 'disable') {
            if (!user.twoFactorEnabled) return NextResponse.json({ success: false, message: '2FA chưa được bật' }, { status: 400 });
            if (token && user.twoFactorSecret) {
                if (!verifyTOTP(user.twoFactorSecret, token)) return NextResponse.json({ success: false, message: 'Mã OTP không chính xác' }, { status: 400 });
            }
            await prisma.user.update({
                where: { id: authResult.userId },
                data: { twoFactorEnabled: false, twoFactorSecret: null },
            });
            return NextResponse.json({ success: true, message: '✅ Đã tắt xác thực 2FA' });
        }

        if (action === 'status') {
            return NextResponse.json({ success: true, data: { enabled: user.twoFactorEnabled } });
        }

        return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('2FA error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
