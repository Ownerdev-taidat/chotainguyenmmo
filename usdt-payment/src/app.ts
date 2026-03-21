// ===== FILE: src/app.ts =====

import express from 'express';
import cors from 'cors';
import orderController from './modules/orders/order.controller';
import paymentController from './modules/payments/payment.controller';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { runReconciliation } from './jobs/reconciliation.job';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/orders', orderController);
app.use('/api', paymentController);

// Admin: trigger reconciliation
app.post('/api/internal/reconciliation/run', async (_req, res) => {
  try {
    const result = await runReconciliation();
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('API', 'Reconciliation error', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
