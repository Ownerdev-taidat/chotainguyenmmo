export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getMBBankService } from '@/lib/mbbank';

// POST /api/v1/wallet/deposits/check — Check if a pending deposit has been paid
// Sử dụng cookie/session + apicanhan fallback (copy logic từ shop-mmo)
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

        console.log(`[Deposit Check] Checking depositCode="${depositCode}", amount=${amount}, userId=${authResult.userId}`);

        // Check MBBank transactions (cookie/session + apicanhan fallback)
        const mbService = getMBBankService();
        const match = await mbService.checkDeposit(depositCode, parseInt(amount));

        if (match) {
            console.log(`[Deposit Check] ✅ Found matching transaction: ${match.transaction_id}, amount=${match.amount}`);

            // Found matching transaction — credit the user's wallet
            try {
                let alreadyProcessed = false;

                await prisma.$transaction(async (tx: any) => {
                    // Check if this transaction was already processed (prevent double-credit)
                    const existingDeposit = await tx.deposit.findFirst({
                        where: {
                            userId: authResult.userId,
                            transferContent: { contains: depositCode },
                            status: 'COMPLETED',
                        },
                    });

                    if (existingDeposit) {
                        console.log(`[Deposit Check] ⚠️ Already processed deposit for ${depositCode}, skipping`);
                        alreadyProcessed = true;
                        return;
                    }

                    // Update pending deposit record to COMPLETED
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
                            availableBalance: { increment: parseInt(amount) },
                            totalDeposited: { increment: parseInt(amount) },
                        },
                        create: {
                            userId: authResult.userId,
                            availableBalance: parseInt(amount),
                            totalDeposited: parseInt(amount),
                        },
                    });

                    console.log(`[Deposit Check] ✅ Credited ${parseInt(amount).toLocaleString()}đ to user ${authResult.userId}`);
                });

                if (alreadyProcessed) {
                    return NextResponse.json({
                        success: true,
                        status: 'found',
                        transaction: match,
                        message: 'Giao dịch đã được xử lý trước đó.',
                    });
                }

                return NextResponse.json({
                    success: true,
                    status: 'found',
                    transaction: match,
                    message: `Đã tìm thấy giao dịch và cộng ${parseInt(amount).toLocaleString('vi-VN')}đ vào ví!`,
                });
            } catch (dbError: any) {
                console.error('[Deposit Check] DB error:', dbError);
                // If it's a unique constraint violation, treat as already processed
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

        console.log(`[Deposit Check] ❌ No matching transaction found for ${depositCode}`);

        return NextResponse.json({
            success: true,
            status: 'not_found',
            message: 'Chưa tìm thấy giao dịch. Hệ thống sẽ tự động kiểm tra lại.',
        });
    } catch (error: any) {
        console.error('[Deposit Check] Error:', error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
