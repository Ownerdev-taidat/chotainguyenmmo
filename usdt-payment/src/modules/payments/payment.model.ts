// ===== FILE: src/modules/payments/payment.model.ts =====

import { Network } from '../../config/env';

export const PAYMENT_ATTEMPT_STATUSES = [
  'pending',
  'detected',
  'confirming',
  'paid',
  'partial',
  'overpaid',
  'expired',
  'failed',
  'late_payment',
  'manual_review',
] as const;
export type PaymentAttemptStatus = typeof PAYMENT_ATTEMPT_STATUSES[number];

export interface CreatePaymentAttemptInput {
  orderId: string;
  network: Network;
}

export interface MatchTransferInput {
  network: string;
  txHash: string;
  logIndex: number;
  fromAddress: string;
  toAddress: string;
  amount: number;      // USDT, human-readable
  tokenContract: string;
  blockNumber: number;
  blockTimestamp?: Date;
  confirmations: number;
}

export interface MatchResult {
  matched: boolean;
  paymentAttemptId?: string;
  orderId?: string;
  action: 'paid' | 'partial' | 'overpaid' | 'late_payment' | 'manual_review' | 'ignored' | 'unmatched';
  reason: string;
}
