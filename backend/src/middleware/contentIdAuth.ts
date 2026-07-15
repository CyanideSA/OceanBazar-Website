import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface ContentIdAuthPayload {
  type: 'content_id';
  email: string;
  oid: string;
  name?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      contentIdUser?: ContentIdAuthPayload;
    }
  }
}

export function signContentIdToken(user: Omit<ContentIdAuthPayload, 'type'>): string {
  const payload: ContentIdAuthPayload = { type: 'content_id', ...user };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '12h' });
}

export function requireContentIdUser(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as ContentIdAuthPayload & {
      iat: number;
      exp: number;
    };
    if (payload.type !== 'content_id' || !payload.email || !payload.oid) {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }
    req.contentIdUser = {
      type: 'content_id',
      email: payload.email,
      oid: payload.oid,
      name: payload.name,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
