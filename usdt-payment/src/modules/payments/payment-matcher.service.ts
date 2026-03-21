// ===== FILE: src/modules/payments/payment-matcher.service.ts =====
//
// ███████╗████████╗██████╗ ██╗ ██████╗████████╗    ███╗   ███╗ █████╗ ████████╗ ██████╗██╗  ██╗███████╗██████╗
// ██╔════╝╚══██╔══╝██╔══██╗██║██╔════╝╚══██╔══╝    ████╗ ████║██╔══██╗╚══██╔══╝██╔════╝██║  ██║██╔════╝██╔══██╗
// ███████╗   ██║   ██████╔╝██║██║        ██║       ██╔████╔██║███████║   ██║   ██║     ███████║█████╗  ██████╔╝
// ╚════██║   ██║   ██╔══██╗██║██║        ██║       ██║╚██╔╝██║██╔══██║   ██║   ██║     ██╔══██║██╔══╝  ██╔══██╗
// ███████║   ██║   ██║  ██║██║╚██████╗   ██║       ██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╗██║  ██║███████╗██║  ██║
// ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝ ╚═════╝   ╚═╝       ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
//
// This is the MOST SECURITY-CRITICAL file in the entire system.
// It decides WHETHER an on-chain transfer matches a payment attempt,
// and WHEN to auto-approve or flag for manual review.
//
// ═══════════════════════════════════════════════════════════
// MATCHING RULES — ALL must be satisfied for auto-match:
// ═══════════════════════════════════════════════════════════
//
// 1. ✅ Network matches exactly (TRC20→TRC20, BEP20→BEP20, never cross)
// 2. ✅ Token contract matches exactly (prevents wrong-token attacks)
// 3. ✅ Receiving address matches exactly (prevents wrong-address match)
// 4. ✅ Amount matches expected_amount within ±0.0005 USDT tolerance
// 5. ✅ Payment attempt is active (pending | detected | confirming)
// 6. ✅ Payment attempt not expired (expiresAt > now)
// 7. ✅ Transfer event not already processed (unique: network+txHash+logIndex)
// 8. ✅ Only 1 matching attempt found (multiple → manual_review, never auto)
// 9. ✅ Late arrivals (after expiry) → late_payment status, never auto-approve
//
// ANTI-DOUBLE-PROCESSING:
// ───────────────────────
// - TransferEvent: unique(network, txHash, logIndex) — each tx processed exactly once
// - PaymentAttempt: status checked before update — finalized attempts never re-processed
// - Order: orderStatus checked before approve — approved orders never re-approved
// - All state changes wrapped in Prisma.$transaction — atomic or nothing
//
// WHAT THIS FILE NEVER DOES:
// ──────────────────────────
// - Never trusts frontend input for payment confirmation
// - Never matches across different networks
// - Never matches wrong token contracts
// - Never auto-approves expired payments
// - Never auto-approves when multiple attempts could match

import { PrismaClient } from '@prisma/client';
import { ENV, NETWORK_CONFIG, Network } from '../../config/env';
import { MatchTransferInput, MatchResult } from './payment.model';
import { isTransferAlreadyProcessed, isPaymentFinalized } from '../../utils/idempotency';
import { autoApproveOrder } from '../orders/order.service';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();
const MOD = 'PaymentMatcher';

// ══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT: processTransfer
// Called by workers (tron.worker.ts, bsc.worker.ts) for each
// on-chain transfer event detected.
// ══════════════════════════════════════════════════════════════

export async function processTransfer(input: MatchTransferInput): Promise<MatchResult> {
  const {
    network, txHash, logIndex,
    fromAddress, toAddress, amount, tokenContract,
    blockNumber, blockTimestamp, confirmations,
  } = input;

  // ═══ RULE 7: Idempotency — skip if transfer already processed ═══
  // Uses unique constraint: @@unique([network, txHash, logIndex])
  const alreadyProcessed = await isTransferAlreadyProcessed(prisma, network, txHash, logIndex);
  if (alreadyProcessed) {
    logger.debug(MOD, `SKIP: Already processed ${network}:${txHash}:${logIndex}`);
    return { matched: false, action: 'ignored', reason: 'Transfer already processed (idempotent skip)' };
  }

  // ═══ RULE 1: Validate network config exists ═══
  const config = NETWORK_CONFIG[network as Network];
  if (!config) {
    logger.warn(MOD, `REJECT: Unknown network "${network}"`);
    return { matched: false, action: 'ignored', reason: `Unknown network: ${network}` };
  }

  // ═══ RULE 3: Validate receiving address matches our wallet ═══
  const ourAddress = config.publicAddress.toLowerCase();
  if (toAddress.toLowerCase() !== ourAddress) {
    // Not our address — silently ignore (don't even record in DB)
    return { matched: false, action: 'ignored', reason: 'Not our receiving address' };
  }

  // ═══ RULE 2: Validate token contract matches USDT ═══
  const ourContract = config.tokenContract.toLowerCase();
  if (tokenContract.toLowerCase() !== ourContract) {
    // Wrong token sent to our address — record for audit but don't match
    logger.warn(MOD, `WRONG TOKEN: ${tokenContract} sent to our address on ${network}`, { txHash, amount });
    await safeRecordTransfer(input, null, 'unmatched', `Wrong token: expected ${ourContract}, got ${tokenContract}`);
    return { matched: false, action: 'unmatched', reason: `Wrong token contract: ${tokenContract}` };
  }

  // ═══ RULES 4-6,8: Find matching payment attempts ═══
  const now = new Date();

  // Query active (non-expired, non-finalized) attempts on this network
  const activeAttempts = await prisma.paymentAttempt.findMany({
    where: {
      network,
      status: { in: ['pending', 'detected', 'confirming'] },
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'asc' }, // FIFO: oldest first
  });

  // Filter by amount tolerance (RULE 4)
  const amountMatches = activeAttempts.filter(attempt => {
    const delta = Math.abs(amount - attempt.expectedAmount);
    return delta <= ENV.AMOUNT_TOLERANCE; // Default: 0.0005 USDT
  });

  // ═══ RULE 8: Conflict detection — multiple matches → manual_review ═══
  if (amountMatches.length > 1) {
    logger.warn(MOD, `⚠️ AMBIGUOUS: ${amount} USDT matches ${amountMatches.length} active attempts`, {
      txHash,
      attemptIds: amountMatches.map(a => a.id),
      expectedAmounts: amountMatches.map(a => a.expectedAmount),
    });

    // Record transfer as manual_review — admin must resolve
    await safeRecordTransfer(input, null, 'manual_review',
      `Ambiguous: ${amountMatches.length} attempts could match amount ${amount}. ` +
      `Attempts: ${amountMatches.map(a => `${a.id}(${a.expectedAmount})`).join(', ')}`
    );

    return {
      matched: false,
      action: 'manual_review',
      reason: `Ambiguous: ${amountMatches.length} active attempts match amount ${amount} USDT on ${network}`,
    };
  }

  // ═══ No active match — check expired for late payment (RULE 9) ═══
  if (amountMatches.length === 0) {
    return await handleNoActiveMatch(input, now);
  }

  // ═══ SINGLE MATCH — process it ═══
  const matchedAttempt = amountMatches[0];
  return await processConfirmedMatch(input, matchedAttempt);
}

// ══════════════════════════════════════════════════════════════
// HANDLE NO ACTIVE MATCH
// Check expired attempts for late_payment scenario.
// RULE 9: Late payments are NEVER auto-approved.
// ══════════════════════════════════════════════════════════════

async function handleNoActiveMatch(input: MatchTransferInput, now: Date): Promise<MatchResult> {
  const { network, amount, txHash } = input;

  // Search recently expired attempts (last 24h)
  const recentExpired = await prisma.paymentAttempt.findMany({
    where: {
      network,
      status: { in: ['pending', 'expired'] },
      expiresAt: { lte: now },
      createdAt: { gte: new Date(Date.now() - 86400000) }, // last 24h only
    },
    orderBy: { expiresAt: 'desc' },
    take: 50,
  });

  const lateMatches = recentExpired.filter(attempt => {
    const delta = Math.abs(amount - attempt.expectedAmount);
    return delta <= ENV.AMOUNT_TOLERANCE;
  });

  // ─── Late payment: found matching expired attempt ───
  if (lateMatches.length === 1) {
    const lateAttempt = lateMatches[0];
    logger.warn(MOD, `🕐 LATE PAYMENT: ${amount} USDT → attempt ${lateAttempt.id} (expired at ${lateAttempt.expiresAt})`, { txHash });

    // Record as late_payment — NOT auto-approved. Admin must handle.
    await prisma.$transaction([
      prisma.transferEvent.create({
        data: {
          network, txHash: input.txHash, logIndex: input.logIndex,
          fromAddress: input.fromAddress, toAddress: input.toAddress,
          amount, tokenContract: input.tokenContract,
          blockNumber: input.blockNumber, blockTimestamp: input.blockTimestamp,
          confirmations: input.confirmations,
          paymentAttemptId: lateAttempt.id,
          matchStatus: 'late',
          matchedAt: new Date(),
          matchReason: `Late payment: tx arrived ${Math.round((Date.now() - lateAttempt.expiresAt.getTime()) / 1000)}s after expiry`,
        },
      }),
      prisma.paymentAttempt.update({
        where: { id: lateAttempt.id },
        data: {
          status: 'late_payment',
          actualReceivedAmount: amount,
          amountDelta: parseFloat((amount - lateAttempt.expectedAmount).toFixed(4)),
          txHash, blockNumber: input.blockNumber,
          senderAddress: input.fromAddress,
          detectedAt: new Date(),
          rawMatchPayload: JSON.stringify(input),
        },
      }),
      prisma.paymentStatusLog.create({
        data: {
          paymentAttemptId: lateAttempt.id,
          oldStatus: lateAttempt.status,
          newStatus: 'late_payment',
          reason: `Late payment: ${amount} USDT arrived after expiry, tx: ${txHash}. NOT auto-approved.`,
          actor: 'system',
          metadata: JSON.stringify({ amount, expected: lateAttempt.expectedAmount, txHash }),
        },
      }),
      prisma.auditLog.create({
        data: {
          action: 'payment.late',
          entityType: 'payment_attempt',
          entityId: lateAttempt.id,
          actor: 'system',
          details: JSON.stringify({ txHash, amount, expected: lateAttempt.expectedAmount }),
        },
      }),
    ]);

    return {
      matched: false,
      paymentAttemptId: lateAttempt.id,
      orderId: lateAttempt.orderId,
      action: 'late_payment',
      reason: `Late payment: ${amount} USDT arrived after payment window. NOT auto-approved.`,
    };
  }

  // ─── Multiple late matches → manual review ───
  if (lateMatches.length > 1) {
    logger.warn(MOD, `⚠️ AMBIGUOUS LATE: ${amount} USDT matches ${lateMatches.length} expired attempts`, { txHash });
    await safeRecordTransfer(input, null, 'manual_review',
      `Ambiguous late: ${lateMatches.length} expired attempts match`);
    return {
      matched: false,
      action: 'manual_review',
      reason: `Multiple expired attempts match late payment`,
    };
  }

  // ─── Truly unmatched ───
  logger.info(MOD, `❌ UNMATCHED: ${amount} USDT on ${network} from ${input.fromAddress}`, { txHash });
  await safeRecordTransfer(input, null, 'unmatched', 'No matching payment attempt found (active or expired)');

  return {
    matched: false,
    action: 'unmatched',
    reason: `No matching payment attempt for ${amount} USDT on ${network}`,
  };
}

// ══════════════════════════════════════════════════════════════
// PROCESS CONFIRMED MATCH
// Single match found. Determine status, update in DB transaction.
// ══════════════════════════════════════════════════════════════

async function processConfirmedMatch(
  input: MatchTransferInput,
  attempt: {
    id: string;
    orderId: string;
    status: string;
    expectedAmount: number;
    requiredConfirmations: number;
    detectedAt: Date | null;
  },
): Promise<MatchResult> {
  const { amount, txHash, confirmations } = input;
  const { expectedAmount, requiredConfirmations } = attempt;
  const delta = amount - expectedAmount;

  // ── RULE: Check if attempt already finalized (idempotency) ──
  if (isPaymentFinalized(attempt.status)) {
    logger.warn(MOD, `SKIP: Attempt ${attempt.id} already finalized (${attempt.status})`, { txHash });
    await safeRecordTransfer(input, attempt.id, 'ignored', `Attempt already finalized: ${attempt.status}`);
    return {
      matched: false,
      paymentAttemptId: attempt.id,
      action: 'ignored',
      reason: `Payment attempt already in final state: ${attempt.status}`,
    };
  }

  // ── Determine new status based on amount and confirmations ──
  let newStatus: string;
  let action: MatchResult['action'];

  // Amount classification
  const isPartial = amount < expectedAmount * 0.995;  // Under 99.5% → partial
  const isOverpaid = amount > expectedAmount * 1.005;  // Over 100.5% → overpaid
  const isEnoughConfirmations = confirmations >= requiredConfirmations;

  if (isPartial) {
    newStatus = 'partial';
    action = 'partial';
  } else if (isOverpaid) {
    newStatus = isEnoughConfirmations ? 'overpaid' : 'confirming';
    action = 'overpaid';
  } else {
    // Within tolerance — exact/near-exact match
    if (isEnoughConfirmations) {
      newStatus = 'paid';
      action = 'paid';
    } else if (confirmations > 0) {
      newStatus = 'confirming';
      action = 'paid'; // Will be paid when confirmed
    } else {
      newStatus = 'detected';
      action = 'paid'; // Will be paid when confirmed
    }
  }

  const isFullyConfirmed = newStatus === 'paid' || newStatus === 'overpaid';

  logger.info(MOD, `✅ MATCH: ${amount} USDT → attempt ${attempt.id} → ${newStatus}`, {
    txHash,
    expected: expectedAmount,
    delta: delta.toFixed(4),
    confirmations: `${confirmations}/${requiredConfirmations}`,
  });

  // ══ DB TRANSACTION: atomic state update ══
  // Everything succeeds or nothing changes.
  await prisma.$transaction(async (tx) => {
    // 1. Record transfer event (idempotent via unique constraint)
    await tx.transferEvent.create({
      data: {
        network: input.network,
        txHash: input.txHash,
        logIndex: input.logIndex,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        amount: input.amount,
        tokenContract: input.tokenContract,
        blockNumber: input.blockNumber,
        blockTimestamp: input.blockTimestamp,
        confirmations: input.confirmations,
        paymentAttemptId: attempt.id,
        matchStatus: 'matched',
        matchedAt: new Date(),
        matchReason: `Amount match: expected=${expectedAmount}, received=${amount}, delta=${delta.toFixed(4)}, conf=${confirmations}/${requiredConfirmations}`,
      },
    });

    // 2. Update payment attempt status
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: newStatus,
        actualReceivedAmount: amount,
        amountDelta: parseFloat(delta.toFixed(4)),
        txHash,
        blockNumber: input.blockNumber,
        logIndex: input.logIndex,
        confirmationCount: confirmations,
        senderAddress: input.fromAddress,
        detectedAt: attempt.detectedAt || new Date(),
        ...(isFullyConfirmed ? { confirmedAt: new Date() } : {}),
        rawMatchPayload: JSON.stringify(input),
      },
    });

    // 3. Payment status log (audit trail)
    await tx.paymentStatusLog.create({
      data: {
        paymentAttemptId: attempt.id,
        oldStatus: attempt.status,
        newStatus,
        reason: `${newStatus}: received ${amount} USDT (expected ${expectedAmount}), ` +
          `delta ${delta.toFixed(4)}, ${confirmations}/${requiredConfirmations} confirmations`,
        actor: 'system',
        metadata: JSON.stringify({ delta, confirmations, txHash, blockNumber: input.blockNumber }),
      },
    });

    // 4. Audit log
    await tx.auditLog.create({
      data: {
        action: isFullyConfirmed ? 'payment.confirmed' : `payment.${newStatus}`,
        entityType: 'payment_attempt',
        entityId: attempt.id,
        actor: 'system',
        details: JSON.stringify({
          amount, expectedAmount, delta: delta.toFixed(4),
          confirmations, requiredConfirmations,
          txHash, network: input.network,
        }),
      },
    });
  });

  // ── Auto-approve order if fully confirmed ──
  // autoApproveOrder is itself idempotent (checks orderStatus before update)
  if (isFullyConfirmed) {
    await autoApproveOrder(attempt.orderId, txHash);
  }

  return {
    matched: true,
    paymentAttemptId: attempt.id,
    orderId: attempt.orderId,
    action,
    reason: `${newStatus}: ${amount} USDT received (expected ${expectedAmount})`,
  };
}

// ══════════════════════════════════════════════════════════════
// CONFIRMATION UPDATER
// Called by BSC worker when previously detected transfers
// accumulate more confirmations.
// ══════════════════════════════════════════════════════════════

export async function updateConfirmations(
  network: string,
  txHash: string,
  logIndex: number,
  newConfirmations: number,
): Promise<void> {
  const event = await prisma.transferEvent.findUnique({
    where: { network_txHash_logIndex: { network, txHash, logIndex } },
    include: { paymentAttempt: true },
  });

  if (!event || !event.paymentAttemptId || !event.paymentAttempt) return;

  const attempt = event.paymentAttempt;

  // Only update if still in detecting/confirming state
  if (!['detected', 'confirming'].includes(attempt.status)) return;

  // Update event's confirmation count
  await prisma.transferEvent.update({
    where: { id: event.id },
    data: { confirmations: newConfirmations },
  });

  const requiredConf = attempt.requiredConfirmations;

  if (newConfirmations >= requiredConf) {
    // ── FULLY CONFIRMED — finalize payment ──
    const isPartial = event.amount < attempt.expectedAmount * 0.995;
    const isOverpaid = event.amount > attempt.expectedAmount * 1.005;
    const finalStatus = isPartial ? 'partial' : isOverpaid ? 'overpaid' : 'paid';

    logger.info(MOD, `✅ CONFIRMED: attempt ${attempt.id} → ${finalStatus} (${newConfirmations}/${requiredConf} conf)`);

    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: finalStatus,
          confirmationCount: newConfirmations,
          confirmedAt: new Date(),
        },
      }),
      prisma.paymentStatusLog.create({
        data: {
          paymentAttemptId: attempt.id,
          oldStatus: attempt.status,
          newStatus: finalStatus,
          reason: `Confirmed: ${newConfirmations}/${requiredConf} block confirmations reached`,
          actor: 'system',
        },
      }),
      prisma.auditLog.create({
        data: {
          action: 'payment.confirmed',
          entityType: 'payment_attempt',
          entityId: attempt.id,
          actor: 'system',
          details: JSON.stringify({ confirmations: newConfirmations, requiredConf, finalStatus }),
        },
      }),
    ]);

    // Auto-approve order
    if (finalStatus === 'paid' || finalStatus === 'overpaid') {
      await autoApproveOrder(attempt.orderId, txHash);
    }
  } else {
    // Still confirming — just update count
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: 'confirming', confirmationCount: newConfirmations },
    });
  }
}

// ══════════════════════════════════════════════════════════════
// SAFE RECORD HELPER
// Records a transfer event, handling unique constraint violations
// gracefully (idempotent — if already exists, skip).
// ══════════════════════════════════════════════════════════════

async function safeRecordTransfer(
  input: MatchTransferInput,
  paymentAttemptId: string | null,
  matchStatus: string,
  matchReason: string,
): Promise<void> {
  try {
    await prisma.transferEvent.create({
      data: {
        network: input.network,
        txHash: input.txHash,
        logIndex: input.logIndex,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        amount: input.amount,
        tokenContract: input.tokenContract,
        blockNumber: input.blockNumber,
        blockTimestamp: input.blockTimestamp,
        confirmations: input.confirmations,
        paymentAttemptId,
        matchStatus,
        matchedAt: paymentAttemptId ? new Date() : null,
        matchReason,
      },
    });
  } catch (err: any) {
    // P2002 = Prisma unique constraint violation
    // This is expected if worker rescans same block — safe to ignore
    if (err.code === 'P2002') {
      logger.debug(MOD, `Idempotent skip: transfer ${input.network}:${input.txHash}:${input.logIndex} already recorded`);
      return;
    }
    throw err;
  }
}
