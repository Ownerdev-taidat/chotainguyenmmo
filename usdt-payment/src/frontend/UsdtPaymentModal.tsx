// ===== FILE: src/frontend/UsdtPaymentModal.tsx =====
//
// React component: USDT Payment Modal
// Mobile-first, responsive, modern design
//
// Features:
// - TRC20 / BEP20 network tabs
// - QR code display
// - Address with copy button
// - Expected amount (unique marker) with copy button
// - Countdown timer
// - Real-time status polling (every 5s)
// - Status states: waiting → detected → confirming → paid
// - "Tôi đã chuyển tiền" button only refreshes status (NEVER sets paid)
// - Warning badges for wrong network/token
// - Responsive: mobile-first, desktop clean
//
// Usage:
// <UsdtPaymentModal
//   isOpen={true}
//   orderId="order_123"
//   fiatAmount={100000}
//   apiBaseUrl="http://localhost:4000"
//   onClose={() => {}}
//   onSuccess={(txHash) => {}}
// />

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePaymentPolling, PaymentStatus } from './usePaymentPolling';

interface UsdtPaymentModalProps {
  isOpen: boolean;
  orderId: string;
  fiatAmount: number;       // VND
  apiBaseUrl?: string;
  authToken?: string;
  onClose: () => void;
  onSuccess?: (txHash: string | null) => void;
}

interface PaymentDisplayData {
  paymentId: string;
  paymentNo: string;
  status: string;
  network: string;
  networkLabel: string;
  chainName: string;
  receivingAddress: string;
  qrImageUrl: string;
  expectedAmount: number;
  baseAmount: number;
  expiresAt: string;
  explorerUrl: string | null;
}

type Network = 'TRC20' | 'BEP20';

export default function UsdtPaymentModal({
  isOpen, orderId, fiatAmount, apiBaseUrl = '', authToken, onClose, onSuccess,
}: UsdtPaymentModalProps) {
  const [network, setNetwork] = useState<Network>('TRC20');
  const [paymentData, setPaymentData] = useState<PaymentDisplayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [countdown, setCountdown] = useState(900); // 15 minutes
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Polling hook
  const { status, statusData, isPolling, manualRefresh } = usePaymentPolling({
    paymentId: paymentData?.paymentId || null,
    apiBaseUrl,
    pollIntervalMs: 5000,
    authToken,
  });

  // Create payment attempt when network is selected
  const createAttempt = useCallback(async (selectedNetwork: Network) => {
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`${apiBaseUrl}/api/orders/${orderId}/payment-attempts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ network: selectedNetwork }),
      });
      const data = await res.json();

      if (data.success) {
        setPaymentData(data.data);
        setNetwork(selectedNetwork);

        // Start countdown from expiresAt
        const expiresMs = new Date(data.data.expiresAt).getTime();
        const remaining = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
        setCountdown(remaining);
      } else {
        setError(data.message || 'Không thể tạo thanh toán');
      }
    } catch {
      setError('Không thể kết nối server');
    }

    setLoading(false);
  }, [orderId, apiBaseUrl, authToken]);

  // Auto-create on open
  useEffect(() => {
    if (isOpen && !paymentData) {
      createAttempt('TRC20');
    }
  }, [isOpen]);

  // Switch network
  const switchNetwork = (newNetwork: Network) => {
    if (newNetwork === network && paymentData) return;
    setPaymentData(null);
    createAttempt(newNetwork);
  };

  // Countdown timer
  useEffect(() => {
    if (!paymentData || status === 'paid' || status === 'overpaid' || status === 'expired') {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [paymentData, status]);

  // Success callback
  useEffect(() => {
    if ((status === 'paid' || status === 'overpaid') && onSuccess) {
      onSuccess(statusData?.txHash || null);
    }
  }, [status]);

  // Copy helper
  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(''), 2000);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!isOpen) return null;

  // ── Status Display Map ──
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending:        { label: 'Chờ thanh toán',         color: 'text-blue-600',    bg: 'bg-blue-50' },
    detected:       { label: 'Đã phát hiện giao dịch', color: 'text-yellow-600',  bg: 'bg-yellow-50' },
    confirming:     { label: 'Đang xác nhận...',       color: 'text-orange-600',  bg: 'bg-orange-50' },
    paid:           { label: '✅ Thanh toán thành công', color: 'text-green-600',   bg: 'bg-green-50' },
    overpaid:       { label: '✅ Thanh toán thành công', color: 'text-green-600',   bg: 'bg-green-50' },
    partial:        { label: 'Thanh toán thiếu',       color: 'text-red-600',     bg: 'bg-red-50' },
    expired:        { label: 'Hết hạn thanh toán',     color: 'text-gray-600',    bg: 'bg-gray-50' },
    late_payment:   { label: 'Thanh toán muộn',        color: 'text-orange-600',  bg: 'bg-orange-50' },
    manual_review:  { label: 'Đang xem xét',          color: 'text-purple-600',  bg: 'bg-purple-50' },
    failed:         { label: 'Thất bại',               color: 'text-red-600',     bg: 'bg-red-50' },
  };

  const currentStatusConfig = statusConfig[status] || statusConfig.pending;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'white', borderRadius: 20, width: '95%', maxWidth: 480,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111' }}>
              Thanh toán bằng USDT
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
              {fiatAmount.toLocaleString('vi-VN')}đ
            </p>
          </div>
          <button onClick={onClose} style={{
            background: '#f5f5f5', border: 'none', borderRadius: 10,
            width: 36, height: 36, fontSize: 18, cursor: 'pointer', color: '#666',
          }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>
          {/* Network Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['TRC20', 'BEP20'] as Network[]).map(n => (
              <button key={n} onClick={() => switchNetwork(n)}
                disabled={loading}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer',
                  background: network === n
                    ? (n === 'TRC20' ? '#ef4444' : '#eab308')
                    : '#f3f4f6',
                  color: network === n ? 'white' : '#666',
                  transition: 'all 0.2s',
                }}>
                {n === 'TRC20' ? 'USDT (TRC20)' : 'USDT (BEP20)'}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              Đang tạo thanh toán...
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
              padding: 16, color: '#dc2626', fontSize: 14, marginBottom: 16,
            }}>
              ❌ {error}
            </div>
          )}

          {/* Payment Content */}
          {paymentData && !loading && (
            <>
              {/* Status Badge */}
              <div style={{
                padding: '10px 16px', borderRadius: 12, marginBottom: 16,
                background: currentStatusConfig.bg, textAlign: 'center',
                fontSize: 14, fontWeight: 600,
              }} className={currentStatusConfig.color}>
                {currentStatusConfig.label}
                {(status === 'detected' || status === 'confirming') && statusData && (
                  <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                    ({statusData.confirmations}/{statusData.requiredConfirmations})
                  </span>
                )}
              </div>

              {/* SUCCESS STATE */}
              {(status === 'paid' || status === 'overpaid') && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>
                    Thanh toán thành công!
                  </p>
                  {statusData?.txHash && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ fontSize: 11, color: '#888' }}>Transaction Hash:</p>
                      <p style={{ fontSize: 10, fontFamily: 'monospace', color: '#333', wordBreak: 'break-all' }}>
                        {statusData.txHash}
                      </p>
                      {statusData.explorerUrl && (
                        <a href={statusData.explorerUrl} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none' }}>
                          🔗 Xem trên blockchain
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* EXPIRED STATE */}
              {status === 'expired' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>
                    Hết thời gian thanh toán
                  </p>
                  <p style={{ fontSize: 13, color: '#999', marginTop: 8 }}>
                    Nếu đã chuyển tiền, hệ thống sẽ tự phát hiện và xử lý.
                  </p>
                  <button onClick={() => { setPaymentData(null); createAttempt(network); }}
                    style={{
                      marginTop: 16, padding: '10px 24px', borderRadius: 10,
                      background: '#2563eb', color: 'white', border: 'none',
                      fontWeight: 600, cursor: 'pointer',
                    }}>
                    Tạo đơn mới
                  </button>
                </div>
              )}

              {/* PENDING / DETECTED / CONFIRMING — show payment details */}
              {['pending', 'detected', 'confirming'].includes(status) && (
                <>
                  {/* Countdown */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 16, padding: '8px 12px', background: '#f9fafb', borderRadius: 10,
                  }}>
                    <span style={{ fontSize: 13, color: '#666' }}>⏱ Thời gian còn lại</span>
                    <span style={{
                      fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
                      color: countdown < 120 ? '#ef4444' : '#16a34a',
                    }}>
                      {formatTime(countdown)}
                    </span>
                  </div>

                  {/* QR Code */}
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{
                      display: 'inline-block', padding: 12, background: '#f9fafb',
                      borderRadius: 16, border: '1px solid #e5e7eb',
                    }}>
                      <img src={paymentData.qrImageUrl}
                        alt="QR Code" style={{ width: 180, height: 180, objectFit: 'contain' }} />
                    </div>
                  </div>

                  {/* Address */}
                  <div style={{
                    background: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>ĐỊA CHỈ VÍ NHẬN</span>
                      <button onClick={() => copy(paymentData.receivingAddress, 'addr')}
                        style={{
                          border: 'none', background: copied === 'addr' ? '#dcfce7' : '#e5e7eb',
                          borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
                          color: copied === 'addr' ? '#16a34a' : '#666',
                        }}>
                        {copied === 'addr' ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all',
                      color: '#111', lineHeight: 1.5,
                    }}>
                      {paymentData.receivingAddress}
                    </p>
                  </div>

                  {/* Expected Amount */}
                  <div style={{
                    background: '#ecfdf5', borderRadius: 12, padding: 14, marginBottom: 12,
                    border: '2px solid #a7f3d0',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                        SỐ TIỀN USDT CẦN GỬI
                      </span>
                      <button onClick={() => copy(paymentData.expectedAmount.toString(), 'amount')}
                        style={{
                          border: 'none', background: copied === 'amount' ? '#dcfce7' : '#d1fae5',
                          borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
                          color: copied === 'amount' ? '#16a34a' : '#059669', fontWeight: 600,
                        }}>
                        {copied === 'amount' ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 28, fontWeight: 800, color: '#047857',
                      fontFamily: 'monospace',
                    }}>
                      {paymentData.expectedAmount} <span style={{ fontSize: 16 }}>USDT</span>
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#888' }}>
                      = {fiatAmount.toLocaleString('vi-VN')}đ
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#059669', fontStyle: 'italic' }}>
                      Vui lòng gửi đúng chính xác số tiền này để hệ thống tự động xác nhận
                    </p>
                  </div>

                  {/* WARNING */}
                  <div style={{
                    background: '#fef2f2', border: '2px solid #fecaca', borderRadius: 12,
                    padding: 14, marginBottom: 16,
                  }}>
                    <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
                      ⚠️ Lưu ý quan trọng
                    </p>
                    <ul style={{
                      margin: 0, paddingLeft: 16, fontSize: 12, color: '#b91c1c',
                      lineHeight: 1.8, listStyle: 'disc',
                    }}>
                      <li>Chỉ gửi <b>USDT</b> đúng mạng <b>{paymentData.networkLabel}</b></li>
                      <li>Gửi sai mạng hoặc sai token <b>sẽ không tự xác nhận</b></li>
                      <li>Gửi sai số tiền có thể <b>làm chậm xác nhận</b></li>
                      <li>Nút &quot;Tôi đã chuyển tiền&quot; chỉ kiểm tra lại, <b>không tự xác nhận</b></li>
                    </ul>
                  </div>

                  {/* Manual refresh button */}
                  <button onClick={manualRefresh}
                    style={{
                      width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                      background: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: 14,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 8,
                    }}>
                    🔄 Tôi đã chuyển tiền — Kiểm tra lại
                  </button>

                  {/* Polling indicator */}
                  {isPolling && (
                    <p style={{
                      textAlign: 'center', fontSize: 11, color: '#aaa', marginTop: 8,
                    }}>
                      🔄 Tự động kiểm tra mỗi 5 giây...
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
