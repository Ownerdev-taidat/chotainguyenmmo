// ===== FILE: src/modules/payments/payment.controller.ts =====

import { Router, Request, Response, NextFunction } from 'express';
import { createPaymentAttempt, getPaymentAttempt, getPaymentDisplay } from './payment.service';
import { AppError } from '../../middleware/error.middleware';
import { Network } from '../../config/env';

const router = Router();

// POST /api/orders/:orderId/payment-attempts — Create payment attempt
router.post('/orders/:orderId/payment-attempts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const { network } = req.body;

    if (!network || !['TRC20', 'BEP20'].includes(network)) {
      throw new AppError('network must be TRC20 or BEP20', 400);
    }

    const attempt = await createPaymentAttempt({
      orderId,
      network: network as Network,
    });

    res.status(201).json({ success: true, data: attempt });
  } catch (err) { next(err); }
});

// GET /api/payments/:id — Get payment attempt
router.get('/payments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempt = await getPaymentAttempt(req.params.id);
    if (!attempt) throw new AppError('Payment attempt not found', 404);
    res.json({ success: true, data: attempt });
  } catch (err) { next(err); }
});

// GET /api/payments/:id/status — Lightweight status (for polling)
router.get('/payments/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attempt = await getPaymentAttempt(req.params.id);
    if (!attempt) throw new AppError('Payment attempt not found', 404);

    res.json({
      success: true,
      data: {
        status: attempt.status,
        confirmations: attempt.confirmationCount,
        requiredConfirmations: attempt.requiredConfirmations,
        txHash: attempt.txHash,
        detectedAt: attempt.detectedAt,
        confirmedAt: attempt.confirmedAt,
        explorerUrl: attempt.explorerUrl,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/payments/:id/display — Full display data for frontend popup
router.get('/payments/:id/display', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const display = await getPaymentDisplay(req.params.id);
    if (!display) throw new AppError('Payment attempt not found', 404);
    res.json({ success: true, data: display });
  } catch (err) { next(err); }
});

// POST /api/admin/payments/:id/manual-approve
router.post('/admin/payments/:id/manual-approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const attempt = await prisma.paymentAttempt.findUnique({ where: { id } });
    if (!attempt) throw new AppError('Payment attempt not found', 404);

    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id },
        data: { status: 'paid', confirmedAt: new Date() },
      }),
      prisma.paymentStatusLog.create({
        data: {
          paymentAttemptId: id,
          oldStatus: attempt.status,
          newStatus: 'paid',
          reason: `Manual approve: ${reason || 'admin action'}`,
          actor: 'admin',
        },
      }),
      prisma.auditLog.create({
        data: {
          action: 'admin.manual_approve',
          entityType: 'payment_attempt',
          entityId: id,
          actor: 'admin',
          details: JSON.stringify({ reason, previousStatus: attempt.status }),
        },
      }),
    ]);

    // Auto-approve order
    const { autoApproveOrder } = require('../orders/order.service');
    await autoApproveOrder(attempt.orderId, 'manual');

    res.json({ success: true, message: 'Payment manually approved' });
  } catch (err) { next(err); }
});

// POST /api/admin/payments/:id/manual-reject
router.post('/admin/payments/:id/manual-reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const attempt = await prisma.paymentAttempt.findUnique({ where: { id } });
    if (!attempt) throw new AppError('Payment attempt not found', 404);

    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id },
        data: { status: 'failed' },
      }),
      prisma.paymentStatusLog.create({
        data: {
          paymentAttemptId: id,
          oldStatus: attempt.status,
          newStatus: 'failed',
          reason: `Manual reject: ${reason || 'admin action'}`,
          actor: 'admin',
        },
      }),
    ]);

    res.json({ success: true, message: 'Payment rejected' });
  } catch (err) { next(err); }
});

export default router;
