export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createUsdtDeposit, USDT_CONFIG, type UsdtNetwork } from '@/lib/usdt-payment';
import { getUsdtVndRate } from '@/lib/exchange-rate';

/**
 * POST /api/v1/wallet/usdt — Create USDT deposit
 * 
 * Body: { amount: number (USDT), network: 'TRC20' | 'BEP20' }
 * 
 * Returns: deposit info with address, QR, unique USDT amount, expiry
 */
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { amount, network } = await request.json();

        // ── Validate ──
        if (!amount || amount < 1 || amount > 10000) {
            return NextResponse.json(
                { success: false, message: 'Số USDT phải từ $1 đến $10,000' },
                { status: 400 }
            );
        }

        if (!network || !['TRC20', 'BEP20'].includes(network)) {
            return NextResponse.json(
                { success: false, message: 'Mạng không hợp lệ. Chọn TRC20 hoặc BEP20.' },
                { status: 400 }
            );
        }

        // ── Rate limit: max 3 USDT deposits per hour ──
        const oneHourAgo = new Date(Date.now() - 3600000);
        const recentCount = await prisma.deposit.count({
            where: {
                userId: authResult.userId,
                method: 'USDT',
                createdAt: { gte: oneHourAgo },
            },
        });
        if (recentCount >= 50) {
            return NextResponse.json(
                { success: false, message: 'Bạn đã tạo quá nhiều yêu cầu USDT. Thử lại sau 1 giờ.' },
                { status: 429 }
            );
        }

        // ── Create deposit ──
        // amount is now USDT, convert to VND using live rate
        const { rate: usdtVndRate } = await getUsdtVndRate();
        const amountVnd = Math.round(amount * usdtVndRate);
        const result = await createUsdtDeposit(
            authResult.userId,
            amountVnd,
            network as UsdtNetwork,
        );

        const config = USDT_CONFIG[network as UsdtNetwork];

        return NextResponse.json({
            success: true,
            data: {
                depositId: result.depositId,
                network: result.network,
                networkLabel: config.label,
                chainName: config.chainName,
                receivingAddress: result.receivingAddress,
                qrImageUrl: result.qrImageUrl,
                expectedUsdt: result.expectedUsdt,
                amountVnd: result.amountVnd,
                rate: result.rate,
                expiresAt: result.expiresAt.toISOString(),
                referenceCode: result.referenceCode,
            },
        });
    } catch (error: any) {
        console.error('[USDT] Create deposit error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'Lỗi hệ thống' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/v1/wallet/usdt?depositId=xxx — Check USDT deposit status
 * 
 * Used for frontend polling every 5 seconds
 */
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const depositId = request.nextUrl.searchParams.get('depositId');

    if (!depositId) {
        return NextResponse.json(
            { success: false, message: 'depositId is required' },
            { status: 400 }
        );
    }

    try {
        const deposit = await prisma.deposit.findFirst({
            where: {
                id: depositId,
                userId: authResult.userId,
                method: 'USDT',
            },
        });

        if (!deposit) {
            return NextResponse.json(
                { success: false, message: 'Deposit not found' },
                { status: 404 }
            );
        }

        // Auto-expire if past due
        if (deposit.status === 'PENDING' && deposit.expiresAt && deposit.expiresAt < new Date()) {
            await prisma.deposit.update({
                where: { id: deposit.id },
                data: { status: 'EXPIRED' },
            });
            deposit.status = 'EXPIRED' as any;
        }

        const config = deposit.network ? USDT_CONFIG[deposit.network as UsdtNetwork] : null;

        return NextResponse.json({
            success: true,
            data: {
                depositId: deposit.id,
                status: deposit.status,
                network: deposit.network,
                networkLabel: config?.label,
                expectedUsdt: deposit.usdtAmount,
                receivedUsdt: deposit.usdtReceived,
                amountVnd: deposit.amount,
                txHash: deposit.txHash,
                blockNumber: deposit.blockNumber,
                confirmations: deposit.confirmations,
                senderAddress: deposit.senderAddress,
                detectedAt: deposit.detectedAt?.toISOString(),
                confirmedAt: deposit.confirmedAt?.toISOString(),
                expiresAt: deposit.expiresAt?.toISOString(),
                explorerUrl: deposit.txHash && config
                    ? `${config.explorerTxUrl}${deposit.txHash}` : null,
            },
        });
    } catch (error: any) {
        console.error('[USDT] Status check error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống' },
            { status: 500 }
        );
    }
}
