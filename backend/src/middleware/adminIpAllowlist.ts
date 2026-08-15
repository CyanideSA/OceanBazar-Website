import type { Request, Response, NextFunction } from 'express';

function parseAllowlist(): string[] | null {
  const raw = process.env.ADMIN_ALLOWED_IPS?.trim();
  if (!raw) return null;
  return [...new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0].trim();
  }
  const rip = req.socket.remoteAddress;
  if (rip) return rip;
  return '';
}

const allowlist = parseAllowlist();

/**
 * When ADMIN_ALLOWED_IPS is set (comma/space-separated), only those IPs may reach /api/admin.
 * Place behind a trusted reverse proxy and set X-Forwarded-For correctly in production.
 */
export function adminIpAllowlist(req: Request, res: Response, next: NextFunction) {
  if (!allowlist || allowlist.length === 0) return next();

  const ip = clientIp(req);
  const ok =
    allowlist.includes(ip) ||
    allowlist.some((entry) => entry === '*' || (entry.endsWith('*') && ip.startsWith(entry.slice(0, -1))));

  if (!ok) {
    res.status(403).json({ error: 'Admin access denied from this network' });
    return;
  }
  next();
}
