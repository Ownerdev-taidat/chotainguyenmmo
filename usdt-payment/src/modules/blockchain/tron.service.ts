// ===== FILE: src/modules/blockchain/tron.service.ts =====
//
// TRON blockchain service: scan TRC20 USDT transfers TO our address.
// Uses TronGrid API (free tier, optional API key for higher limits).
//
// Watch-only: NO private keys needed.

import { ENV, NETWORK_CONFIG } from '../../config/env';
import { logger } from '../../utils/logger';

const MOD = 'TronService';

export interface TronTransfer {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;       // USDT, human-readable
  tokenContract: string;
  blockNumber: number;
  blockTimestamp: Date;
  confirmations: number;
}

/**
 * Fetch recent TRC20 USDT transfers TO our TRON address.
 * Uses TronGrid API: /v1/accounts/{address}/transactions/trc20
 *
 * @param minTimestamp - Only fetch transfers after this timestamp (ms)
 * @returns Array of transfers
 */
export async function fetchTRC20Transfers(minTimestamp: number): Promise<TronTransfer[]> {
  const address = ENV.TRON_PUBLIC_ADDRESS;
  const contract = ENV.TRC20_USDT_CONTRACT;
  const apiBase = ENV.TRON_FULL_HOST;

  const url = `${apiBase}/v1/accounts/${address}/transactions/trc20?` +
    `only_to=true&limit=50&min_timestamp=${minTimestamp}&contract_address=${contract}`;

  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (ENV.TRONGRID_API_KEY) {
    headers['TRON-PRO-API-KEY'] = ENV.TRONGRID_API_KEY;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    logger.error(MOD, `TronGrid API error: ${res.status} ${res.statusText}`);
    return [];
  }

  const data: any = await res.json();
  const rawTransfers = data?.data || [];

  const transfers: TronTransfer[] = [];

  for (const tx of rawTransfers) {
    const toAddr = tx.to;
    const tokenAddr = tx.token_info?.address || '';

    // Strict: only our address + only USDT contract
    if (toAddr.toLowerCase() !== address.toLowerCase()) continue;
    if (tokenAddr !== contract) continue;

    const rawAmount = parseInt(tx.value || '0');
    const decimals = parseInt(tx.token_info?.decimals || '6');
    const amount = rawAmount / Math.pow(10, decimals);

    if (amount <= 0) continue;

    transfers.push({
      txHash: tx.transaction_id,
      fromAddress: tx.from,
      toAddress: toAddr,
      amount,
      tokenContract: tokenAddr,
      blockNumber: tx.block_timestamp ? Math.floor(tx.block_timestamp / 3000) : 0, // Approximate
      blockTimestamp: tx.block_timestamp ? new Date(tx.block_timestamp) : new Date(),
      confirmations: 20, // TronGrid returns confirmed transactions
    });
  }

  return transfers;
}

/**
 * Get current TRON block number (approximate, for checkpointing).
 */
export async function getTronBlockNumber(): Promise<number> {
  try {
    const res = await fetch(`${ENV.TRON_FULL_HOST}/wallet/getnowblock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data: any = await res.json();
    return data?.block_header?.raw_data?.number || 0;
  } catch {
    return 0;
  }
}
