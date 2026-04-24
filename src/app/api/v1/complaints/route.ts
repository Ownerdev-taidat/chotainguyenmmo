export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// POST /api/v1/complaints — Create complaint
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const errors: string[] = [];

    try {
        const { orderCode, reason } = await request.json();

        if (!orderCode || !reason?.trim()) {
            return NextResponse.json(
                { success: false, message: 'Vui lòng điền đầy đủ thông tin' },
                { status: 400 }
            );
        }

        // Find order with shop info
        const order = await prisma.order.findFirst({
            where: { orderCode, buyerId: authResult.userId },
            include: {
                shop: { select: { id: true, name: true, ownerId: true } },
                items: { include: { product: { select: { name: true } } }, take: 1 },
            },
        });
        if (!order) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy đơn hàng' }, { status: 404 });
        }

        if (order.status === 'DISPUTED') {
            return NextResponse.json({ success: false, message: 'Đơn hàng đã đang khiếu nại' }, { status: 409 });
        }

        // 1. Update order status to DISPUTED
        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'DISPUTED', notes: `Khiếu nại: ${reason.trim()}` },
        });

        // 2. Hold seller's money — move from availableBalance to heldBalance
        const holdAmount = order.totalAmount;
        try {
            const sellerWallet = await prisma.wallet.findUnique({
                where: { userId: order.shop.ownerId },
            });
            if (sellerWallet) {
                const deductAmount = Math.min(holdAmount, sellerWallet.availableBalance);
                await prisma.wallet.update({
                    where: { userId: order.shop.ownerId },
                    data: {
                        availableBalance: { decrement: deductAmount },
                        heldBalance: { increment: holdAmount },
                    },
                });
                // Log the transaction
                await prisma.walletTransaction.create({
                    data: {
                        walletId: sellerWallet.id,
                        type: 'ADJUSTMENT',
                        direction: 'DEBIT',
                        amount: -holdAmount,
                        balanceAfter: sellerWallet.availableBalance - deductAmount,
                        description: `Tạm giữ tiền khiếu nại đơn ${order.orderCode}`,
                        referenceId: order.id,
                        referenceType: 'ORDER',
                    },
                });
            }
        } catch (e: any) {
            errors.push(`Hold money: ${e.message}`);
            console.error('Money hold error:', e);
        }

        const buyerUser = await prisma.user.findUnique({
            where: { id: authResult.userId },
            select: { fullName: true, username: true },
        });
        const productName = order.items?.[0]?.product?.name || 'Sản phẩm';
        const buyerName = buyerUser?.fullName || buyerUser?.username || 'Khách hàng';

        // 3. Notify Admin
        try {
            const adminMsg = `🚨 KHIẾU NẠI MỚI\n━━━━━━━━━━━━━━\n👤 Khách: ${buyerName}\n📦 Đơn: ${order.orderCode}\n🏪 Shop: ${order.shop.name}\n🛍️ SP: ${productName}\n💰 Tổng: ${order.totalAmount.toLocaleString()}đ\n💳 Đã tạm giữ ${holdAmount.toLocaleString()}đ từ seller\n❗ Lý do: ${reason.trim()}\n━━━━━━━━━━━━━━\nVui lòng xem xét và phản hồi.`;

            const adminConv = await prisma.conversation.upsert({
                where: { participant1_participant2: { participant1: authResult.userId, participant2: 'admin' } },
                create: { participant1: authResult.userId, participant2: 'admin', status: 'ACTIVE', lastMessage: `🚨 Khiếu nại: ${order.orderCode}`, lastMessageAt: new Date() },
                update: { lastMessage: `🚨 Khiếu nại: ${order.orderCode}`, lastMessageAt: new Date() },
            });
            await prisma.conversationMessage.create({
                data: { conversationId: adminConv.id, senderId: authResult.userId, content: adminMsg },
            });
        } catch (e: any) {
            errors.push(`Admin notify: ${e.message}`);
        }

        // 4. Notify Seller
        try {
            const sellerMsg = `🚨 KHIẾU NẠI ĐƠN HÀNG\n━━━━━━━━━━━━━━\n👤 Khách: ${buyerName}\n📦 Đơn: ${order.orderCode}\n🛍️ SP: ${productName}\n💰 Tổng: ${order.totalAmount.toLocaleString()}đ\n💳 Web đã tạm giữ ${holdAmount.toLocaleString()}đ từ ví của bạn\n❗ Lý do: ${reason.trim()}\n━━━━━━━━━━━━━━\nVui lòng kiểm tra và phản hồi sớm nhất.`;

            const sellerConv = await prisma.conversation.upsert({
                where: { participant1_participant2: { participant1: order.shop.ownerId, participant2: 'admin' } },
                create: { participant1: order.shop.ownerId, participant2: 'admin', status: 'ACTIVE', lastMessage: `🚨 Khiếu nại: ${order.orderCode}`, lastMessageAt: new Date() },
                update: { lastMessage: `🚨 Khiếu nại: ${order.orderCode}`, lastMessageAt: new Date() },
            });
            await prisma.conversationMessage.create({
                data: { conversationId: sellerConv.id, senderId: 'admin-auto', content: sellerMsg },
            });
        } catch (e: any) {
            errors.push(`Seller notify: ${e.message}`);
        }

        return NextResponse.json({
            success: true,
            message: 'Khiếu nại đã được gửi thành công',
            errors: errors.length > 0 ? errors : undefined,
        }, { status: 201 });
    } catch (error: any) {
        console.error('Create complaint error:', error);
        return NextResponse.json(
            { success: false, message: error.message || 'Lỗi hệ thống', errors },
            { status: 500 }
        );
    }
}

// DELETE /api/v1/complaints?orderCode=xxx — Cancel complaint
export async function DELETE(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { searchParams } = new URL(request.url);
        const orderCode = searchParams.get('orderCode');
        if (!orderCode) {
            return NextResponse.json({ success: false, message: 'Thiếu mã đơn hàng' }, { status: 400 });
        }

        const order = await prisma.order.findFirst({
            where: { orderCode, buyerId: authResult.userId, status: 'DISPUTED' },
            include: {
                shop: { select: { ownerId: true, name: true } },
                buyer: { select: { fullName: true, username: true } },
                items: { include: { product: { select: { name: true } } }, take: 1 },
            },
        });
        if (!order) {
            return NextResponse.json({ success: false, message: 'Không tìm thấy đơn hàng đang khiếu nại' }, { status: 404 });
        }

        const buyerName = order.buyer.fullName || order.buyer.username || 'Khách hàng';
        const productName = order.items?.[0]?.product?.name || 'Sản phẩm';

        // Revert order status
        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'COMPLETED', notes: `Khiếu nại đã được khách tự hủy` },
        });

        // Release held money back to seller
        try {
            const sellerWallet = await prisma.wallet.findUnique({
                where: { userId: order.shop.ownerId },
            });
            if (sellerWallet && sellerWallet.heldBalance > 0) {
                const releaseAmount = Math.min(order.totalAmount, sellerWallet.heldBalance);
                await prisma.wallet.update({
                    where: { userId: order.shop.ownerId },
                    data: {
                        availableBalance: { increment: releaseAmount },
                        heldBalance: { decrement: releaseAmount },
                    },
                });
                await prisma.walletTransaction.create({
                    data: {
                        walletId: sellerWallet.id,
                        type: 'ADJUSTMENT',
                        direction: 'CREDIT',
                        amount: releaseAmount,
                        balanceAfter: sellerWallet.availableBalance + releaseAmount,
                        description: `Hoàn trả tiền tạm giữ — khiếu nại đơn ${order.orderCode} đã hủy`,
                        referenceId: order.id,
                        referenceType: 'ORDER',
                    },
                });
            }
        } catch (e) {
            console.error('Release money error:', e);
        }

        // Notify seller: "Đã xử lý"
        try {
            const sellerConv = await prisma.conversation.findFirst({
                where: {
                    OR: [
                        { participant1: order.shop.ownerId, participant2: 'admin' },
                        { participant1: 'admin', participant2: order.shop.ownerId },
                    ],
                },
            });
            if (sellerConv) {
                await prisma.conversationMessage.create({
                    data: {
                        conversationId: sellerConv.id,
                        senderId: 'admin-auto',
                        content: `✅ ĐÃ XỬ LÝ\n━━━━━━━━━━━━━━\n📦 Đơn: ${order.orderCode}\n🛍️ SP: ${productName}\n👤 Khách: ${buyerName}\n\n✅ Khách hàng đã tự hủy khiếu nại.\n💰 Đã hoàn trả ${order.totalAmount.toLocaleString()}đ về ví của bạn.\n━━━━━━━━━━━━━━`,
                    },
                });
                await prisma.conversation.update({
                    where: { id: sellerConv.id },
                    data: { lastMessage: `✅ Đã xử lý khiếu nại ${order.orderCode}`, lastMessageAt: new Date() },
                });
            }
        } catch (e) {
            console.error('Notify seller error:', e);
        }

        // Notify admin: "Seller Đã Giải Quyết"
        try {
            const adminConv = await prisma.conversation.findFirst({
                where: {
                    OR: [
                        { participant1: authResult.userId, participant2: 'admin' },
                        { participant1: 'admin', participant2: authResult.userId },
                    ],
                },
            });
            if (adminConv) {
                await prisma.conversationMessage.create({
                    data: {
                        conversationId: adminConv.id,
                        senderId: 'admin-auto',
                        content: `✅ SELLER ĐÃ GIẢI QUYẾT\n━━━━━━━━━━━━━━\n📦 Đơn: ${order.orderCode}\n🏪 Shop: ${order.shop.name}\n🛍️ SP: ${productName}\n👤 Khách: ${buyerName}\n\n✅ Khách hàng đã tự hủy khiếu nại — vấn đề đã được giải quyết.\n💰 Tiền tạm giữ ${order.totalAmount.toLocaleString()}đ đã hoàn về cho seller.\n━━━━━━━━━━━━━━`,
                    },
                });
                await prisma.conversation.update({
                    where: { id: adminConv.id },
                    data: { lastMessage: `✅ Seller đã giải quyết khiếu nại ${order.orderCode}`, lastMessageAt: new Date() },
                });
            }
        } catch (e) {
            console.error('Notify admin error:', e);
        }

        return NextResponse.json({ success: true, message: 'Đã hủy khiếu nại thành công' });
    } catch (error: any) {
        console.error('Cancel complaint error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Lỗi hệ thống' }, { status: 500 });
    }
}
