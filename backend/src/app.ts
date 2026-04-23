import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIoServer } from 'socket.io';

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
import deliveryRouter from './routes/delivery';
import storefrontRouter from './routes/storefront';
import uploadRouter from './routes/upload';
import webhookRouter from './routes/webhooks';
import adminRouter from './routes/admin/index';
import { startCartAbandonmentCron } from './services/cartAbandonmentService';
import { apiCatalogHandler } from './routes/api-catalog';
import { coreApiProxy, coreApiChatProxy, CORE_API_URL } from './proxy/springBootProxy';
import { getRedisClient } from './cache/redisClient';

/** Browser origins allowed to call the BFF (storefront + Vite admin + legacy ports). */
function buildAllowedOrigins(): string[] {
  const explicit = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.ADMIN_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];
  return [...new Set(explicit.map((o) => o.trim()).filter(Boolean))];
}

const allowedCorsOrigins = buildAllowedOrigins();

function corsOriginCheck(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
  if (!origin) return cb(null, true);
  if (allowedCorsOrigins.includes(origin)) return cb(null, true);

  if (process.env.NODE_ENV !== 'production') {
    // Allow local dev hosts (localhost/127.0.0.1/::1) and LAN IPs for mobile testing.
    const ok = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?$/.test(origin);
    if (ok) return cb(null, true);
  }

  return cb(new Error(`CORS blocked for origin: ${origin}`));
}

const app = express();
const httpServer = createServer(app);

export const io = new SocketIoServer(httpServer, {
  cors: {
    origin: corsOriginCheck,
    credentials: true,
  },
});

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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

app.get('/api', apiCatalogHandler);

// ─── BFF-native routes (stay in Node.js) ─────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/ob-points', obPointsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/profile', profileRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/delivery', deliveryRouter);
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

// ─── BFF-native admin routes (must come BEFORE coreApiProxy) ────────────────

app.use('/api/admin', adminRouter);

// ─── Proxied to Spring Boot Core API (catch-all for anything not in adminRouter) ─

app.use('/api/admin', coreApiProxy);

// ─── Chat API proxy to Spring Boot (storefront chat widget) ─────────────────

app.use('/api/chat', coreApiChatProxy);

// ─── Socket.io rooms & realtime events ───────────────────────────────────────

io.on('connection', (socket) => {
  // Ticket realtime rooms (customer joins specific ticket)
  socket.on('join:ticket', (ticketId: string) => {
    socket.join(`ticket:${ticketId}`);
  });
  socket.on('leave:ticket', (ticketId: string) => {
    socket.leave(`ticket:${ticketId}`);
  });

  // Admin CRM chat room — receives ALL ticket events
  socket.on('join:admin-chat', () => {
    socket.join('admin:chat');
  });
  socket.on('leave:admin-chat', () => {
    socket.leave('admin:chat');
  });

  // User-specific room for cart + notification events
  socket.on('join:user', (userId: string) => {
    socket.join(`user:${userId}`);
  });
  socket.on('leave:user', (userId: string) => {
    socket.leave(`user:${userId}`);
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

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  }
);

// ─── Initialize Redis (non-blocking) ─────────────────────────────────────────

getRedisClient().catch((err) => console.warn('[redis] Initial connect failed, caching disabled:', err.message));

// ─── Start ───────────────────────────────────────────────────────────────────

// ─── Cart abandonment cron ───────────────────────────────────────────────────────

if (process.env.CART_ABANDONMENT_CRON !== 'false') {
  startCartAbandonmentCron();
}

const PORT = parseInt(process.env.PORT || '4000', 10);
httpServer.listen(PORT, () => {
  console.log(`\n  Oceanbazar BFF running on http://localhost:${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   Core API: ${CORE_API_URL}`);
  console.log(`   DB: ${process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, '://<credentials>@')}\n`);
});

export default app;
