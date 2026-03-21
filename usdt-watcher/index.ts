/**
 * USDT Blockchain Watcher — Standalone Worker
 * =============================================
 * THE SINGLE SOURCE OF TRUTH FOR:
 *   1. Scanning blockchain for incoming USDT transfers
 *   2. Matching transfers to pending deposits
 *   3. Crediting user wallets
 *
 * NO OTHER CODE PATH SHOULD CREDIT WALLETS FOR USDT DEPOSITS.
 *
 * Architecture:
 *   - Runs on VPS as independent process (PM2/systemd)
 *   - Connects directly to Railway PostgreSQL via DATABASE_URL
 *   - Scans TRON (TronGrid API) and BSC (JSON-RPC) every 10s
 *   - Uses idempotent processing (unique constraint on transfer events)
 *   - Uses approvedAt flag to prevent double-credit
 *
 * Run: npx ts-node usdt-watcher/index.ts
 * PM2: pm2 start "npx ts-node usdt-watcher/index.ts" --name usdt-watcher
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════

const TRON_PUBLIC_ADDRESS = process.env.TRON_PUBLIC_ADDRESS || 'TTmNqZhW4PkDXpPaTiSXzLnoWMdWf5xSp8';
const BSC_PUBLIC_ADDRESS  = process.env.BSC_PUBLIC_ADDRESS  || '0x66846F8135B3a521e924D1960d90F4C4aF844817';

const TRC20_USDT_CONTRACT = process.env.TRC20_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const BEP20_USDT_CONTRACT = (process.env.BEP20_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955').toLowerCase();

const BSC_RPC_URL   = process.env.BSC_RPC_URL    || 'https://bsc-dataseed.bnbchain.org';
const TRONGRID_API  = process.env.TRON_FULL_HOST  || 'https://api.trongrid.io';

const POLL_INTERVAL_MS = parseInt(process.env.USDT_POLL_INTERVAL || '15000'); // 15 seconds

// ══════════════════════════════════════════════
// INTEGER-SAFE AMOUNT UTILITIES
// ══════════════════════════════════════════════

/**
 * Convert USDT float to milli-USDT integer (×1000).
 * All amount comparisons use this to avoid JavaScript float precision bugs.
 *
 * Examples: 10.047 → 10047,  5.023 → 5023,  1.099 → 1099
 */
function toMilliUsdt(amount: number): number {
    return Math.round(amount * 1000);
}

/**
 * Integer-safe USDT amount comparison.
 * Default tolerance = 0 (EXACT match) since we generate 3-decimal amounts
 * and blockchain returns exact values. No fuzzy matching needed.
 */
function amountMatchesSafe(a: number, b: number, tolerance: number = 0): boolean {
    return Math.abs(toMilliUsdt(a) - toMilliUsdt(b)) <= tolerance;
}

console.log('[USDT Watcher] Starting...');
console.log(`  TRON Address: ${TRON_PUBLIC_ADDRESS}`);
console.log(`  BSC Address:  ${BSC_PUBLIC_ADDRESS}`);
console.log(`  Poll interval: ${POLL_INTERVAL_MS}ms`);

// ══════════════════════════════════════════════
// TRC20 SCANNER (TRON)
// ══════════════════════════════════════════════

async function scanTRC20(): Promise<void> {
    try {
        let checkpoint = await prisma.usdtScanCheckpoint.findUnique({
            where: { network: 'TRC20' },
        });
        if (!checkpoint) {
            checkpoint = await prisma.usdtScanCheckpoint.create({
                data: { network: 'TRC20', lastBlock: 0 },
            });
        }

        const minTimestamp = checkpoint.lastScanAt.getTime();
        const url = `${TRONGRID_API}/v1/accounts/${TRON_PUBLIC_ADDRESS}/transactions/trc20?` +
            `only_to=true&limit=50&min_timestamp=${minTimestamp}&contract_address=${TRC20_USDT_CONTRACT}`;

        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                ...(process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {}),
            },
        });

        if (!res.ok) {
            console.error(`[TRC20] API error: ${res.status} ${res.statusText}`);
            return;
        }

        const data: any = await res.json();
        const transfers = data?.data || [];

        let maxTimestamp = minTimestamp;

        if (transfers.length > 0) {
            console.log(`[TRC20] Found ${transfers.length} transfers`);
        }

        for (const tx of transfers) {
            try {
                const txHash = tx.transaction_id;
                const fromAddress = tx.from;
                const toAddress = tx.to;
                const tokenContract = tx.token_info?.address || '';
                const rawAmount = parseInt(tx.value || '0');
                const decimals = parseInt(tx.token_info?.decimals || '6');
                const amount = rawAmount / Math.pow(10, decimals);
                const blockTimestamp = tx.block_timestamp ? new Date(tx.block_timestamp) : undefined;

                if (tx.block_timestamp && tx.block_timestamp > maxTimestamp) {
                    maxTimestamp = tx.block_timestamp;
                }

                // Validate: must be to our address, must be USDT contract
                if (toAddress.toLowerCase() !== TRON_PUBLIC_ADDRESS.toLowerCase()) continue;
                if (tokenContract !== TRC20_USDT_CONTRACT) continue;
                if (amount <= 0) continue;

                await processTransfer({
                    network: 'TRC20',
                    txHash,
                    logIndex: 0,
                    fromAddress,
                    toAddress,
                    amount,
                    tokenContract,
                    blockNumber: 0,
                    blockTimestamp,
                });
            } catch (err) {
                console.error(`[TRC20] Error processing tx:`, err);
            }
        }

        await prisma.usdtScanCheckpoint.update({
            where: { network: 'TRC20' },
            data: { lastScanAt: new Date(maxTimestamp || Date.now()) },
        });
    } catch (error) {
        console.error('[TRC20] Scan error:', error);
    }
}

// ══════════════════════════════════════════════
// BEP20 SCANNER (BSC / BNB Chain)
// ══════════════════════════════════════════════

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function scanBEP20(): Promise<void> {
    try {
        let checkpoint = await prisma.usdtScanCheckpoint.findUnique({
            where: { network: 'BEP20' },
        });

        const currentBlockRes = await rpcCall('eth_blockNumber', []);
        const currentBlock = parseInt(currentBlockRes, 16);

        if (!checkpoint) {
            checkpoint = await prisma.usdtScanCheckpoint.create({
                data: { network: 'BEP20', lastBlock: currentBlock - 100 },
            });
        }

        const fromBlock = checkpoint.lastBlock + 1;
        const toBlock = Math.min(fromBlock + 199, currentBlock); // 200 blocks max (public RPC limit)

        if (fromBlock > currentBlock) return;

        const paddedAddress = '0x' + BSC_PUBLIC_ADDRESS.slice(2).toLowerCase().padStart(64, '0');

        const logs = await rpcCall('eth_getLogs', [{
            fromBlock: '0x' + fromBlock.toString(16),
            toBlock: '0x' + toBlock.toString(16),
            address: BEP20_USDT_CONTRACT,
            topics: [TRANSFER_TOPIC, null, paddedAddress],
        }]);

        if (logs && logs.length > 0) {
            console.log(`[BEP20] Found ${logs.length} transfer logs in blocks ${fromBlock}-${toBlock}`);
        }

        for (const log of (logs || [])) {
            try {
                const txHash = log.transactionHash;
                const logIndex = parseInt(log.logIndex, 16);
                const blockNumber = parseInt(log.blockNumber, 16);
                const fromAddress = '0x' + log.topics[1].slice(26);
                const toAddress = '0x' + log.topics[2].slice(26);
                const rawAmount = BigInt(log.data);
                // BSC USDT (0x55d398...) has 18 decimals
                const amount = Number(rawAmount) / 1e18;

                if (amount <= 0) continue;

                let blockTimestamp: Date | undefined;
                try {
                    const block = await rpcCall('eth_getBlockByNumber', ['0x' + blockNumber.toString(16), false]);
                    if (block?.timestamp) {
                        blockTimestamp = new Date(parseInt(block.timestamp, 16) * 1000);
                    }
                } catch { /* non-critical */ }

                await processTransfer({
                    network: 'BEP20',
                    txHash,
                    logIndex,
                    fromAddress,
                    toAddress,
                    amount,
                    tokenContract: BEP20_USDT_CONTRACT,
                    blockNumber,
                    blockTimestamp,
                });
            } catch (err) {
                console.error(`[BEP20] Error processing log:`, err);
            }
        }

        await prisma.usdtScanCheckpoint.update({
            where: { network: 'BEP20' },
            data: { lastBlock: toBlock, lastScanAt: new Date() },
        });
    } catch (error) {
        console.error('[BEP20] Scan error:', error);
    }
}

// ── BSC JSON-RPC helper ──
let rpcId = 1;
async function rpcCall(method: string, params: any[]): Promise<any> {
    const res = await fetch(BSC_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
    });
    const data: any = await res.json();
    if (data.error) throw new Error(`RPC ${method}: ${data.error.message}`);
    return data.result;
}

// ══════════════════════════════════════════════
// TRANSFER PROCESSING (heart of the system)
// ══════════════════════════════════════════════

interface TransferParams {
    network: string;
    txHash: string;
    logIndex: number;
    fromAddress: string;
    toAddress: string;
    amount: number;
    tokenContract: string;
    blockNumber: number;
    blockTimestamp?: Date;
}

/**
 * Process an incoming USDT transfer.
 *
 * IDEMPOTENCY LAYERS:
 *   1. UsdtTransferEvent unique constraint (network, txHash, logIndex)
 *   2. Deposit.approvedAt null-check before crediting
 *   3. Batch transaction for event + status update
 *
 * MATCHING RULES (strict):
 *   1. Network must match deposit.network
 *   2. Amount must match within ±0.002 USDT (integer comparison)
 *   3. Deposit must be PENDING and not expired
 *   4. First match wins (FIFO by createdAt)
 *   5. If ambiguous (multiple matches within tolerance) → MANUAL_REVIEW
 */
async function processTransfer(params: TransferParams): Promise<void> {
    // ── LAYER 1: Idempotency — skip if already processed ──
    try {
        const existing = await prisma.usdtTransferEvent.findUnique({
            where: {
                network_txHash_logIndex: {
                    network: params.network,
                    txHash: params.txHash,
                    logIndex: params.logIndex,
                },
            },
        });
        if (existing) return; // Already processed — safe to skip
    } catch { /* unique check failed, proceed with caution */ }

    // ── Find matching pending deposit ──
    const now = new Date();
    const pendingDeposits = await prisma.deposit.findMany({
        where: {
            method: 'USDT',
            network: params.network,
            status: 'PENDING',
            expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'asc' },
    });

    // Find ALL matches (to detect ambiguity)
    const matches: any[] = [];
    for (const dep of pendingDeposits) {
        if (!dep.usdtAmount) continue;
        if (amountMatchesSafe(params.amount, dep.usdtAmount, 0)) {
            matches.push(dep);
        }
    }

    // ── AMBIGUITY CHECK ──
    if (matches.length > 1) {
        console.warn(`[${params.network}] ⚠️ AMBIGUOUS: ${params.amount} USDT matches ${matches.length} deposits — sending to MANUAL_REVIEW`);
        // Record transfer as ambiguous, mark all matches for review
        try {
            await prisma.usdtTransferEvent.create({
                data: {
                    network: params.network,
                    txHash: params.txHash,
                    logIndex: params.logIndex,
                    fromAddress: params.fromAddress,
                    toAddress: params.toAddress,
                    amount: params.amount,
                    tokenContract: params.tokenContract,
                    blockNumber: params.blockNumber,
                    blockTimestamp: params.blockTimestamp,
                    matchStatus: 'ambiguous',
                },
            });
            // Mark all ambiguous deposits for manual review
            for (const dep of matches) {
                await prisma.deposit.update({
                    where: { id: dep.id },
                    data: { status: 'MANUAL_REVIEW' },
                });
            }
        } catch { /* unique constraint = already processed */ }
        return;
    }

    let matchedDeposit = matches.length === 1 ? matches[0] : null;

    // ── Check expired deposits for late payment ──
    if (!matchedDeposit) {
        const expiredDeposits = await prisma.deposit.findMany({
            where: {
                method: 'USDT',
                network: params.network,
                status: { in: ['PENDING', 'EXPIRED'] },
                expiresAt: { lte: now },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        for (const dep of expiredDeposits) {
            if (!dep.usdtAmount) continue;
            if (amountMatchesSafe(params.amount, dep.usdtAmount, 1)) {
                // Late payment — record but do NOT auto-approve
                console.log(`[${params.network}] LATE PAYMENT: ${params.amount} USDT → deposit ${dep.id}`);
                try {
                    await prisma.$transaction([
                        prisma.usdtTransferEvent.create({
                            data: {
                                network: params.network,
                                txHash: params.txHash,
                                logIndex: params.logIndex,
                                fromAddress: params.fromAddress,
                                toAddress: params.toAddress,
                                amount: params.amount,
                                tokenContract: params.tokenContract,
                                blockNumber: params.blockNumber,
                                blockTimestamp: params.blockTimestamp,
                                depositId: dep.id,
                                matchStatus: 'late',
                            },
                        }),
                        prisma.deposit.update({
                            where: { id: dep.id },
                            data: { status: 'LATE_PAYMENT' },
                        }),
                        prisma.usdtPaymentLog.create({
                            data: {
                                depositId: dep.id,
                                oldStatus: dep.status,
                                newStatus: 'LATE_PAYMENT',
                                reason: `Late payment: ${params.amount} USDT (expected ${dep.usdtAmount}), tx: ${params.txHash}`,
                                actor: 'system',
                                metadata: JSON.stringify({
                                    ...params,
                                    milliReceived: toMilliUsdt(params.amount),
                                    milliExpected: toMilliUsdt(dep.usdtAmount!),
                                }),
                            },
                        }),
                    ]);
                } catch { /* unique constraint = already processed */ }
                return;
            }
        }
    }

    // ── UNMATCHED transfer — record for manual review ──
    if (!matchedDeposit) {
        console.log(`[${params.network}] UNMATCHED: ${params.amount} USDT from ${params.fromAddress}`);
        try {
            await prisma.usdtTransferEvent.create({
                data: {
                    network: params.network,
                    txHash: params.txHash,
                    logIndex: params.logIndex,
                    fromAddress: params.fromAddress,
                    toAddress: params.toAddress,
                    amount: params.amount,
                    tokenContract: params.tokenContract,
                    blockNumber: params.blockNumber,
                    blockTimestamp: params.blockTimestamp,
                    matchStatus: 'unmatched',
                },
            });
        } catch { /* unique constraint = already processed */ }
        return;
    }

    // ── GUARD: Deposit must still be PENDING ──
    if (matchedDeposit.status !== 'PENDING') {
        console.log(`[${params.network}] Deposit ${matchedDeposit.id} already ${matchedDeposit.status}, skipping`);
        return;
    }

    // ══════════════════════════════════════════════
    // MATCHED! — Execute payment finalization
    // ══════════════════════════════════════════════

    const expectedMilli = toMilliUsdt(matchedDeposit.usdtAmount || 0);
    const receivedMilli = toMilliUsdt(params.amount);
    const isPartial = receivedMilli < expectedMilli;       // Any amount below expected
    const isOverpaid = receivedMilli > expectedMilli + 50; // More than 0.05 USDT over
    const newStatus = isPartial ? 'PARTIAL' : isOverpaid ? 'OVERPAID' : 'CONFIRMED';

    console.log(`[${params.network}] ✅ MATCHED: ${params.amount} USDT → deposit ${matchedDeposit.id} (${newStatus}, expected: ${matchedDeposit.usdtAmount}, milli: ${receivedMilli}/${expectedMilli})`);

    // ── Step 1: Record transfer + update deposit (atomic batch) ──
    try {
        await prisma.$transaction([
            // Record the blockchain transfer event (idempotent via unique constraint)
            prisma.usdtTransferEvent.create({
                data: {
                    network: params.network,
                    txHash: params.txHash,
                    logIndex: params.logIndex,
                    fromAddress: params.fromAddress,
                    toAddress: params.toAddress,
                    amount: params.amount,
                    tokenContract: params.tokenContract,
                    blockNumber: params.blockNumber,
                    blockTimestamp: params.blockTimestamp,
                    depositId: matchedDeposit.id,
                    matchStatus: 'matched',
                },
            }),

            // Update deposit status
            prisma.deposit.update({
                where: { id: matchedDeposit.id },
                data: {
                    status: newStatus,
                    usdtReceived: params.amount,
                    txHash: params.txHash,
                    blockNumber: params.blockNumber,
                    senderAddress: params.fromAddress,
                    detectedAt: new Date(),
                    ...(newStatus === 'CONFIRMED' ? {
                        confirmedAt: new Date(),
                        completedAt: new Date(),
                    } : {}),
                },
            }),

            // Audit log
            prisma.usdtPaymentLog.create({
                data: {
                    depositId: matchedDeposit.id,
                    oldStatus: 'PENDING',
                    newStatus,
                    reason: `${isPartial ? 'Partial' : isOverpaid ? 'Overpaid' : 'Full'} payment: received ${params.amount} (milli: ${receivedMilli}), expected ${matchedDeposit.usdtAmount} (milli: ${expectedMilli})`,
                    actor: 'system',
                    metadata: JSON.stringify({
                        txHash: params.txHash,
                        network: params.network,
                        amount: params.amount,
                        milliReceived: receivedMilli,
                        milliExpected: expectedMilli,
                        fromAddress: params.fromAddress,
                    }),
                },
            }),
        ]);
    } catch (err: any) {
        // Unique constraint violation = already processed (idempotent)
        if (err.code === 'P2002') {
            console.log(`[${params.network}] Transfer already processed (unique constraint), skipping`);
            return;
        }
        throw err; // Re-throw unexpected errors
    }

    // ── Step 2: Credit wallet (ONLY for CONFIRMED, with idempotency guard) ──
    if (newStatus === 'CONFIRMED') {
        await creditWallet(matchedDeposit.id, matchedDeposit.userId, matchedDeposit.amount, params.network);
    } else if (newStatus === 'PARTIAL') {
        console.log(`[${params.network}] ⚠️ Partial payment for deposit ${matchedDeposit.id}: received ${params.amount}, expected ${matchedDeposit.usdtAmount}`);
    } else if (newStatus === 'OVERPAID') {
        console.log(`[${params.network}] ⚠️ Overpaid deposit ${matchedDeposit.id}: received ${params.amount}, expected ${matchedDeposit.usdtAmount}. Needs manual review.`);
    }
}

// ══════════════════════════════════════════════
// WALLET CREDIT — SINGLE SOURCE OF TRUTH
// ══════════════════════════════════════════════

/**
 * Credit a user's wallet after confirmed USDT payment.
 *
 * IDEMPOTENCY:
 *   Checks deposit.approvedAt before crediting.
 *   If already approved → skip (no double credit).
 *   Sets approvedAt at the end to mark as done.
 *
 * This is the ONLY function in the entire system that credits wallets
 * for USDT deposits. No other code path should do this.
 */
async function creditWallet(
    depositId: string,
    userId: string,
    amountVnd: number,
    network: string,
): Promise<void> {
    try {
        // ── IDEMPOTENCY CHECK: already credited? ──
        const deposit = await prisma.deposit.findUnique({
            where: { id: depositId },
        });

        if (!deposit) {
            console.error(`[${network}] Cannot credit: deposit ${depositId} not found`);
            return;
        }
        if (deposit.approvedAt) {
            console.log(`[${network}] Deposit ${depositId} already credited (approvedAt: ${deposit.approvedAt}), skipping`);
            return;
        }
        if (deposit.status !== 'CONFIRMED') {
            console.log(`[${network}] Deposit ${depositId} status is ${deposit.status}, not CONFIRMED, skipping credit`);
            return;
        }

        // ── ALL-IN-ONE TRANSACTION: credit + record + mark approved ──
        // If watcher crashes mid-way, entire transaction rolls back → no double credit.
        await prisma.$transaction(async (tx) => {
            // 1. Credit wallet
            const wallet = await tx.wallet.upsert({
                where: { userId },
                create: {
                    userId,
                    availableBalance: amountVnd,
                    totalDeposited: amountVnd,
                },
                update: {
                    availableBalance: { increment: amountVnd },
                    totalDeposited: { increment: amountVnd },
                },
            });

            // 2. Record wallet transaction
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'DEPOSIT',
                    direction: 'CREDIT',
                    amount: amountVnd,
                    balanceAfter: wallet.availableBalance,
                    referenceType: 'DEPOSIT',
                    referenceId: depositId,
                    description: `Nạp USDT ${network}: ${amountVnd.toLocaleString('vi-VN')}đ`,
                },
            });

            // 3. Mark deposit as approved (idempotency flag)
            await tx.deposit.update({
                where: { id: depositId },
                data: {
                    approvedAt: new Date(),
                    approvedBy: 'system:usdt_watcher',
                },
            });
        });

        console.log(`[${network}] ✅ Wallet credited: user=${userId}, +${amountVnd.toLocaleString()} VND, deposit=${depositId}`);

    } catch (error) {
        console.error(`[${network}] ❌ CRITICAL: Failed to credit wallet for deposit ${depositId}:`, error);
        // Do NOT throw — the transfer event is already recorded,
        // so this won't be retried automatically. Admin must manually review.
    }
}

// ══════════════════════════════════════════════
// EXPIRY JOB
// ══════════════════════════════════════════════

async function expireOldDeposits(): Promise<void> {
    const result = await prisma.deposit.updateMany({
        where: {
            method: 'USDT',
            status: 'PENDING',
            expiresAt: { lte: new Date() },
        },
        data: { status: 'EXPIRED' },
    });
    if (result.count > 0) {
        console.log(`[Expiry] Expired ${result.count} USDT deposits`);
    }
}

// ══════════════════════════════════════════════
// MAIN LOOP
// ══════════════════════════════════════════════

async function runCycle(): Promise<void> {
    await expireOldDeposits();
    await scanTRC20();
    await scanBEP20();
}

async function main(): Promise<void> {
    console.log('[USDT Watcher] ✅ Worker started');
    console.log(`[USDT Watcher] Polling every ${POLL_INTERVAL_MS / 1000}s`);

    // Initial run
    await runCycle();

    // Loop
    setInterval(async () => {
        try {
            await runCycle();
        } catch (error) {
            console.error('[USDT Watcher] Cycle error:', error);
        }
    }, POLL_INTERVAL_MS);
}

main().catch((err) => {
    console.error('[USDT Watcher] Fatal error:', err);
    process.exit(1);
});
