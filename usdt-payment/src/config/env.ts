// ===== FILE: src/config/env.ts =====

import 'dotenv/config';

export const ENV = {
  PORT: parseInt(process.env.PORT || '4000'),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/usdt_payment',

  // TRON
  TRON_PUBLIC_ADDRESS: process.env.TRON_PUBLIC_ADDRESS || 'TTmNqZhW4PkDXpPaTiSXzLnoWMdWf5xSp8',
  TRON_FULL_HOST: process.env.TRON_FULL_HOST || 'https://api.trongrid.io',
  TRONGRID_API_KEY: process.env.TRONGRID_API_KEY || '',
  TRC20_USDT_CONTRACT: process.env.TRC20_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  TRON_QR_IMAGE_URL: process.env.TRON_QR_IMAGE_URL || '/images/tronusdt.jpg',
  TRON_REQUIRED_CONFIRMATIONS: parseInt(process.env.TRON_REQUIRED_CONFIRMATIONS || '20'),

  // BSC
  BSC_PUBLIC_ADDRESS: process.env.BSC_PUBLIC_ADDRESS || '0x66846F8135B3a521e924D1960d90F4C4aF844817',
  BSC_RPC_URL: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
  BEP20_USDT_CONTRACT: (process.env.BEP20_USDT_CONTRACT || '0x55d398326f99059fF775485246999027B3197955').toLowerCase(),
  BSC_QR_IMAGE_URL: process.env.BSC_QR_IMAGE_URL || '/images/bscusdt.jpg',
  BSC_REQUIRED_CONFIRMATIONS: parseInt(process.env.BSC_REQUIRED_CONFIRMATIONS || '15'),

  // Payment
  PAYMENT_EXPIRE_MINUTES: parseInt(process.env.PAYMENT_EXPIRE_MINUTES || '15'),
  PAYMENT_STATUS_POLL_SECONDS: parseInt(process.env.PAYMENT_STATUS_POLL_SECONDS || '5'),
  USDT_VND_RATE: parseInt(process.env.USDT_VND_RATE || '25000'),

  // Worker
  WORKER_POLL_INTERVAL_MS: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '10000'),

  // Unique amount marker config
  // We use 3 decimal places. Marker range: 0.001 - 0.999
  // This gives us 999 unique slots per network at any given time
  MARKER_DECIMALS: 3,
  MARKER_MIN: 0.001,
  MARKER_MAX: 0.999,

  // Matching tolerance: strict — must match within 0.0005 USDT
  AMOUNT_TOLERANCE: parseFloat(process.env.AMOUNT_TOLERANCE || '0.0005'),
} as const;

export type Network = 'TRC20' | 'BEP20';

export const NETWORK_CONFIG = {
  TRC20: {
    publicAddress: ENV.TRON_PUBLIC_ADDRESS,
    tokenContract: ENV.TRC20_USDT_CONTRACT,
    qrImageUrl: ENV.TRON_QR_IMAGE_URL,
    label: 'USDT (TRC20)',
    chainName: 'TRON',
    requiredConfirmations: ENV.TRON_REQUIRED_CONFIRMATIONS,
    explorerTxUrl: 'https://tronscan.org/#/transaction/',
    decimals: 6,
  },
  BEP20: {
    publicAddress: ENV.BSC_PUBLIC_ADDRESS,
    tokenContract: ENV.BEP20_USDT_CONTRACT,
    qrImageUrl: ENV.BSC_QR_IMAGE_URL,
    label: 'USDT (BEP20)',
    chainName: 'BNB Chain',
    requiredConfirmations: ENV.BSC_REQUIRED_CONFIRMATIONS,
    explorerTxUrl: 'https://bscscan.com/tx/',
    decimals: 18,
  },
} as const;
