export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, generateDepositToken } from '@/lib/auth';
import { generateQRUrl } from '@/lib/mbbank';

const MBBANK_ACCOUNT = process.env.MBBANK_ACCOUNT || '';
const MBBANK_NAME = process.env.MBBANK_NAME || 'MB Bank';
const MBBANK_OWNER = process.env.MBBANK_OWNER_NAME || 'NGUYEN TAI DAT';
const DEPOSIT_EXPIRY_MINUTES = parseInt(process.env.DEPOSIT_EXPIRY_MINUTES || '15');
const MIN_DEPOSIT = parseInt(process.env.MIN_DEPOSIT_AMOUNT || '2000');

// POST /api/v1/wallet/deposits — Request a new deposit
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { amount } = await request.json();

        if (!amount || amount < MIN_DEPOSIT || amount > 100000000) {
            return NextResponse.json(
                { success: false, message: `Số tiền phải từ ${MIN_DEPOSIT.toLocaleString()}đ đến 100,000,000đ`, errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Auto-ensure user exists (handles fresh DB)
        const userEmail = (authResult as any).email || `${authResult.userId}@chotainguyen.com`;
        const userName = userEmail.split('@')[0] || authResult.userId;
        await prisma.user.upsert({
            where: { id: authResult.userId },
            update: {},
            create: {
                id: authResult.userId,
                email: userEmail,
                username: userName,
                fullName: userName,
                passwordHash: 'migrated',
                role: (authResult as any).role || 'USER',
            },
        });

        const token = generateDepositToken();
        const transferContent = `CTN${token}`;
        const expiresAt = new Date(Date.now() + DEPOSIT_EXPIRY_MINUTES * 60000);
        const qrUrl = generateQRUrl(MBBANK_ACCOUNT, amount, transferContent);

        const deposit = await prisma.deposit.create({
            data: {
                userId: authResult.userId,
                amount,
                method: 'bank_transfer',
                status: 'PENDING',
                referenceCode: token,
                transferContent,
                qrUrl,
                expiresAt,
            },
        });

        return NextResponse.json({
            success: true,
            message: `Chuyển khoản đúng số tiền và nội dung trong vòng ${DEPOSIT_EXPIRY_MINUTES} phút`,
            data: {
                depositId: deposit.id,
                token,
                amount,
                qrUrl,
                bankName: MBBANK_NAME,
                bankAccount: MBBANK_ACCOUNT,
                bankOwner: MBBANK_OWNER,
                transferContent,
                expiresAt,
            },
        });
    } catch (error) {
        console.error('Create deposit error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

// GET /api/v1/wallet/deposits — List user deposits
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const deposits = await prisma.deposit.findMany({
            where: { userId: authResult.userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        return NextResponse.json({ success: true, data: deposits });
    } catch (error) {
        console.error('List deposits error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
