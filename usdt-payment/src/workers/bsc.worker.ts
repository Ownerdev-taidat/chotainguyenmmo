// ===== FILE: src/workers/bsc.worker.ts =====
//
// BSC BEP20 USDT Worker
// Polls BSC node for Transfer event logs, matches to payment attempts.
// Uses block-range scanning with checkpoint.
//
// Features:
// - Block-based checkpoint (resumable)
// - Max 1000 blocks per query (BSC RPC limit)
// - Confirmation tracking
// - Idempotent processing

import { PrismaClient } from '@prisma/client';
import { fetchBEP20Transfers, getBscBlockNumber } from '../modules/blockchain/bsc.service';
import { processTransfer, updateConfirmations } from '../modules/payments/payment-matcher.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
const MOD = 'BscWorker';

/**
 * Run one scan cycle for BEP20 USDT.
 */
export async function scanBEP20Cycle(): Promise<void> {
  try {
    // Get current block
    const currentBlock = await getBscBlockNumber();

    // Get or create checkpoint
    let checkpoint = await prisma.watcherCheckpoint.findUnique({
      where: { network: 'BEP20' },
    });

    if (!checkpoint) {
      // Start from current block minus small buffer
      checkpoint = await prisma.watcherCheckpoint.create({
        data: { network: 'BEP20', lastBlock: Math.max(0, currentBlock - 100) },
      });
    }

    const fromBlock = checkpoint.lastBlock + 1;
    const toBlock = Math.min(fromBlock + 999, currentBlock); // Max 1000 blocks

    if (fromBlock > currentBlock) return; // Already caught up

    // Fetch transfers
    const transfers = await fetchBEP20Transfers(fromBlock, toBlock);

    if (transfers.length > 0) {
      logger.info(MOD, `Found ${transfers.length} BEP20 transfers in blocks ${fromBlock}-${toBlock}`);
    }

    for (const tx of transfers) {
      try {
        const result = await processTransfer({
          network: 'BEP20',
          txHash: tx.txHash,
          logIndex: tx.logIndex,
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

        // If not enough confirmations yet, it will be updated in future cycles
        if (tx.confirmations < 15 && result.matched) {
          logger.info(MOD, `⏳ Waiting for confirmations: ${tx.confirmations}/15`);
        }
      } catch (err) {
        logger.error(MOD, `Error processing tx ${tx.txHash}`, err);
      }
    }

    // Update checkpoint
    await prisma.watcherCheckpoint.update({
      where: { network: 'BEP20' },
      data: { lastBlock: toBlock, lastScanAt: new Date() },
    });

    // Also check for confirmation updates on previously detected transfers
    await updatePendingConfirmations(currentBlock);
  } catch (error) {
    logger.error(MOD, 'Scan cycle error', error);
  }
}

/**
 * Update confirmations for transfers that were detected but not yet confirmed.
 */
async function updatePendingConfirmations(currentBlock: number) {
  const pendingEvents = await prisma.transferEvent.findMany({
    where: {
      network: 'BEP20',
      matchStatus: 'matched',
      paymentAttempt: {
        status: { in: ['detected', 'confirming'] },
      },
    },
    include: { paymentAttempt: true },
  });

  for (const event of pendingEvents) {
    const newConf = Math.max(0, currentBlock - event.blockNumber);
    if (newConf > event.confirmations) {
      await updateConfirmations('BEP20', event.txHash, event.logIndex, newConf);
    }
  }
}
