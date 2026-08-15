import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

const REAUTH_PURPOSE = 'admin_reauth';

export function signReauthToken(adminId: number, role: string): string {
  return jwt.sign(
    { adminId, role, purpose: REAUTH_PURPOSE },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '5m' } as jwt.SignOptions,
  );
}

export function requireAdminReauth() {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers['x-admin-reauth-token'];
    const token = typeof header === 'string' ? header : '';
    if (!token) {
      res.status(401).json({ error: 'Privileged action requires re-authentication' });
      return;
    }
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { adminId: number; purpose?: string };
      if (payload.purpose !== REAUTH_PURPOSE || payload.adminId !== req.admin?.adminId) {
        res.status(401).json({ error: 'Invalid re-auth token' });
        return;
      }
      next();
    } catch {
      res.status(401).json({ error: 'Expired or invalid re-auth token' });
    }
  };
}

