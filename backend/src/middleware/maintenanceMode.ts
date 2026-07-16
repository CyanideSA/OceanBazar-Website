import type { Request, Response, NextFunction } from 'express';

export const MAINTENANCE_BYPASS_COOKIE = 'ob_maint_bypass';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

export function isMaintenanceModeEnabled(): boolean {
  const v = process.env.MAINTENANCE_MODE?.trim().toLowerCase();
  return v !== undefined && TRUTHY.has(v);
}

function bypassToken(): string | undefined {
  const t = process.env.MAINTENANCE_BYPASS_TOKEN?.trim();
  return t || undefined;
}

/** Staff bypass: header, query, or httpOnly cookie (set by storefront middleware). */
export function maintenanceBypassOk(req: Request): boolean {
  const token = bypassToken();
  if (!token) return false;
  const header = req.headers['x-maintenance-bypass'];
  if (typeof header === 'string' && header === token) return true;
  const q = req.query.bypass;
  if (typeof q === 'string' && q === token) return true;
  const cookie = req.cookies?.[MAINTENANCE_BYPASS_COOKIE];
  if (typeof cookie === 'string' && cookie === token) return true;
  return false;
}

function allowHealthProbe(req: Request): boolean {
  if (process.env.MAINTENANCE_ALLOW_HEALTH_PROBE !== 'true') return false;
  return (
    req.method === 'GET' &&
    (req.path === '/api/health' || req.path === '/health' || req.path === '/metrics')
  );
}

export function maintenanceModeMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isMaintenanceModeEnabled()) {
    next();
    return;
  }
  if (maintenanceBypassOk(req) || allowHealthProbe(req)) {
    next();
    return;
  }
  if (req.method === 'POST' && req.path === '/api/client-errors') {
    next();
    return;
  }

  res.setHeader('Retry-After', process.env.MAINTENANCE_RETRY_AFTER || '3600');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('X-Maintenance-Mode', '1');
  res.status(503).json({
    error: 'Service Unavailable',
    maintenance: true,
    message: 'OceanBazar is temporarily unavailable while we prepare for launch.',
  });
}
