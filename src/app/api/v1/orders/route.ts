export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, generateOrderCode } from '@/lib/auth';
import { getPlatformSettings } from '@/lib/mock-order-store';

// POST /api/v1/orders — Create a new order (purchase)
export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { productId, variantId, quantity = 1, voucherCode } = await request.json();

        if (!productId || quantity < 1) {
            return NextResponse.json(
                { success: false, message: 'Dữ liệu không hợp lệ', errorCode: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        // Get product with category (for per-category fee)
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { shop: true, category: { select: { feePercent: true } } },
        });

        if (!product || product.status !== 'ACTIVE') {
            return NextResponse.json(
                { success: false, message: 'Sản phẩm không tồn tại hoặc ngừng bán', errorCode: 'PRODUCT_UNAVAILABLE' },
                { status: 400 }
            );
        }

        if (quantity < product.minPurchaseQty || quantity > product.maxPurchaseQty) {
            return NextResponse.json(
                { success: false, message: `Số lượng phải từ ${product.minPurchaseQty} đến ${product.maxPurchaseQty}`, errorCode: 'INVALID_QUANTITY' },
                { status: 400 }
            );
        }

        // Determine unit price (variant price or product price)
        let unitPrice = product.price;
        if (variantId) {
            const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
            if (variant) unitPrice = variant.price;
        }

        let subtotal = unitPrice * quantity;
        let discountAmount = 0;
        let appliedVoucherId: string | null = null;

        // ── VOUCHER VALIDATION ──
        if (voucherCode) {
            const voucher = await prisma.voucher.findFirst({
                where: {
                    code: voucherCode.toUpperCase().trim(),
                    shopId: product.shopId,
                    isActive: true,
                },
            });

            if (!voucher) {
                return NextResponse.json({ success: false, message: 'Mã giảm giá không hợp lệ hoặc không áp dụng cho sản phẩm này', errorCode: 'INVALID_VOUCHER' }, { status: 400 });
            }

            // Check expiry
            if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
                return NextResponse.json({ success: false, message: 'Mã giảm giá đã hết hạn', errorCode: 'VOUCHER_EXPIRED' }, { status: 400 });
            }

            // Check usage limit
            if (voucher.usedCount >= voucher.usageLimit) {
                return NextResponse.json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng', errorCode: 'VOUCHER_EXHAUSTED' }, { status: 400 });
            }

            // Check product scope
            if (voucher.productId && voucher.productId !== productId) {
                return NextResponse.json({ success: false, message: 'Mã giảm giá không áp dụng cho sản phẩm này', errorCode: 'VOUCHER_WRONG_PRODUCT' }, { status: 400 });
            }

            // Check min order
            if (voucher.minOrderAmount && subtotal < voucher.minOrderAmount) {
                return NextResponse.json({ success: false, message: `Đơn hàng tối thiểu ${voucher.minOrderAmount.toLocaleString()}đ để dùng mã này`, errorCode: 'VOUCHER_MIN_ORDER' }, { status: 400 });
            }

            // Calculate discount
            if (voucher.discountType === 'PERCENT') {
                discountAmount = Math.floor(subtotal * voucher.discountValue / 100);
                if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
                    discountAmount = voucher.maxDiscount;
                }
            } else {
                discountAmount = voucher.discountValue;
            }

            // Don't let discount exceed subtotal
            if (discountAmount > subtotal) discountAmount = subtotal;
            appliedVoucherId = voucher.id;
        }

        const totalAmount = subtotal - discountAmount;

        // Per-category fee or global platform fee
        const globalRate = getPlatformSettings().commissionRate;
        const commissionRate = product.category.feePercent ?? globalRate;
        const feeAmount = Math.floor(totalAmount * commissionRate / 100);

        // Transaction: check balance, check stock, create order, deduct wallet, reserve stock
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get wallet with lock
            const wallet = await tx.wallet.findUnique({ where: { userId: authResult.userId } });
            if (!wallet || wallet.availableBalance < totalAmount) {
                throw new Error('INSUFFICIENT_BALANCE');
            }

            // 2. Check available stock
            const stockWhere: Record<string, unknown> = { productId, status: 'AVAILABLE' };
            if (variantId) stockWhere.variantId = variantId;
            const availableStock = await tx.stockItem.findMany({
                where: stockWhere,
                take: quantity,
            });

            if (availableStock.length < quantity) {
                throw new Error('INSUFFICIENT_STOCK');
            }

            // 3. Create order
            const orderCode = generateOrderCode();
            const order = await tx.order.create({
                data: {
                    orderCode,
                    buyerId: authResult.userId,
                    shopId: product.shopId,
                    status: 'PAID',
                    subtotal,
                    discountAmount,
                    feeAmount,
                    totalAmount,
                    paymentStatus: 'PAID',
                    deliveryStatus: product.deliveryType === 'AUTO' ? 'DELIVERED' : 'PENDING',
                    paidAt: new Date(),
                    deliveredAt: product.deliveryType === 'AUTO' ? new Date() : null,
                    completedAt: product.deliveryType === 'AUTO' ? new Date() : null,
                    items: {
                        create: {
                            productId,
                            quantity,
                            unitPrice,
                            total: subtotal,
                        },
                    },
                },
            });

            // 4. Increment voucher usage
            if (appliedVoucherId) {
                await tx.voucher.update({
                    where: { id: appliedVoucherId },
                    data: { usedCount: { increment: 1 } },
                });
            }

            // 5. Deduct buyer wallet
            await tx.wallet.update({
                where: { userId: authResult.userId },
                data: {
                    availableBalance: { decrement: totalAmount },
                    totalSpent: { increment: totalAmount },
                },
            });

            // 6. Record wallet transaction (buyer)
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'PURCHASE',
                    direction: 'DEBIT',
                    amount: totalAmount,
                    balanceAfter: wallet.availableBalance - totalAmount,
                    referenceType: 'order',
                    referenceId: order.id,
                    description: `Mua ${product.name} x${quantity}${discountAmount > 0 ? ` (giảm ${discountAmount.toLocaleString()}đ)` : ''}`,
                },
            });

            // 7. Credit seller wallet (held for 7 days)
            const sellerEarning = totalAmount - feeAmount;
            const sellerWallet = await tx.wallet.findUnique({ where: { userId: product.shop.ownerId } });
            if (sellerWallet) {
                await tx.wallet.update({
                    where: { userId: product.shop.ownerId },
                    data: { heldBalance: { increment: sellerEarning } },
                });

                await tx.walletTransaction.create({
                    data: {
                        walletId: sellerWallet.id,
                        type: 'SALE_EARNING',
                        direction: 'CREDIT',
                        amount: sellerEarning,
                        balanceAfter: sellerWallet.availableBalance,
                        referenceType: 'order',
                        referenceId: order.id,
                        description: `Bán ${product.name} x${quantity} — Tổng: ${totalAmount.toLocaleString()}đ, Phí sàn ${commissionRate}%: -${feeAmount.toLocaleString()}đ, Nhận: ${sellerEarning.toLocaleString()}đ (tạm giữ 7 ngày)`,
                    },
                });
            }

            // 7b. Credit platform commission to admin wallet
            try {
                const adminUser = await tx.user.findFirst({
                    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
                    orderBy: { createdAt: 'asc' },
                });
                if (adminUser && feeAmount > 0) {
                    const adminWallet = await tx.wallet.findUnique({ where: { userId: adminUser.id } });
                    if (adminWallet) {
                        await tx.wallet.update({
                            where: { userId: adminUser.id },
                            data: {
                                availableBalance: { increment: feeAmount },
                            },
                        });
                        await tx.walletTransaction.create({
                            data: {
                                walletId: adminWallet.id,
                                type: 'FEE',
                                direction: 'CREDIT',
                                amount: feeAmount,
                                balanceAfter: adminWallet.availableBalance + feeAmount,
                                referenceType: 'order',
                                referenceId: order.id,
                                description: `Phí sàn ${commissionRate}% đơn ${orderCode} — ${product.name} x${quantity}`,
                            },
                        });
                    }
                }
            } catch (e) {
                console.error('Credit platform fee error:', e);
            }

            // 8. Mark stock as sold & create delivery
            const stockIds = availableStock.map(s => s.id);
            await tx.stockItem.updateMany({
                where: { id: { in: stockIds } },
                data: { status: 'SOLD', soldAt: new Date(), orderId: order.id },
            });

            // 9. Create delivery with stock content
            if (product.deliveryType === 'AUTO') {
                const deliveryContent = availableStock.map(s => s.rawContent).join('\n');
                await tx.delivery.create({
                    data: {
                        orderId: order.id,
                        content: deliveryContent,
                        status: 'DELIVERED',
                    },
                });
            }

            // 10. Update product counts
            await tx.product.update({
                where: { id: productId },
                data: {
                    soldCount: { increment: quantity },
                    stockCountCached: { decrement: quantity },
                },
            });

            return order;
        });

        return NextResponse.json({
            success: true,
            message: `Đơn hàng đã được tạo thành công${discountAmount > 0 ? ` (giảm ${discountAmount.toLocaleString()}đ)` : ''}`,
            data: { orderId: result.id, orderCode: result.orderCode, discountAmount },
        }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '';
        if (msg === 'INSUFFICIENT_BALANCE') {
            return NextResponse.json(
                { success: false, message: 'Số dư ví không đủ để thực hiện giao dịch này', errorCode: 'INSUFFICIENT_BALANCE' },
                { status: 400 }
            );
        }
        if (msg === 'INSUFFICIENT_STOCK') {
            return NextResponse.json(
                { success: false, message: 'Sản phẩm hiện không còn đủ tồn kho', errorCode: 'INSUFFICIENT_STOCK' },
                { status: 400 }
            );
        }
        console.error('Create order error:', error);
        return NextResponse.json(
            { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại sau.', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}

// GET /api/v1/orders — List user orders
export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
        const status = searchParams.get('status');

        const where: Record<string, unknown> = { buyerId: authResult.userId };
        if (status) where.status = status;

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    items: { include: { product: { select: { name: true, slug: true, price: true } } } },
                    shop: { select: { name: true, slug: true, ownerId: true } },
                    deliveries: { select: { content: true, status: true } },
                },
            }),
            prisma.order.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
        });
    } catch (error) {
        console.error('List orders error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
