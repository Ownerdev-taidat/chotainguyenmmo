export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Admin Users API — Uses Prisma DB
 * GET — List all users
 * PUT — Admin actions (ban/unban/balance/role/delete)
 */

export async function GET(request: NextRequest) {
    const authResult = await requireRole(request, ['ADMIN', 'SUPER_ADMIN']);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const users = await prisma.user.findMany({
            where: { role: { notIn: ['ADMIN', 'SUPER_ADMIN'] } },
            orderBy: { createdAt: 'desc' },
            include: {
                wallet: { select: { availableBalance: true } },
                _count: { select: { orders: true, deposits: true } },
            },
        });

        const data = users.map(u => ({
            id: u.id,
            name: u.fullName,
            username: u.username,
            email: u.email,
            role: u.role,
            status: u.status,
            balance: u.wallet?.availableBalance || 0,
            orders: u._count.orders,
            deposits: u._count.deposits,
            joined: u.createdAt.toISOString(),
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[Admin Users] GET error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const authResult = await requireRole(request, ['ADMIN', 'SUPER_ADMIN']);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { userId, action, amount, note } = await request.json();
        if (!userId || !action) {
            return NextResponse.json({ success: false, message: 'Missing userId or action' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { wallet: true },
        });
        if (!user) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy người dùng' }, { status: 404 });
        }

        // Add/Subtract balance
        if (action === 'add_balance' || action === 'subtract_balance') {
            const amt = parseInt(amount);
            if (!amt || amt <= 0) return NextResponse.json({ success: false, message: 'Số tiền không hợp lệ' }, { status: 400 });

            // Use $transaction to ensure both wallet update and transaction log are atomic
            const result = await prisma.$transaction(async (tx) => {
                // Create wallet if not exists
                let wallet = user.wallet;
                if (!wallet) {
                    wallet = await tx.wallet.create({ data: { userId, availableBalance: 0 } });
                }

                // For subtract: check if enough balance
                if (action === 'subtract_balance' && wallet.availableBalance < amt) {
                    throw new Error(`Số dư không đủ. Hiện tại: ${wallet.availableBalance.toLocaleString()}đ`);
                }

                // Atomic update using increment/decrement
                const updatedWallet = await tx.wallet.update({
                    where: { userId },
                    data: {
                        availableBalance: action === 'add_balance'
                            ? { increment: amt }
                            : { decrement: amt },
                    },
                });

                // Create transaction record
                await tx.walletTransaction.create({
                    data: {
                        walletId: wallet.id,
                        type: 'ADJUSTMENT',
                        direction: action === 'add_balance' ? 'CREDIT' : 'DEBIT',
                        amount: amt,
                        balanceAfter: updatedWallet.availableBalance,
                        description: `Admin ${action === 'add_balance' ? 'cộng' : 'trừ'} ${amt.toLocaleString()}đ${note ? ` — ${note}` : ''}`,
                    },
                });

                return updatedWallet;
            });

            return NextResponse.json({
                success: true,
                message: `Đã ${action === 'add_balance' ? 'cộng' : 'trừ'} ${amt.toLocaleString()}đ cho ${user.username}. Số dư mới: ${result.availableBalance.toLocaleString()}đ`,
            });
        }

        // Change role
        if (action === 'change_role') {
            const newRole = note || 'USER';
            await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
            return NextResponse.json({ success: true, message: `Đã đổi vai trò ${user.username} thành ${newRole}` });
        }

        // Ban / Suspend / Unban
        if (action === 'ban' || action === 'suspend' || action === 'unban') {
            const newStatus = action === 'ban' ? 'BANNED' : action === 'suspend' ? 'SUSPENDED' : 'ACTIVE';
            await prisma.user.update({ where: { id: userId }, data: { status: newStatus } });
            return NextResponse.json({ success: true, message: `Đã ${action === 'ban' ? 'cấm' : action === 'unban' ? 'mở khóa' : 'tạm khóa'} ${user.username}` });
        }

        // Delete user — permanently remove from database with all related records
        if (action === 'delete') {
            await prisma.$transaction(async (tx) => {
                // 1. Gather all IDs we need in parallel
                const [userOrders, buyerComplaints, wallet, shop, conversations] = await Promise.all([
                    tx.order.findMany({ where: { buyerId: userId }, select: { id: true } }),
                    tx.complaint.findMany({ where: { buyerId: userId }, select: { id: true } }),
                    tx.wallet.findUnique({ where: { userId }, select: { id: true } }),
                    tx.shop.findUnique({ where: { ownerId: userId }, select: { id: true } }),
                    tx.conversation.findMany({
                        where: { OR: [{ participant1: userId }, { participant2: userId }] },
                        select: { id: true },
                    }),
                ]);

                const orderIds = userOrders.map(o => o.id);
                const complaintIds = buyerComplaints.map(c => c.id);
                const convIds = conversations.map(c => c.id);

                // 2. Gather complaint IDs from orders + shop data in parallel
                const shopOrderIds: string[] = [];
                const shopProductIds: string[] = [];
                const allComplaintIds = [...complaintIds];

                if (orderIds.length > 0) {
                    const orderComplaints = await tx.complaint.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
                    allComplaintIds.push(...orderComplaints.map(c => c.id));
                }

                if (shop) {
                    const [shopOrders, shopProducts] = await Promise.all([
                        tx.order.findMany({ where: { shopId: shop.id }, select: { id: true } }),
                        tx.product.findMany({ where: { shopId: shop.id }, select: { id: true } }),
                    ]);
                    shopOrderIds.push(...shopOrders.map(o => o.id));
                    shopProductIds.push(...shopProducts.map(p => p.id));

                    if (shopOrderIds.length > 0) {
                        const shopComplaints = await tx.complaint.findMany({ where: { orderId: { in: shopOrderIds } }, select: { id: true } });
                        allComplaintIds.push(...shopComplaints.map(c => c.id));
                    }
                }

                // 3. Delete deepest children first (complaint messages) 
                const uniqueComplaintIds = [...new Set(allComplaintIds)];
                if (uniqueComplaintIds.length > 0) {
                    await tx.complaintMessage.deleteMany({ where: { complaintId: { in: uniqueComplaintIds } } });
                }

                // 4. Delete second-level children in parallel
                const batch2: Promise<unknown>[] = [];
                const allOrderIds = [...new Set([...orderIds, ...shopOrderIds])];
                if (allOrderIds.length > 0) {
                    batch2.push(
                        tx.complaint.deleteMany({ where: { orderId: { in: allOrderIds } } }),
                        tx.delivery.deleteMany({ where: { orderId: { in: allOrderIds } } }),
                        tx.orderItem.deleteMany({ where: { orderId: { in: allOrderIds } } }),
                    );
                }
                if (wallet) {
                    batch2.push(tx.walletTransaction.deleteMany({ where: { walletId: wallet.id } }));
                }
                if (shopProductIds.length > 0) {
                    batch2.push(
                        tx.review.deleteMany({ where: { productId: { in: shopProductIds } } }),
                        tx.favorite.deleteMany({ where: { productId: { in: shopProductIds } } }),
                        tx.stockItem.deleteMany({ where: { productId: { in: shopProductIds } } }),
                        tx.stockBatch.deleteMany({ where: { productId: { in: shopProductIds } } }),
                        tx.productImage.deleteMany({ where: { productId: { in: shopProductIds } } }),
                        tx.productTagMap.deleteMany({ where: { productId: { in: shopProductIds } } }),
                        tx.productVariant.deleteMany({ where: { productId: { in: shopProductIds } } }),
                    );
                }
                if (convIds.length > 0) {
                    batch2.push(tx.conversationMessage.deleteMany({ where: { conversationId: { in: convIds } } }));
                }
                // Also delete simple user-owned records in the same batch
                batch2.push(
                    tx.notification.deleteMany({ where: { userId } }),
                    tx.favorite.deleteMany({ where: { userId } }),
                    tx.review.deleteMany({ where: { userId } }),
                    tx.deposit.deleteMany({ where: { userId } }),
                    tx.withdrawal.deleteMany({ where: { userId } }),
                    tx.auditLog.deleteMany({ where: { userId } }),
                    tx.bankTransaction.deleteMany({ where: { userId } }),
                    tx.termsAcceptance.deleteMany({ where: { userId } }),
                );
                if (batch2.length > 0) await Promise.all(batch2);

                // 5. Delete parent records (orders, products, conversations, wallet)
                const batch3: Promise<unknown>[] = [];
                if (allOrderIds.length > 0) {
                    batch3.push(tx.order.deleteMany({ where: { id: { in: allOrderIds } } }));
                }
                if (shopProductIds.length > 0) {
                    batch3.push(tx.product.deleteMany({ where: { id: { in: shopProductIds } } }));
                }
                if (convIds.length > 0) {
                    batch3.push(tx.conversation.deleteMany({ where: { id: { in: convIds } } }));
                }
                if (wallet) {
                    batch3.push(tx.wallet.delete({ where: { id: wallet.id } }));
                }
                if (batch3.length > 0) await Promise.all(batch3);

                // 6. Delete shop if exists
                if (shop) {
                    await tx.shop.delete({ where: { id: shop.id } });
                }

                // 7. Finally delete the user
                await tx.user.delete({ where: { id: userId } });
            }, { timeout: 60000, maxWait: 15000 });
            return NextResponse.json({ success: true, message: `Đã xóa vĩnh viễn ${user.username}` });
        }

        return NextResponse.json({ success: false, message: 'Action không hợp lệ' }, { status: 400 });
    } catch (error: unknown) {
        console.error('[Admin Users] PUT error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
