import { Request, Response, NextFunction } from 'express';
import { FeatureFlagKey, isFeatureEnabled } from '../config/featureFlags';

const ROUTE_FLAGS: Array<{ prefix: string; flag: FeatureFlagKey; message: string }> = [
  { prefix: '/api/orders', flag: 'checkout_enabled', message: 'Checkout is temporarily disabled' },
  { prefix: '/api/cart', flag: 'checkout_enabled', message: 'Cart checkout is temporarily disabled' },
  { prefix: '/api/payments', flag: 'payments_enabled', message: 'Payments are temporarily disabled' },
  { prefix: '/api/admin', flag: 'admin_enabled', message: 'Admin API is temporarily disabled' },
  { prefix: '/api/wholesale', flag: 'wholesale_enabled', message: 'Wholesale is temporarily disabled' },
];

export function featureFlagMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;
  for (const { prefix, flag, message } of ROUTE_FLAGS) {
    if (path.startsWith(prefix) && !isFeatureEnabled(flag)) {
      res.status(503).json({ error: message, feature: flag, retryable: true });
      return;
    }
  }
  next();
}
