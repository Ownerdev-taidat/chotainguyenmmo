// ===== FILE: src/frontend/usePaymentPolling.ts =====
//
// React hook for polling USDT payment status.
// Polls every PAYMENT_STATUS_POLL_SECONDS until terminal state.

import { useState, useEffect, useRef, useCallback } from 'react';

export type PaymentStatus =
  | 'pending'
  | 'detected'
  | 'confirming'
  | 'paid'
  | 'partial'
  | 'overpaid'
  | 'expired'
  | 'failed'
  | 'late_payment'
  | 'manual_review';

interface PaymentStatusData {
  status: PaymentStatus;
  confirmations: number;
  requiredConfirmations: number;
  txHash: string | null;
  detectedAt: string | null;
  confirmedAt: string | null;
  explorerUrl: string | null;
}

interface UsePaymentPollingOptions {
  paymentId: string | null;
  apiBaseUrl?: string;
  pollIntervalMs?: number;
  authToken?: string;
}

const TERMINAL_STATUSES: PaymentStatus[] = ['paid', 'overpaid', 'expired', 'failed', 'late_payment'];

export function usePaymentPolling({
  paymentId,
  apiBaseUrl = '',
  pollIntervalMs = 5000,
  authToken,
}: UsePaymentPollingOptions) {
  const [statusData, setStatusData] = useState<PaymentStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isTerminal = statusData ? TERMINAL_STATUSES.includes(statusData.status) : false;

  const fetchStatus = useCallback(async () => {
    if (!paymentId) return;

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`${apiBaseUrl}/api/payments/${paymentId}/status`, { headers });
      const data = await res.json();

      if (data.success) {
        setStatusData(data.data);
        setError(null);
      } else {
        setError(data.message || 'Failed to fetch status');
      }
    } catch (err) {
      setError('Connection error');
    }
  }, [paymentId, apiBaseUrl, authToken]);

  // Start/stop polling
  useEffect(() => {
    if (!paymentId || isTerminal) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    fetchStatus(); // Immediate first fetch

    intervalRef.current = setInterval(fetchStatus, pollIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, [paymentId, isTerminal, pollIntervalMs, fetchStatus]);

  // Manual refresh (for "I have sent" button)
  const manualRefresh = useCallback(() => {
    // NOTE: This only refreshes status, it does NOT mark as paid.
    // Only the blockchain watcher can mark as paid.
    fetchStatus();
  }, [fetchStatus]);

  return {
    status: statusData?.status || 'pending',
    statusData,
    error,
    isPolling,
    isTerminal,
    manualRefresh,
  };
}
