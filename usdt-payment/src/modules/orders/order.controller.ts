// ===== FILE: src/modules/orders/order.controller.ts =====

import { Router, Request, Response, NextFunction } from 'express';
import { createOrder, getOrder, getOrderByNo } from './order.service';
import { AppError } from '../../middleware/error.middleware';

const router = Router();

// POST /api/orders — Create order
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, sessionId, productId, productName, fiatAmount, usdtAmount, metadata } = req.body;

    if (!fiatAmount || fiatAmount < 1000) {
      throw new AppError('fiatAmount must be >= 1000 VND', 400);
    }

    const order = await createOrder({
      userId, sessionId, productId, productName,
      fiatAmount: parseInt(fiatAmount),
      usdtAmount: usdtAmount ? parseFloat(usdtAmount) : 0,
      metadata,
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) { next(err); }
});

// GET /api/orders/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) throw new AppError('Order not found', 404);
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

export default router;
