// ===== FILE: src/modules/orders/order.service.ts =====

import { PrismaClient } from '@prisma/client';
import { CreateOrderInput } from './order.model';
import { ENV } from '../../config/env';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();
const MOD = 'OrderService';

function generateOrderNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

export async function createOrder(input: CreateOrderInput) {
  const orderNo = generateOrderNo();
  const usdtAmount = input.usdtAmount || input.fiatAmount / ENV.USDT_VND_RATE;
  const expiresAt = new Date(Date.now() + ENV.PAYMENT_EXPIRE_MINUTES * 60000);

  const order = await prisma.order.create({
    data: {
      orderNo,
      userId: input.userId,
      sessionId: input.sessionId,
      productId: input.productId,
      productName: input.productName,
      fiatAmount: input.fiatAmount,
      usdtAmount: parseFloat(usdtAmount.toFixed(2)),
      orderStatus: 'pending',
      paymentStatus: 'unpaid',
      expiresAt,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'order.created',
      entityType: 'order',
      entityId: order.id,
      actor: 'system',
      details: JSON.stringify({ orderNo, fiatAmount: input.fiatAmount, usdtAmount }),
    },
  });

  logger.info(MOD, `Order created: ${orderNo}`, { id: order.id, fiat: input.fiatAmount });
  return order;
}

export async function getOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { paymentAttempts: true },
  });
}

export async function getOrderByNo(orderNo: string) {
  return prisma.order.findUnique({
    where: { orderNo },
    include: { paymentAttempts: true },
  });
}

/**
 * Auto-approve order after successful payment.
 * IDEMPOTENT: only approves once.
 * Must be called inside a transaction or safe context.
 */
export async function autoApproveOrder(orderId: string, txHash: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  if (order.orderStatus === 'approved' || order.orderStatus === 'completed') {
    logger.warn(MOD, `Order already approved: ${orderId}`);
    return; // Idempotent: already approved
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: 'approved',
        paymentStatus: 'paid',
        approvedAt: new Date(),
        approvedBy: 'system:usdt_watcher',
      },
    }),
    prisma.orderStatusLog.create({
      data: {
        orderId,
        oldStatus: order.orderStatus,
        newStatus: 'approved',
        reason: `Auto-approved: payment confirmed (tx: ${txHash})`,
        actor: 'system:usdt_watcher',
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'order.auto_approved',
        entityType: 'order',
        entityId: orderId,
        actor: 'system:usdt_watcher',
        details: JSON.stringify({ txHash }),
      },
    }),
  ]);

  logger.info(MOD, `Order auto-approved: ${orderId}`, { txHash });
}
