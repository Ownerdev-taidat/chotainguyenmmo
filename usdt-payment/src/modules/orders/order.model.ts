// ===== FILE: src/modules/orders/order.model.ts =====

export interface CreateOrderInput {
  userId?: string;
  sessionId?: string;
  productId?: string;
  productName?: string;
  fiatAmount: number;   // VND
  usdtAmount: number;   // Base USDT (before marker)
  metadata?: Record<string, any>;
}

export const ORDER_STATUSES = [
  'pending',
  'approved',
  'completed',
  'cancelled',
  'refunded',
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const PAYMENT_STATUSES = [
  'unpaid',
  'paying',
  'paid',
  'partial',
  'expired',
  'manual_review',
] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];
