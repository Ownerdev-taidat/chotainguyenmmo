import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'crypto';

// ⚠️ BẮT BUỘC set JWT_SECRET trong .env — không có fallback
const jwtSecretStr = process.env.JWT_SECRET;
if (!jwtSecretStr && process.env.NODE_ENV === 'production') {
    throw new Error('[SECURITY] JWT_SECRET chưa được cấu hình trong .env!');
}
const JWT_SECRET = new TextEncoder().encode(
    jwtSecretStr || 'dev-only-secret-DO-NOT-USE-IN-PRODUCTION'
);

// Hash password using SHA-256 (use bcrypt in production)
export function hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
    return hashPassword(password) === hash;
}

// JWT
export async function signToken(payload: Record<string, unknown>, expiresIn = '7d') {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch {
        return null;
    }
}

// Get current user from request
export async function getCurrentUser(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') ||
        request.cookies.get('token')?.value;

    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    return payload as { userId: string; email: string; role: string };
}

// Auth middleware for API routes
export async function requireAuth(request: NextRequest) {
    const user = await getCurrentUser(request);
    if (!user) {
        return NextResponse.json(
            { success: false, message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', errorCode: 'UNAUTHORIZED' },
            { status: 401 }
        );
    }
    return user;
}

export async function requireRole(request: NextRequest, roles: string[]) {
    const user = await getCurrentUser(request);
    if (!user) {
        return NextResponse.json(
            { success: false, message: 'Chưa đăng nhập', errorCode: 'UNAUTHORIZED' },
            { status: 401 }
        );
    }
    if (!roles.includes(user.role)) {
        return NextResponse.json(
            { success: false, message: 'Không có quyền truy cập', errorCode: 'FORBIDDEN' },
            { status: 403 }
        );
    }
    return user;
}

// Generate unique codes
export function generateOrderCode(): string {
    const date = new Date();
    const d = `${date.getFullYear().toString().slice(2)}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `CTN-${d}-${rand}`;
}

export function generateComplaintCode(): string {
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `KN-${rand}`;
}

export function generateDepositToken(): string {
    return randomBytes(4).toString('hex').toUpperCase().slice(0, 7);
}
