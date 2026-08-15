import type { NextFunction, Request, Response } from 'express';
import { getRolePermissions } from '../lib/adminGovernance';
import { normalizeAdminRole } from './rbac';

type PolicyAction = 'read' | 'write' | 'approve' | 'delete';
type PolicyModule =
  | 'catalog'
  | 'orders'
  | 'delivery'
  | 'payments'
  | 'returns'
  | 'customers'
  | 'team'
  | 'settings'
  | 'governance'
  | 'chat'
  | 'analytics';

const ROLE_BASELINE: Record<string, Partial<Record<PolicyModule, PolicyAction[]>>> = {
  super_admin: {
    catalog: ['read', 'write', 'delete', 'approve'],
    orders: ['read', 'write', 'approve'],
    delivery: ['read', 'write', 'approve'],
    payments: ['read', 'write', 'approve'],
    returns: ['read', 'write', 'approve'],
    customers: ['read', 'write', 'delete'],
    team: ['read', 'write', 'delete', 'approve'],
    settings: ['read', 'write', 'approve'],
    governance: ['read', 'write', 'approve'],
    chat: ['read', 'write'],
    analytics: ['read'],
  },
  admin: {
    catalog: ['read', 'write'],
    orders: ['read', 'write'],
    delivery: ['read', 'write'],
    payments: ['read', 'write'],
    returns: ['read', 'write'],
    customers: ['read', 'write'],
    team: ['read'],
    settings: ['read'],
    governance: ['read'],
    chat: ['read', 'write'],
    analytics: ['read'],
  },
  finance: { payments: ['read', 'write'], returns: ['read', 'write'], orders: ['read'], analytics: ['read'] },
  warehouse: { catalog: ['read', 'write'], orders: ['read', 'write'], delivery: ['read', 'write'] },
  support: { orders: ['read', 'write'], customers: ['read', 'write'], returns: ['read', 'write'], chat: ['read', 'write'] },
  viewer: { catalog: ['read'], orders: ['read'], customers: ['read'], analytics: ['read'] },
};

function getModuleFromPath(path: string): PolicyModule {
  if (path.includes('/payments')) return 'payments';
  if (path.includes('/delivery') || path.includes('/shipments') || path.includes('/fulfillment')) return 'delivery';
  if (path.includes('/returns')) return 'returns';
  if (path.includes('/customers')) return 'customers';
  if (path.includes('/team')) return 'team';
  if (path.includes('/governance')) return 'governance';
  if (path.includes('/chat') || path.includes('/notifications')) return 'chat';
  if (path.includes('/analytics')) return 'analytics';
  if (path.includes('/orders')) return 'orders';
  if (path.includes('/settings')) return 'settings';
  return 'catalog';
}

function getActionFromMethod(method: string): PolicyAction {
  if (method === 'GET') return 'read';
  if (method === 'DELETE') return 'delete';
  return 'write';
}

function hasOverridePermission(overrides: unknown, module: PolicyModule, action: PolicyAction): boolean | null {
  if (!overrides || typeof overrides !== 'object') return null;
  const moduleConfig = (overrides as Record<string, unknown>)[module];
  if (!moduleConfig || typeof moduleConfig !== 'object') return null;
  const allowed = (moduleConfig as Record<string, unknown>).actions;
  if (!Array.isArray(allowed)) return null;
  return allowed.includes(action);
}

export function requireAdminPolicy() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
      res.status(401).json({ error: 'Admin authentication required' });
      return;
    }
    const role = normalizeAdminRole(req.admin.role);
    const module = getModuleFromPath(req.path || req.originalUrl || '');
    const action = getActionFromMethod(req.method);

    const baselineAllowed = (ROLE_BASELINE[role] ?? {})[module]?.includes(action) ?? false;
    const overrides = await getRolePermissions(role);
    const overrideAllowed = hasOverridePermission(overrides, module, action);
    const allowed = overrideAllowed === null ? baselineAllowed : overrideAllowed;

    if (!allowed) {
      res.status(403).json({ error: 'Insufficient permissions', module, action, role });
      return;
    }
    next();
  };
}

