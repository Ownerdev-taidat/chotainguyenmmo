/**
 * USDT Payment Service — Core Library
 * ====================================
 * RESPONSIBILITIES:
 *   1. Create USDT deposits (unique amount generation)
 *   2. Expire old deposits
 *   3. Configuration exports
 *
 * IMPORTANT: Wallet crediting is ONLY done by usdt-watcher.
 * This file does NOT contain any wallet credit logic.
 */
import { getUsdtVndRate } from './exchange-rate';

import prisma from '@/lib/prisma';

// ══════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════

export type UsdtNetwork = 'TRC20' | 'BEP20';

export const USDT_CONFIG = {
    TRC20: {
        publicAddress: process.env.TRON_PUBLIC_ADDRESS || 'TTmNqZhW4PkDXpPaTiSXzLnoWMdWf5xSp8',
        tokenContract: process.env.TRC20_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        qrImageUrl: process.env.TRON_QR_IMAGE_URL || '/images/tronusdt.jpg',
        label: 'USDT (TRC20)',
        chainName: 'TRON',
        requiredConfirmations: 20,
        explorerTxUrl: 'https://tronscan.org/#/transaction/',
    },
    BEP20: {
        publicAddress: process.env.BSC_PUBLIC_ADDRESS || '0x66846F8135B3a521e924D1960d90F4C4aF844817',
        tokenContract: process.env.BEP20_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955',
        qrImageUrl: process.env.BSC_QR_IMAGE_URL || '/images/bscusdt.jpg',
        label: 'USDT (BEP20)',
        chainName: 'BNB Chain',
        requiredConfirmations: 15,
        explorerTxUrl: 'https://bscscan.com/tx/',
    },
};

const PAYMENT_EXPIRE_MINUTES = parseInt(process.env.PAYMENT_EXPIRE_MINUTES || '15');

// ══════════════════════════════════════════════
// INTEGER-SAFE AMOUNT UTILITIES
// ══════════════════════════════════════════════

/**
 * Convert a USDT float to "milli-USDT" integer (×1000).
 * Safe for amounts up to $999,999 (well under JS integer precision limit).
 * 
 * Example: 10.047 → 10047
 */
export function toMilliUsdt(amount: number): number {
    return Math.round(amount * 1000);
}

/**
 * Integer-safe comparison of two USDT amounts.
 * Converts both to milli-USDT integers before comparing.
 * Default tolerance = 0 (exact match).
 */
export function amountMatchesSafe(a: number, b: number, tolerance: number = 0): boolean {
    return Math.abs(toMilliUsdt(a) - toMilliUsdt(b)) <= tolerance;
}

// ══════════════════════════════════════════════
// UNIQUE AMOUNT GENERATION
// ══════════════════════════════════════════════

/**
 * Generate a unique USDT amount that doesn't collide with any active
 * pending deposits on the same network.
 *
 * Strategy:
 * - Base amount (2 decimals) + random marker (0.001–0.999)
 * - Check ALL active pending deposits for collision using integer math
 * - Up to 998 unique values per base amount per network
 * - If all exhausted: throw error (never silently collide)
 *
 * Race condition protection:
 * - The watcher matches using ±0.002 tolerance
 * - Generated amounts are spaced ≥0.001 apart
 * - DB query ensures no duplicate within ±0.002 range
 */
export async function generateUniqueUsdtAmount(
    baseUsdtAmount: number,
    network: UsdtNetwork,
): Promise<number> {
    const base = parseFloat(baseUsdtAmount.toFixed(2));

    // Fetch ALL active pending USDT deposits on this network
    const activePending = await prisma.deposit.findMany({
        where: {
            method: 'USDT',
            network,
            status: { in: ['PENDING', 'DETECTED', 'CONFIRMING'] },
            expiresAt: { gt: new Date() },
        },
        select: { usdtAmount: true },
    });

    const usedAmounts = new Set(
        activePending
            .filter(d => d.usdtAmount !== null)
            .map(d => toMilliUsdt(d.usdtAmount!))
    );

    // Try up to 200 random markers
    for (let attempt = 0; attempt < 200; attempt++) {
        // Random marker: 0.001 to 0.999 (3 decimal places)
        const marker = parseFloat((Math.random() * 0.998 + 0.001).toFixed(3));
        const candidateAmount = parseFloat((base + marker).toFixed(3));
        const candidateMilli = toMilliUsdt(candidateAmount);

        // Check collision: no existing amount within ±2 milli-USDT
        const hasCollision = usedAmounts.has(candidateMilli) ||
            usedAmounts.has(candidateMilli - 1) ||
            usedAmounts.has(candidateMilli + 1) ||
            usedAmounts.has(candidateMilli - 2) ||
            usedAmounts.has(candidateMilli + 2);

        if (!hasCollision) return candidateAmount;
    }

    // Should never happen with <500 concurrent deposits
    throw new Error(
        `Cannot generate unique USDT amount for base=${base} on ${network}. ` +
        `${usedAmounts.size} active deposits. Please try again or contact support.`
    );
}

// ══════════════════════════════════════════════
// CREATE USDT DEPOSIT
// ══════════════════════════════════════════════

export interface CreateUsdtDepositResult {
    depositId: string;
    network: UsdtNetwork;
    receivingAddress: string;
    qrImageUrl: string;
    expectedUsdt: number;
    amountVnd: number;
    expiresAt: Date;
    referenceCode: string;
    rate: number;
}

/**
 * Create a new USDT deposit for a user.
 *
 * Security:
 * - Expires any existing pending USDT deposit for this user first
 * - Generates unique amount per network (integer-safe collision check)
 * - Rate limited by caller (API route: 3/hour)
 * - Only 1 active USDT deposit per user at a time
 */
export async function createUsdtDeposit(
    userId: string,
    amountVnd: number,
    network: UsdtNetwork,
): Promise<CreateUsdtDepositResult> {
    const config = USDT_CONFIG[network];
    if (!config) throw new Error(`Unsupported network: ${network}`);

    // ── Expire any existing active USDT deposit for this user ──
    const expiredResult = await prisma.deposit.updateMany({
        where: {
            userId,
            method: 'USDT',
            status: { in: ['PENDING', 'DETECTED', 'CONFIRMING'] },
        },
        data: { status: 'EXPIRED' },
    });
    if (expiredResult.count > 0) {
        console.log(`[USDT] Expired ${expiredResult.count} previous deposits for user ${userId}`);
    }

    // ── Generate unique USDT amount ──
    const { rate: usdtVndRate } = await getUsdtVndRate();
    const baseUsdt = parseFloat((amountVnd / usdtVndRate).toFixed(2));
    const uniqueUsdt = await generateUniqueUsdtAmount(baseUsdt, network);

    // ── Generate reference code ──
    const refCode = `USDT_${network}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRE_MINUTES * 60000);

    // ── Create deposit record ──
    const deposit = await prisma.deposit.create({
        data: {
            userId,
            amount: amountVnd,
            method: 'USDT',
            status: 'PENDING',
            network,
            usdtAmount: uniqueUsdt,
            referenceCode: refCode,
            qrUrl: config.qrImageUrl,
            expiresAt,
        },
    });

    // ── Audit log ──
    await prisma.usdtPaymentLog.create({
        data: {
            depositId: deposit.id,
            oldStatus: 'NONE',
            newStatus: 'PENDING',
            reason: `USDT deposit created: ${uniqueUsdt} ${network} (base: ${baseUsdt})`,
            actor: 'system',
            metadata: JSON.stringify({
                amountVnd, network, uniqueUsdt, baseUsdt,
                rate: usdtVndRate,
                milliUsdt: toMilliUsdt(uniqueUsdt),
            }),
        },
    });

    console.log(`[USDT] Created deposit ${deposit.id}: ${uniqueUsdt} ${network} for user ${userId}`);

    return {
        depositId: deposit.id,
        network,
        receivingAddress: config.publicAddress,
        qrImageUrl: config.qrImageUrl,
        expectedUsdt: uniqueUsdt,
        amountVnd,
        expiresAt,
        referenceCode: refCode,
        rate: usdtVndRate,
    };
}

// ══════════════════════════════════════════════
// EXPIRE OLD DEPOSITS
// ══════════════════════════════════════════════

/**
 * Expire all USDT deposits past their expiry time.
 * Safe to call repeatedly (idempotent).
 */
export async function expireOldDeposits() {
    const result = await prisma.deposit.updateMany({
        where: {
            method: 'USDT',
            status: { in: ['PENDING'] },
            expiresAt: { lte: new Date() },
        },
        data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
        console.log(`[USDT] Expired ${result.count} deposits`);
    }
}
