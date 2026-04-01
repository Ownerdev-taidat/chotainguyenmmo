import { NextRequest, NextResponse } from 'next/server';

/**
 * Public API — Purchase
 * ⚠️ DISABLED — Route này đã bị tắt vì bypass phí sàn (feeAmount).
 * Vui lòng sử dụng route chính /api/v1/orders để mua hàng.
 * 
 * Nếu cần mở lại, phải thêm logic tính phí sàn giống /api/v1/orders/route.ts
 */
export async function POST(req: NextRequest) {
    return NextResponse.json({
        success: false,
        message: 'Route này đã bị tắt. Vui lòng sử dụng giao diện website hoặc /api/v1/orders để mua hàng.',
        errorCode: 'ROUTE_DISABLED',
    }, { status: 410 });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _DISABLED_POST(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        return NextResponse.json({
            success: false,
            message: 'API Key required via x-api-key header',
        }, { status: 401 });
    }

    const keyData = validateApiKey(apiKey);
    if (!keyData) {
        return NextResponse.json({ success: false, message: 'Invalid or revoked API Key' }, { status: 403 });
    }

    if (!keyData.permissions.includes('purchase')) {
        return NextResponse.json({ success: false, message: 'Permission denied: purchase required' }, { status: 403 });
    }

    const body = await req.json();
    const { productId, quantity = 1 } = body;

    if (!productId) {
        return NextResponse.json({ success: false, message: 'productId is required' }, { status: 400 });
    }
    if (quantity < 1 || quantity > 10) {
        return NextResponse.json({ success: false, message: 'quantity must be between 1 and 10' }, { status: 400 });
    }

    try {
        // Find product from DB
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { shop: { select: { id: true, ownerId: true } } },
        });
        if (!product) {
            return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
        }

        // Check stock
        const availableStock = await prisma.stockItem.findMany({
            where: { productId, status: 'AVAILABLE' },
            take: quantity,
        });
        if (availableStock.length < quantity) {
            return NextResponse.json({
                success: false,
                message: `Không đủ hàng. Còn lại: ${availableStock.length}`,
                available: availableStock.length,
            }, { status: 400 });
        }

        // Check balance
        const totalPrice = product.price * quantity;
        const wallet = await prisma.wallet.findUnique({ where: { userId: keyData.userId } });
        if (!wallet || wallet.availableBalance < totalPrice) {
            return NextResponse.json({
                success: false,
                message: `Số dư không đủ. Cần ${totalPrice.toLocaleString('vi-VN')}đ`,
                required: totalPrice,
                balance: wallet?.availableBalance || 0,
            }, { status: 400 });
        }

        // Process purchase in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Reserve stock items
            const stockIds = availableStock.map(s => s.id);
            await tx.stockItem.updateMany({
                where: { id: { in: stockIds } },
                data: { status: 'SOLD' },
            });

            // Deduct from buyer wallet
            await tx.wallet.update({
                where: { userId: keyData.userId },
                data: { availableBalance: { decrement: totalPrice } },
            });

            // Generate order code
            const orderCode = `ORD-${Date.now().toString(36).toUpperCase()}`;

            // Create order
            const order = await tx.order.create({
                data: {
                    orderCode,
                    buyerId: keyData.userId,
                    shopId: product.shop!.id,
                    subtotal: totalPrice,
                    totalAmount: totalPrice,
                    status: 'COMPLETED',
                    paymentStatus: 'PAID',
                    deliveryStatus: 'DELIVERED',
                    paidAt: new Date(),
                    completedAt: new Date(),
                    deliveredAt: new Date(),
                    items: {
                        create: {
                            productId,
                            quantity,
                            unitPrice: product.price,
                            total: totalPrice,
                        },
                    },
                },
            });

            // Create wallet transaction
            const updatedWallet = await tx.wallet.findUnique({ where: { userId: keyData.userId } });
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'PURCHASE',
                    direction: 'DEBIT',
                    amount: totalPrice,
                    balanceAfter: updatedWallet?.availableBalance || 0,
                    description: `Mua ${quantity}x ${product.name} (API)`,
                    referenceType: 'order',
                    referenceId: order.id,
                },
            });

            // Update product sold count
            await tx.product.update({
                where: { id: productId },
                data: { soldCount: { increment: quantity } },
            });

            return {
                orderId: order.id,
                orderCode: order.orderCode,
                items: availableStock.map(s => s.rawContent),
                balanceAfter: updatedWallet?.availableBalance || 0,
            };
        });

        return NextResponse.json({
            success: true,
            message: `Mua thành công ${quantity}x ${product.name}`,
            data: {
                orderId: result.orderId,
                orderCode: result.orderCode,
                product: product.name,
                quantity,
                totalPrice,
                items: result.items,
                balanceAfter: result.balanceAfter,
            },
        });
    } catch (error) {
        console.error('[Public Purchase] Error:', error);
        return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
    }
}
