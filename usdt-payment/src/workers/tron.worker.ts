// ===== FILE: src/workers/tron.worker.ts =====
//
// TRON TRC20 USDT Worker
// Polls TronGrid for incoming transfers, matches to payment attempts.
// Runs as part of the main watcher process.
//
// Features:
// - Checkpoint-based scanning (resumable)
// - Idempotent transfer processing
// - Safe restart: resumes from last checkpoint
// - Structured logging

import { PrismaClient } from '@prisma/client';
import { fetchTRC20Transfers } from '../modules/blockchain/tron.service';
import { processTransfer, updateConfirmations } from '../modules/payments/payment-matcher.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const MOD = 'TronWorker';

/**
 * Run one scan cycle for TRC20 USDT.
 */
export async function scanTRC20Cycle(): Promise<void> {
  try {
    // Get or create checkpoint
    let checkpoint = await prisma.watcherCheckpoint.findUnique({
      where: { network: 'TRC20' },
    });

    if (!checkpoint) {
      checkpoint = await prisma.watcherCheckpoint.create({
        data: { network: 'TRC20', lastBlock: 0 },
      });
    }

    // Fetch transfers since last scan
    const minTimestamp = checkpoint.lastScanAt.getTime();
    const transfers = await fetchTRC20Transfers(minTimestamp);

    if (transfers.length === 0) {
      // Update scan time even with no transfers
      await prisma.watcherCheckpoint.update({
        where: { network: 'TRC20' },
        data: { lastScanAt: new Date() },
      });
      return;
    }

    logger.info(MOD, `Found ${transfers.length} TRC20 transfers`);

    let maxTimestamp = minTimestamp;

    for (const tx of transfers) {
      try {
        const result = await processTransfer({
          network: 'TRC20',
          txHash: tx.txHash,
          logIndex: 0, // TRC20 transfers don't have logIndex, use 0
          fromAddress: tx.fromAddress,
          toAddress: tx.toAddress,
          amount: tx.amount,
          tokenContract: tx.tokenContract,
          blockNumber: tx.blockNumber,
          blockTimestamp: tx.blockTimestamp,
          confirmations: tx.confirmations,
        });

        if (result.matched) {
          logger.info(MOD, `✅ Matched: ${tx.amount} USDT → ${result.paymentAttemptId}`);
        }

        // Track max timestamp
        if (tx.blockTimestamp.getTime() > maxTimestamp) {
          maxTimestamp = tx.blockTimestamp.getTime();
        }
      } catch (err) {
        logger.error(MOD, `Error processing tx ${tx.txHash}`, err);
      }
    }

    // Update checkpoint
    await prisma.watcherCheckpoint.update({
      where: { network: 'TRC20' },
      data: {
        lastScanAt: new Date(maxTimestamp),
      },
    });
  } catch (error) {
    logger.error(MOD, 'Scan cycle error', error);
  }
}
