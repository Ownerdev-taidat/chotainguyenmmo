import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getMBBankService } from '@/lib/mbbank';

// POST /api/v1/wallet/deposits/check — Check if a pending deposit has been paid
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { depositCode, amount } = await request.json();

        if (!depositCode || !amount) {
            return NextResponse.json(
                { success: false, message: 'Thiếu thông tin kiểm tra' },
                { status: 400 }
            );
        }

        // Check MBBank transactions via apicanhan
        const mbService = getMBBankService();
        const match = await mbService.checkDeposit(depositCode, parseInt(amount));

        if (match) {
            // Found matching transaction — credit the user's wallet
            try {
                await prisma.$transaction(async (tx: any) => {
                    // Check if this transaction was already processed
                    const existingDeposit = await tx.deposit.findFirst({
                        where: {
                            userId: authResult.userId,
                            transferContent: { contains: depositCode },
                            status: 'COMPLETED',
                        },
                    });

                    if (existingDeposit) {
                        // Already processed, skip
                        return;
                    }

                    // Update or create deposit record
                    const pendingDeposit = await tx.deposit.findFirst({
                        where: {
                            userId: authResult.userId,
                            transferContent: { contains: depositCode },
                            status: 'PENDING',
                        },
                    });

                    if (pendingDeposit) {
                        await tx.deposit.update({
                            where: { id: pendingDeposit.id },
                            data: {
                                status: 'COMPLETED',
                                completedAt: new Date(),
                                bankTxnId: match.transaction_id,
                            },
                        });
                    } else {
                        // Create a new deposit record for manual deposits
                        await tx.deposit.create({
                            data: {
                                userId: authResult.userId,
                                amount: parseInt(amount),
                                method: 'bank_transfer',
                                status: 'COMPLETED',
                                referenceCode: depositCode,
                                transferContent: depositCode,
                                bankTxnId: match.transaction_id,
                                completedAt: new Date(),
                                expiresAt: new Date(Date.now() + 300000),
                            },
                        });
                    }

                    // Credit user's wallet
                    await tx.wallet.upsert({
                        where: { userId: authResult.userId },
                        update: {
                            balance: { increment: parseInt(amount) },
                            totalDeposited: { increment: parseInt(amount) },
                        },
                        create: {
                            userId: authResult.userId,
                            balance: parseInt(amount),
                            totalDeposited: parseInt(amount),
                        },
                    });
                });

                return NextResponse.json({
                    success: true,
                    status: 'found',
                    transaction: match,
                    message: `Đã tìm thấy giao dịch và cộng ${parseInt(amount).toLocaleString('vi-VN')}đ vào ví!`,
                });
            } catch (dbError: any) {
                console.error('Deposit DB error:', dbError);
                // If it's a duplicate, still return success
                if (dbError.code === 'P2002') {
                    return NextResponse.json({
                        success: true,
                        status: 'found',
                        transaction: match,
                        message: 'Giao dịch đã được xử lý trước đó.',
                    });
                }
                return NextResponse.json(
                    { success: false, status: 'error', message: 'Lỗi cập nhật ví: ' + dbError.message },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            status: 'not_found',
            message: 'Chưa tìm thấy giao dịch. Hệ thống sẽ tự động kiểm tra lại.',
        });
    } catch (error: any) {
        console.error('Deposit check error:', error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
