// ===== FILE: src/jobs/reconciliation.job.ts =====
//
// Reconciliation Job
// Runs periodically to catch any missed transactions or stuck payments.
//
// Tasks:
// 1. Expire old pending payment attempts
// 2. Re-scan recent blocks for missed transfers
// 3. Check for stuck 'detected' payments that need confirmation updates
// 4. Flag unmatched transfers for manual review

import { PrismaClient } from '@prisma/client';
import { expireOldAttempts } from '../modules/payments/payment.service';
import { scanTRC20Cycle } from '../workers/tron.worker';
import { scanBEP20Cycle } from '../workers/bsc.worker';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const MOD = 'ReconciliationJob';

/**
 * Run full reconciliation.
 */
export async function runReconciliation(): Promise<{
  expired: number;
  unmatchedTransfers: number;
  stuckPayments: number;
}> {
  const jobId = `recon_${Date.now()}`;
  logger.info(MOD, `Starting reconciliation: ${jobId}`);

  // Record job
  const job = await prisma.reconciliationJob.create({
    data: {
      type: 'full_scan',
      status: 'running',
      startedAt: new Date(),
    },
  });

  try {
    // 1. Expire old attempts
    await expireOldAttempts();

    // 2. Re-scan blockchains
    await scanTRC20Cycle();
    await scanBEP20Cycle();

    // 3. Check for stuck 'detected' payments (older than 10 minutes without confirmation update)
    const stuckPayments = await prisma.paymentAttempt.findMany({
      where: {
        status: { in: ['detected', 'confirming'] },
        detectedAt: { lt: new Date(Date.now() - 600000) }, // > 10 min ago
      },
    });

    for (const attempt of stuckPayments) {
      logger.warn(MOD, `Stuck payment: ${attempt.id} (${attempt.status} since ${attempt.detectedAt})`);
      // Don't auto-expire — just flag for monitoring
    }

    // 4. Count unmatched transfers
    const unmatchedTransfers = await prisma.transferEvent.count({
      where: { matchStatus: 'unmatched' },
    });

    // 5. Count expired
    const expiredCount = await prisma.paymentAttempt.count({
      where: {
        status: 'expired',
        updatedAt: { gte: new Date(Date.now() - 3600000) },
      },
    });

    const result = {
      expired: expiredCount,
      unmatchedTransfers,
      stuckPayments: stuckPayments.length,
    };

    // Update job
    await prisma.reconciliationJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: JSON.stringify(result),
      },
    });

    logger.info(MOD, `Reconciliation complete`, result);
    return result;
  } catch (error) {
    await prisma.reconciliationJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        result: JSON.stringify({ error: (error as Error).message }),
      },
    });
    logger.error(MOD, 'Reconciliation failed', error);
    throw error;
  }
}
