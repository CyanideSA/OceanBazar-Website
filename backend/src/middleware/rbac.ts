import { Request, Response, NextFunction } from 'express';
import type { AdminAuthPayload } from './auth';

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'warehouse'
  | 'support'
  | 'finance'
  | 'viewer'
  | 'staff';

const ROLE_RANK: Record<AdminRole, number> = {
  super_admin: 100,
  admin: 80,
  finance: 70,
  warehouse: 60,
  support: 50,
  staff: 40,
  viewer: 10,
};

/** Maps legacy `staff` to support capabilities */
export function normalizeAdminRole(role: string): AdminRole {
  const r = role.toLowerCase() as AdminRole;
  if (r === 'staff') return 'support';
  if (r in ROLE_RANK) return r;
  return 'viewer';
}

export function hasMinimumRole(admin: AdminAuthPayload | undefined, minimum: AdminRole): boolean {
  if (!admin) return false;
  const current = normalizeAdminRole(admin.role);
  return ROLE_RANK[current] >= ROLE_RANK[minimum];
}

export function requireMinimumRole(...allowed: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ error: 'Admin authentication required' });
      return;
    }
    const role = normalizeAdminRole(req.admin.role);
    if (!allowed.includes(role) && !allowed.some((a) => hasMinimumRole(req.admin, a))) {
      const ok = allowed.some((a) => ROLE_RANK[role] >= ROLE_RANK[a]);
      if (!ok) {
        res.status(403).json({ error: 'Insufficient permissions', required: allowed });
        return;
      }
    }
    next();
  };
}

export const PERMISSIONS = {
  catalogWrite: ['super_admin', 'admin', 'warehouse'] as AdminRole[],
  ordersWrite: ['super_admin', 'admin', 'support'] as AdminRole[],
  paymentsWrite: ['super_admin', 'admin', 'finance'] as AdminRole[],
  settingsWrite: ['super_admin', 'admin'] as AdminRole[],
  readOnly: ['super_admin', 'admin', 'warehouse', 'support', 'finance', 'viewer', 'staff'] as AdminRole[],
};

export function requirePermission(permission: keyof typeof PERMISSIONS) {
  const roles = PERMISSIONS[permission];
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({ error: 'Admin authentication required' });
      return;
    }
    const role = normalizeAdminRole(req.admin.role);
    if (!roles.includes(role) && role !== 'super_admin') {
      res.status(403).json({ error: 'Insufficient permissions', permission });
      return;
    }
    next();
  };
}
