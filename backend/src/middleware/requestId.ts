import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

function sanitizeRequestId(raw: string | undefined): string | null {
  if (!raw || raw.length > 128) return null;
  if (!/^[\w.+/=-]+$/.test(raw)) return null;
  return raw.slice(0, 128);
}

/**
 * Ensures every request has a stable id for logs and downstream propagation (Java, etc.).
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = sanitizeRequestId(req.get(HEADER) || undefined);
  const id = incoming || randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
