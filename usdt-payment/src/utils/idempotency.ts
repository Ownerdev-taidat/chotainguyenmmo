// ===== FILE: src/utils/idempotency.ts =====

import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Check if a blockchain transfer event has already been processed.
 * Uses unique constraint: (network, txHash, logIndex)
 * Returns true if already exists (skip processing).
 */
export async function isTransferAlreadyProcessed(
  prisma: PrismaClient,
  network: string,
  txHash: string,
  logIndex: number,
): Promise<boolean> {
  const existing = await prisma.transferEvent.findUnique({
    where: {
      network_txHash_logIndex: { network, txHash, logIndex },
    },
  });
  return !!existing;
}

/**
 * Check if a payment attempt has already been finalized.
 * Finalized = paid | partial | overpaid | late_payment | manual_review
 */
export function isPaymentFinalized(status: string): boolean {
  const FINAL_STATUSES = ['paid', 'partial', 'overpaid', 'expired', 'failed', 'late_payment'];
  return FINAL_STATUSES.includes(status);
}

/**
 * Check if an order has already been auto-approved.
 */
export async function isOrderAlreadyApproved(
  prisma: PrismaClient,
  orderId: string,
): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  return order?.orderStatus === 'completed' || order?.orderStatus === 'approved';
}
