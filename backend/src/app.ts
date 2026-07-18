import 'dotenv/config';
import './tracing';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIoServer } from 'socket.io';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { prisma } from './lib/prisma';

import authRouter from './routes/auth';
import productsRouter from './routes/products';
import categoriesRouter from './routes/categories';
import ticketsRouter from './routes/tickets';
import brandsRouter from './routes/brands';
import reviewsRouter from './routes/reviews';
import searchRouter from './routes/search';
import obPointsRouter from './routes/ob-points';
import cartRouter from './routes/cart';
import ordersRouter from './routes/orders';
import profileRouter from './routes/profile';
import paymentsRouter from './routes/payments';
import customersRouter from './routes/customers';
import returnsRouter from './routes/returns';
import disputesRouter from './routes/disputes';
import wishlistRouter from './routes/wishlist';
import deliveryRouter from './routes/delivery';
import wholesaleRouter from './routes/wholesale';
import storefrontRouter from './routes/storefront';
import uploadRouter from './routes/upload';
import webhookRouter from './routes/webhooks';
import metaWebhookRouter from './routes/webhooks/meta';
import adminRouter from './routes/admin/index';
import chatRouter from './routes/chat';
import pushRouter from './routes/push';
import referralRouter from './routes/referral';
import abRouter from './routes/ab';
import flashSalesRouter from './routes/flash-sales';
import newsletterRouter from './routes/newsletter';
import qaRouter from './routes/qa';
import pwaAnalyticsRouter from './routes/pwa-analytics';
import clientErrorsRouter from './routes/client-errors';
import contentIdRouter from './routes/contentId';
import seoPublicRouter from './routes/seo';

import { startCartAbandonmentCron } from './services/cartAbandonmentService';
import { ensureAdminGovernanceSchema } from './lib/adminGovernance';
import { apiCatalogHandler } from './routes/api-catalog';
import { coreApiProxy, CORE_API_URL } from './proxy/springBootProxy';
import { getRedisClient } from './cache/redisClient';
import { registerIo } from './lib/adminEvents';
import { requestIdMiddleware } from './middleware/requestId';
import { adminIpAllowlist } from './middleware/adminIpAllowlist';
import {
  isMaintenanceModeEnabled,
  maintenanceModeMiddleware,
} from './middleware/maintenanceMode';
import { featureFlagMiddleware } from './middleware/featureFlags';
import { metricsMiddleware, metricsRouter, realtimeConnections } from './metrics/prometheus';
import { startRedisEventBridge } from './realtime/redisEventBridge';
import { startAnalyticsCron } from './jobs/analyticsAggregation';
import { startMlRecomputeCron } from './jobs/mlRecompute';
import { startCampaignJourneyCron } from './jobs/campaignJourney';
import { startMetaScheduler } from './jobs/metaScheduler';
import { startFlashSaleLifecycleCron } from './jobs/flashSaleLifecycle';
import { startDlqWorker } from './events/dlqWorker';
import { Sentry } from './tracing';
import { env } from './config/env';

/** Extra origins from CORS_ALLOWED_ORIGINS (comma-separated). Required on ECS when storefront/admin use real HTTPS hostnames. */
function parseCommaSeparatedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Browser origins allowed to call the BFF (storefront + Vite admin + legacy ports). */
function buildAllowedOrigins(): string[] {
  const explicit = [
    ...parseCommaSeparatedOrigins(env.CORS_ALLOWED_ORIGINS),
    env.CLIENT_URL || 'http://localhost:3000',
    'http://127.0.0.1:3000',
    env.ADMIN_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    process.env.CONTENT_ID_APP_URL || 'http://localhost:5180',
    'http://localhost:5180',
    'http://127.0.0.1:5180',
  ];
  return [...new Set(explicit.map((o) => o.trim()).filter(Boolean))];
}

const allowedCorsOrigins = buildAllowedOrigins();

// Matches any localhost / 127.0.0.1 / ::1 / LAN origin on any port — always allowed
// so that local dev tools (Vite :5173, Windsurf preview :8203, etc.) can reach the BFF
// without needing to enumerate every possible port.
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$/;

function corsOriginCheck(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
  // 'null' (literal string) is sent by browsers on cross-origin redirects from HTTPS
  // payment gateways (SSLCommerz/bKash) back to this local HTTP server.
  if (!origin || origin === 'null') return cb(null, true);
  if (allowedCorsOrigins.includes(origin)) return cb(null, true);
  if (LOCAL_ORIGIN_RE.test(origin)) return cb(null, true);
  return cb(new Error(`CORS blocked for origin: ${origin}`));
}

const app = express();

const trustProxy = env.TRUST_PROXY?.trim();
if (trustProxy === '1' || trustProxy?.toLowerCase() === 'true') {
  app.set('trust proxy', 1);
} else if (trustProxy && /^\d+$/.test(trustProxy)) {
  app.set('trust proxy', parseInt(trustProxy, 10));
}

const httpServer = createServer(app);

export const io = new SocketIoServer(httpServer, {
  cors: {
    origin: corsOriginCheck,
    credentials: true,
  },
});

registerIo(io);

type SocketIdentity = {
  userId: string | null;
  role: string | null;
  isAdmin: boolean;
};

function verifyRealtimeToken(rawToken: string | undefined): SocketIdentity {
  if (!rawToken) return { userId: null, role: null, isAdmin: false };
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
  const secretCandidates = [
    process.env.JWT_ACCESS_SECRET,
    process.env.JWT_SECRET_KEY,
  ].filter(Boolean) as string[];
  for (const secret of secretCandidates) {
    try {
      const decoded = jwt.verify(token, secret) as JwtPayload & {
        userId?: string; sub?: string; role?: string; adminId?: string; admin_id?: string;
      };
      const role = decoded.role ? String(decoded.role).toUpperCase() : null;
      const adminId = decoded.adminId ?? decoded.admin_id ?? null;
      const userId = decoded.userId ?? decoded.sub ?? adminId ?? null;
      const isAdmin = Boolean(adminId) || role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'STAFF';
      return { userId: userId ? String(userId) : null, role, isAdmin };
    } catch {
      // try next secret
    }
  }
  return { userId: null, role: null, isAdmin: false };
}

// ─── Core middleware ──────────────────────────────────────────────────────────

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: corsOriginCheck,
    credentials: true,
  })
);
app.use(compression());
app.use(cookieParser());
app.use(
  '/api/webhooks/meta',
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
  metaWebhookRouter,
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(requestIdMiddleware);

// ─── Global maintenance lock (503) — set MAINTENANCE_MODE=true in production ─
app.use(maintenanceModeMiddleware);
app.use(featureFlagMiddleware);
app.use(metricsMiddleware());
app.use('/metrics', metricsRouter);

// ─── Static uploads ──────────────────────────────────────────────────────────

app.use(
  '/uploads',
  express.static(
    path.resolve(process.env.UPLOAD_DIR || './uploads'),
    { maxAge: '1d' }
  )
);

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'oceanbazar-api', ts: new Date().toISOString() });
});

/** When BFF is hit directly on :4001, point browsers to the Admin CRM on :4000 */
app.get('/', (_req, res) => {
  const adminUrl = process.env.ADMIN_URL || 'http://127.0.0.1:4000';
  res.redirect(302, adminUrl);
});

app.get('/api', apiCatalogHandler);

// ─── BFF-native routes (stay in Node.js) ─────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/ob-points', obPointsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/profile', profileRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/push', pushRouter);
app.use('/api/referral', referralRouter);
app.use('/api/ab', abRouter);
app.use('/api/customers', customersRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/disputes', disputesRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/wholesale', wholesaleRouter);
app.use('/api/upload', uploadRouter);

// ─── Courier webhooks (no auth, validated by signature) ─────────────────────────

app.use('/api/webhooks', webhookRouter);

// ─── BFF search (cached, proxies to Spring Boot) ────────────────────────────

app.use('/api/search', searchRouter);

// ─── BFF cached routes (Node handles caching, proxies to Spring Boot) ────────

app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/reviews', reviewsRouter);

// ─── Storefront public settings (no auth required) ─────────────────────────

app.use('/api/storefront', storefrontRouter);
app.use('/api/seo', seoPublicRouter);
app.use('/api/flash-sales', flashSalesRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/qa', qaRouter);
app.use('/api/analytics', pwaAnalyticsRouter);
app.use('/api/client-errors', clientErrorsRouter);
app.use('/api/content-id', contentIdRouter);


// ─── BFF-native admin routes (must come BEFORE coreApiProxy) ────────────────

app.use('/api/admin', adminIpAllowlist);
app.use('/api/admin', adminRouter);

// ─── Proxied to Spring Boot Core API (catch-all for anything not in adminRouter) ─

app.use('/api/admin', coreApiProxy);

// ─── BFF-native live chat (replaces Java proxy for /api/chat) ───────────────

app.use('/api/chat', chatRouter);

// ─── Socket.io rooms & realtime events ───────────────────────────────────────

io.use((socket, next) => {
  if (!isMaintenanceModeEnabled()) return next();
  const token = process.env.MAINTENANCE_BYPASS_TOKEN?.trim();
  if (!token) return next(new Error('maintenance'));
  const header = socket.handshake.headers['x-maintenance-bypass'];
  const auth = socket.handshake.auth?.bypass as string | undefined;
  const cookieHeader = socket.handshake.headers.cookie ?? '';
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)ob_maint_bypass=([^;]+)/);
  const cookieVal = cookieMatch?.[1] ? decodeURIComponent(cookieMatch[1]) : '';
  if (header === token || auth === token || cookieVal === token) return next();
  return next(new Error('maintenance'));
});

io.on('connection', (socket) => {
  realtimeConnections.inc();
  socket.on('disconnect', () => realtimeConnections.dec());

  const identity = verifyRealtimeToken(
    (socket.handshake.auth?.token as string | undefined)
    || (socket.handshake.headers.authorization as string | undefined)
  );
  const visitorIdentity = String(socket.handshake.auth?.visitorId || '').trim();

  // Ticket realtime rooms (customer joins specific ticket)
  socket.on('join:ticket', (ticketId: string) => {
    if (!identity.userId) return;
    socket.join(`ticket:${ticketId}`);
  });
  socket.on('leave:ticket', (ticketId: string) => {
    socket.leave(`ticket:${ticketId}`);
  });

  // Admin CRM chat room — receives ALL ticket events
  socket.on('join:admin-chat', () => {
    if (!identity.isAdmin) return;
    socket.join('admin:chat');
  });
  socket.on('leave:admin-chat', () => {
    socket.leave('admin:chat');
  });

  // User-specific room for cart + notification + live chat events
  socket.on('join:user', (userId: string) => {
    const isOwnAccount = identity.userId && String(identity.userId) === String(userId);
    const isOwnVisitor = visitorIdentity && visitorIdentity === String(userId);
    if (!isOwnAccount && !isOwnVisitor) return;
    socket.join(`user:${userId}`);
  });
  socket.on('leave:user', (userId: string) => {
    socket.leave(`user:${userId}`);
  });

  // Live chat session room — customer joins their own session room
  socket.on('join:chat', async (sessionId: string) => {
    if (identity.isAdmin) { socket.join(`chat:${sessionId}`); return; }
    const session = await (prisma as any).chat_sessions.findUnique({ where: { id: sessionId } });
    const ownsAsAccount = identity.userId && String(session?.user_id) === String(identity.userId);
    const ownsAsVisitor = visitorIdentity && String(session?.visitor_id) === visitorIdentity;
    if (ownsAsAccount || ownsAsVisitor) socket.join(`chat:${sessionId}`);
  });
  socket.on('leave:chat', (sessionId: string) => {
    socket.leave(`chat:${sessionId}`);
  });

  // Generic room join for admin clients (validates allowed rooms)
  const ALLOWED_ADMIN_ROOMS = ['admin:chat', 'admin:crm', 'admin:orders', 'admin:returns'];
  socket.on('join', (room: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'post-fix',hypothesisId:'CHAT-A',location:'backend/src/app.ts:socket-join',message:'Socket join request',data:{room,isAdmin:identity.isAdmin,userId:identity.userId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!identity.isAdmin) return;
    if (ALLOWED_ADMIN_ROOMS.includes(room)) socket.join(room);
  });
  socket.on('leave', (room: string) => {
    if (ALLOWED_ADMIN_ROOMS.includes(room)) socket.leave(room);
  });
});

/**
 * Emit cart update event to a specific user.
 * Called by BFF when proxy receives cart mutation responses from Spring Boot.
 */
export function emitCartUpdate(userId: string, cartData: unknown) {
  io.to(`user:${userId}`).emit('cart:updated', cartData);
}

/**
 * Emit notification event to a specific user.
 */
export function emitNotification(userId: string, notification: unknown) {
  io.to(`user:${userId}`).emit('notification:new', notification);
}

/**
 * Broadcast to all connected clients (admin alerts, system-wide).
 */
export function emitBroadcast(event: string, data: unknown) {
  io.emit(event, data);
}

// Re-export for convenience; actual impl is in adminEvents.ts (avoids circular deps)
export { emitAdminEvent } from './lib/adminEvents';

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Sentry Express error capture (before final JSON error handler) ─────────

Sentry.setupExpressErrorHandler(app);

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    const isProd = process.env.NODE_ENV === 'production';
    res.status(err.status || 500).json({
      error: isProd ? 'Internal server error' : err.message || 'Internal server error',
    });
  }
);

// ─── Initialize Redis (non-blocking) ─────────────────────────────────────────

getRedisClient().catch((err) => console.warn('[redis] Initial connect failed, caching disabled:', err.message));

// ─── Start ───────────────────────────────────────────────────────────────────

// ─── Cart abandonment cron ───────────────────────────────────────────────────────

if (process.env.CART_ABANDONMENT_CRON !== 'false' && process.env.BFF_BACKGROUND_JOBS !== 'false') {
  startCartAbandonmentCron();
}

const PORT = env.PORT;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Oceanbazar BFF running on http://0.0.0.0:${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   Core API: ${CORE_API_URL}`);
  console.log(`   DB: ${process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, '://<credentials>@')}\n`);
  ensureAdminGovernanceSchema().catch((err) =>
    console.warn('[admin-governance] schema ensure failed:', (err as Error)?.message),
  );
  void startRedisEventBridge(io);
  if (process.env.BFF_BACKGROUND_JOBS !== 'false') {
    if (process.env.ANALYTICS_CRON !== 'false') startAnalyticsCron();
    startMlRecomputeCron();
    startCampaignJourneyCron();
    startFlashSaleLifecycleCron();
    startDlqWorker();
    if (process.env.META_SCHEDULER !== 'false') startMetaScheduler();
  }
});

export default app;
