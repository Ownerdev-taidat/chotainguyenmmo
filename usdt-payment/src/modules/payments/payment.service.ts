// ===== FILE: src/modules/payments/payment.service.ts =====
//
// Core payment attempt management.
// - Creates payment attempts with UNIQUE AMOUNT MARKER
// - Expires old attempts
// - Status transitions with audit logs
//
// UNIQUE AMOUNT MARKER STRATEGY:
// ─────────────────────────────
// We use 3 decimal places for USDT amounts.
// base_amount = order's USDT value (e.g., 12.37)
// marker = small offset in range [0.001 .. 0.999]
// expected_amount = base_amount + marker (e.g., 12.371, 12.372, ...)
//
// Markers are unique ONLY among active (pending/detected/confirming) attempts on the SAME network.
// This gives us 999 unique slots per network — more than enough for MVP volume.
// When a marker slot is freed (attempt expired/paid), it becomes reusable.

import { PrismaClient } from '@prisma/client';
import { ENV, NETWORK_CONFIG, Network } from '../../config/env';
import { CreatePaymentAttemptInput } from './payment.model';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();
const MOD = 'PaymentService';

function generatePaymentNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PAY-${ts}-${rand}`;
}

// ══════════════════════════════════════════════
// UNIQUE MARKER GENERATION
// ══════════════════════════════════════════════

/**
 * Find an unused marker for the given base_amount on the given network.
 *
 * Strategy:
 * 1. Query all active payment attempts on this network
 * 2. Collect their markers
 * 3. Pick the first unused marker from 0.001 to 0.999
 *
 * If all 999 slots are taken (extremely unlikely), throw error.
 */
async function findAvailableMarker(
  baseAmount: number,
  network: Network,
): Promise<number> {
  // Get markers of all active attempts on this network
  const activeAttempts = await prisma.paymentAttempt.findMany({
    where: {
      network,
      status: { in: ['pending', 'detected', 'confirming'] },
      expiresAt: { gt: new Date() },
    },
    select: { uniqueAmountMarker: true },
  });

  const usedMarkers = new Set(
    activeAttempts.map(a => Math.round(a.uniqueAmountMarker * 1000))
  );

  // Try random markers first (faster for low contention)
  for (let attempt = 0; attempt < 20; attempt++) {
    const markerInt = Math.floor(Math.random() * 999) + 1; // 1-999
    if (!usedMarkers.has(markerInt)) {
      return markerInt / 1000; // 0.001 - 0.999
    }
  }

  // Fallback: sequential scan
  for (let markerInt = 1; markerInt <= 999; markerInt++) {
    if (!usedMarkers.has(markerInt)) {
      return markerInt / 1000;
    }
  }

  throw new Error(`No available USDT amount markers on ${network}. Too many active payments.`);
}

// ══════════════════════════════════════════════
// CREATE PAYMENT ATTEMPT
// ══════════════════════════════════════════════

export async function createPaymentAttempt(input: CreatePaymentAttemptInput) {
  const { orderId, network } = input;
  const config = NETWORK_CONFIG[network];

  // Validate order exists
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.orderStatus === 'approved' || order.orderStatus === 'completed') {
    throw new Error(`Order already completed: ${orderId}`);
  }

  // Expire any existing active attempts for this order
  await expireAttemptsByOrder(orderId);

  // Generate unique amount
  const baseAmount = order.usdtAmount || order.fiatAmount / ENV.USDT_VND_RATE;
  const baseRounded = parseFloat(baseAmount.toFixed(2));
  const marker = await findAvailableMarker(baseRounded, network);
  const expectedAmount = parseFloat((baseRounded + marker).toFixed(3));

  const expiresAt = new Date(Date.now() + ENV.PAYMENT_EXPIRE_MINUTES * 60000);
  const paymentNo = generatePaymentNo();

  const attempt = await prisma.paymentAttempt.create({
    data: {
      orderId,
      paymentNo,
      network,
      tokenSymbol: 'USDT',
      tokenContract: config.tokenContract,
      receivingAddress: config.publicAddress,
      baseAmount: baseRounded,
      uniqueAmountMarker: marker,
      expectedAmount,
      qrImageUrl: config.qrImageUrl,
      status: 'pending',
      requiredConfirmations: config.requiredConfirmations,
      expiresAt,
    },
  });

  // Update order payment status
  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: 'paying' },
  });

  // Audit logs
  await prisma.$transaction([
    prisma.paymentStatusLog.create({
      data: {
        paymentAttemptId: attempt.id,
        oldStatus: 'none',
        newStatus: 'pending',
        reason: `Payment attempt created: ${expectedAmount} USDT on ${network} (base: ${baseRounded}, marker: ${marker})`,
        actor: 'system',
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'payment.created',
        entityType: 'payment_attempt',
        entityId: attempt.id,
        actor: 'system',
        details: JSON.stringify({
          orderId, network, baseAmount: baseRounded, marker, expectedAmount, expiresAt,
        }),
      },
    }),
  ]);

  logger.info(MOD, `Payment attempt created: ${paymentNo}`, {
    id: attempt.id, network, expected: expectedAmount, expires: expiresAt,
  });

  return {
    ...attempt,
    networkLabel: config.label,
    chainName: config.chainName,
    explorerTxUrl: config.explorerTxUrl,
    rate: ENV.USDT_VND_RATE,
  };
}

// ══════════════════════════════════════════════
// EXPIRE ATTEMPTS
// ══════════════════════════════════════════════

/**
 * Expire all pending attempts for a specific order.
 * Called when user switches network or creates new attempt.
 */
export async function expireAttemptsByOrder(orderId: string) {
  const pendingAttempts = await prisma.paymentAttempt.findMany({
    where: {
      orderId,
      status: { in: ['pending', 'detected', 'confirming'] },
    },
  });

  for (const attempt of pendingAttempts) {
    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'expired' },
      }),
      prisma.paymentStatusLog.create({
        data: {
          paymentAttemptId: attempt.id,
          oldStatus: attempt.status,
          newStatus: 'expired',
          reason: 'Expired: new payment attempt created or manual expiry',
          actor: 'system',
        },
      }),
    ]);
  }

  if (pendingAttempts.length > 0) {
    logger.info(MOD, `Expired ${pendingAttempts.length} attempts for order ${orderId}`);
  }
}

/**
 * Global expiry job: expire all attempts past their expiresAt.
 */
export async function expireOldAttempts() {
  const now = new Date();
  const expired = await prisma.paymentAttempt.findMany({
    where: {
      status: { in: ['pending', 'detected'] },
      expiresAt: { lte: now },
    },
  });

  for (const attempt of expired) {
    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'expired' },
      }),
      prisma.paymentStatusLog.create({
        data: {
          paymentAttemptId: attempt.id,
          oldStatus: attempt.status,
          newStatus: 'expired',
          reason: 'Expired: payment window closed',
          actor: 'system',
        },
      }),
    ]);
  }

  if (expired.length > 0) {
    logger.info(MOD, `Expired ${expired.length} payment attempts globally`);
  }
}

// ══════════════════════════════════════════════
// GET STATUS
// ══════════════════════════════════════════════

export async function getPaymentAttempt(paymentId: string) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: paymentId },
    include: { transferEvents: true },
  });

  if (!attempt) return null;

  // Auto-expire if past due and still pending
  if (
    ['pending', 'detected'].includes(attempt.status) &&
    attempt.expiresAt < new Date()
  ) {
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: 'expired' },
    });
    attempt.status = 'expired';
  }

  const config = NETWORK_CONFIG[attempt.network as Network];
  return {
    ...attempt,
    networkLabel: config?.label,
    chainName: config?.chainName,
    explorerUrl: attempt.txHash ? `${config?.explorerTxUrl}${attempt.txHash}` : null,
  };
}

export async function getPaymentDisplay(paymentId: string) {
  const attempt = await getPaymentAttempt(paymentId);
  if (!attempt) return null;

  const config = NETWORK_CONFIG[attempt.network as Network];
  return {
    paymentId: attempt.id,
    paymentNo: attempt.paymentNo,
    status: attempt.status,
    network: attempt.network,
    networkLabel: config.label,
    chainName: config.chainName,
    receivingAddress: attempt.receivingAddress,
    qrImageUrl: attempt.qrImageUrl,
    expectedAmount: attempt.expectedAmount,
    baseAmount: attempt.baseAmount,
    actualReceived: attempt.actualReceivedAmount,
    txHash: attempt.txHash,
    confirmations: attempt.confirmationCount,
    requiredConfirmations: attempt.requiredConfirmations,
    expiresAt: attempt.expiresAt.toISOString(),
    explorerUrl: attempt.txHash ? `${config.explorerTxUrl}${attempt.txHash}` : null,
  };
}
