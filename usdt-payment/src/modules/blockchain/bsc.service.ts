// ===== FILE: src/modules/blockchain/bsc.service.ts =====
//
// BSC (BNB Chain) blockchain service: scan BEP20 USDT Transfer events.
// Uses BSC JSON-RPC (public node, no API key needed).
//
// Watch-only: NO private keys needed.

import { ENV, NETWORK_CONFIG } from '../../config/env';
import { logger } from '../../utils/logger';

const MOD = 'BscService';

// ERC20 Transfer event topic0: keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

let rpcId = 1;

export interface BscTransfer {
  txHash: string;
  logIndex: number;
  fromAddress: string;
  toAddress: string;
  amount: number;       // USDT, human-readable
  tokenContract: string;
  blockNumber: number;
  blockTimestamp?: Date;
  confirmations: number;
}

/**
 * JSON-RPC call to BSC node.
 */
async function rpcCall(method: string, params: any[]): Promise<any> {
  const res = await fetch(ENV.BSC_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
  });
  const data: any = await res.json();
  if (data.error) {
    throw new Error(`RPC ${method}: ${data.error.message}`);
  }
  return data.result;
}

/**
 * Get current BSC block number.
 */
export async function getBscBlockNumber(): Promise<number> {
  const hex = await rpcCall('eth_blockNumber', []);
  return parseInt(hex, 16);
}

/**
 * Fetch BEP20 USDT Transfer event logs from BSC.
 * Filters by: USDT contract + Transfer event + to = our address.
 *
 * @param fromBlock - Start block (inclusive)
 * @param toBlock - End block (inclusive), max 1000 blocks range
 * @returns Array of parsed transfers
 */
export async function fetchBEP20Transfers(
  fromBlock: number,
  toBlock: number,
): Promise<BscTransfer[]> {
  const address = ENV.BSC_PUBLIC_ADDRESS.toLowerCase();
  const paddedAddress = '0x' + address.slice(2).padStart(64, '0');

  const logs = await rpcCall('eth_getLogs', [{
    fromBlock: '0x' + fromBlock.toString(16),
    toBlock: '0x' + toBlock.toString(16),
    address: ENV.BEP20_USDT_CONTRACT,
    topics: [
      TRANSFER_TOPIC,
      null,             // from: any
      paddedAddress,    // to: our address
    ],
  }]);

  if (!logs || logs.length === 0) return [];

  // Get current block for confirmation count
  const currentBlock = await getBscBlockNumber();

  const transfers: BscTransfer[] = [];

  for (const log of logs) {
    const txHash = log.transactionHash;
    const logIndex = parseInt(log.logIndex, 16);
    const blockNumber = parseInt(log.blockNumber, 16);

    // Decode Transfer(from, to, value)
    const fromAddr = '0x' + log.topics[1].slice(26).toLowerCase();
    const toAddr = '0x' + log.topics[2].slice(26).toLowerCase();

    // BSC USDT uses 18 decimals
    const rawAmount = BigInt(log.data);
    const amount = Number(rawAmount) / 1e18;

    if (amount <= 0) continue;

    // Strict: verify to address matches
    if (toAddr !== address) continue;

    const confirmations = Math.max(0, currentBlock - blockNumber);

    // Get block timestamp
    let blockTimestamp: Date | undefined;
    try {
      const block = await rpcCall('eth_getBlockByNumber', ['0x' + blockNumber.toString(16), false]);
      if (block?.timestamp) {
        blockTimestamp = new Date(parseInt(block.timestamp, 16) * 1000);
      }
    } catch {}

    transfers.push({
      txHash,
      logIndex,
      fromAddress: fromAddr,
      toAddress: toAddr,
      amount,
      tokenContract: ENV.BEP20_USDT_CONTRACT,
      blockNumber,
      blockTimestamp,
      confirmations,
    });
  }

  return transfers;
}
