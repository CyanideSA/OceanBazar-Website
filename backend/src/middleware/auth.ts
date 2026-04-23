import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  userType: 'retail' | 'wholesale';
}

export interface AdminAuthPayload {
  adminId: number;
  role: 'super_admin' | 'admin' | 'staff';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
      admin?: AdminAuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AuthPayload & { iat: number; exp: number };
    req.user = { userId: payload.userId, userType: payload.userType };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }

  const token = header.slice(7);

  // Try BFF-issued token first (adminId claim, JWT_ACCESS_SECRET)
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AdminAuthPayload & { iat: number; exp: number };
    if (payload.adminId) {
      req.admin = { adminId: payload.adminId, role: payload.role };
      return next();
    }
  } catch { /* fall through to Java token check */ }

  // Try Java-issued admin token (admin_id string claim, JWT_SECRET_KEY)
  const javaSecret = process.env.JWT_SECRET_KEY || 'oceanbazar-secret-key-change-in-production';
  try {
    const payload = jwt.verify(token, javaSecret) as Record<string, unknown> & { iat: number; exp: number };
    const javaAdminId = payload['admin_id'];
    const role = ((payload['role'] as string) || 'ADMIN').toLowerCase().replace('super_admin', 'super_admin') as AdminAuthPayload['role'];
    if (javaAdminId) {
      req.admin = { adminId: Number(javaAdminId) || 0, role };
      return next();
    }
  } catch { /* fall through */ }

  res.status(401).json({ error: 'Invalid admin token' });
}

export function requireRole(...roles: AdminAuthPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
