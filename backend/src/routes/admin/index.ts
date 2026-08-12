import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin, requireRole } from '../../middleware/auth';
import { adminOrderListingLimiter, adminMutationLimiter } from '../../middleware/rateLimiter';
import { generateEntityId, generateTrackingNumber, generateSlug } from '../../utils/hexId';
import { invalidateCache } from '../../cache/cacheMiddleware';
import { uploadImage, uploadMedia, deleteImage } from '../../services/cloudinaryService';
import { attachVariantLabels } from '../../utils/variantLabel';
import fileImportRouter from './file-import';
import obPointsAdminRouter from './ob-points';
import ticketsAdminRouter from './tickets';
import studioRouter from './studio';
import inventoryRouter from './inventory';
import returnsRouter from './returns';
import deliveryAdminRouter from './delivery';
import paymentsAdminRouter from './payments';
import couponsAdminRouter from './coupons';
import disputesRouter from './disputes';
import chatAdminRouter from './chat';
import notificationsRouter from './notifications';
import applicationsRouter from './applications';
import teamRouter from './team';
import auditLogsRouter from './audit-logs';
import globalSettingsRouter from './global-settings';
import trustBadgesAdminRouter from './trust-badges';
import analyticsRouter from './analytics';
import codOtpRouter from './cod-otp';
import governanceRouter from './governance';
import emailRouter from './email';
import emailTemplatesRouter from './email-templates';
import seoRouter from './seo';
import intelligenceRouter from './intelligence';
import marketingRouter from './marketing';
import metaAdminRouter from './meta';
import communicationsRouter from './communications';
import integrationsRouter from './integrations';
import clientErrorsAdminRouter from './client-errors';
import { refreshProductReviewStats } from '../../services/reviewService';
import { routeParam } from '../../utils/params';
import { emitAdminEvent, emitToRoom, emitToUser, emitBroadcast } from '../../lib/adminEvents';
import {
  buildOtpAuthUrl,
  formatManualEntryKey,
  generateBase32Secret,
  normalizeTotpSecret,
  totpSecretHint,
  verifyAdminTotp,
  verifySetupTotp,
} from '../../utils/totp';
import { trackAdminSession } from '../../services/adminSessionService';
import { getRedisClient } from '../../cache/redisClient';
import {
  buildMicrosoftAuthorizeUrl,
  createSsoHandoffCode,
  consumeSsoHandoffCode,
  exchangeMicrosoftCode,
  isMicrosoftSsoConfigured,
} from '../../services/microsoftSsoService';
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  isGoogleSsoConfigured,
} from '../../services/googleSsoService';
import { findAdminForMicrosoftClaims, findAdminForGoogleClaims } from '../../services/adminSsoLinkService';
import { exchangeAndStoreMetaAccount } from '../../services/meta/metaOAuthService';
import { requireAdminPolicy } from '../../middleware/adminPolicy';
import { recordAdminAudit } from '../../lib/adminAudit';
import { requireAdminReauth, signReauthToken } from '../../middleware/adminReauth';
import { notifyCustomer } from '../../services/customerNotify';

const router = Router();
const enforceAdminPolicy = requireAdminPolicy();

type Pending2faSetup = {
  secret: string;
  setupToken: string;
  otpauthUrl: string;
  expiresAt: number;
};

/** In-memory + Redis — survives BFF restart during enrollment. */
const pending2faSetupByAdmin = new Map<number, Pending2faSetup>();
const PENDING_2FA_TTL_SEC = 600;

function pendingRedisKey(adminId: number): string {
  return `admin:2fa:pending:${adminId}`;
}

function secretFingerprint(secret: string): string {
  return normalizeTotpSecret(secret).slice(0, 4) + '…' + normalizeTotpSecret(secret).slice(-4);
}

/** Local Docker dev: password-only admin login; do not enable 2FA without a valid GA code. */
function isAdmin2faDevMode(): boolean {
  return (
    process.env.ADMIN_2FA_ONBOARDING_BYPASS === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

async function persistPendingSetup(adminId: number, entry: Pending2faSetup): Promise<void> {
  pending2faSetupByAdmin.set(adminId, entry);
  try {
    const redis = await getRedisClient();
    await redis.setEx(pendingRedisKey(adminId), PENDING_2FA_TTL_SEC, JSON.stringify(entry));
  } catch {
    /* Redis optional — memory map still works on single instance */
  }
}

async function loadPendingSetup(adminId: number): Promise<Pending2faSetup | undefined> {
  try {
    const redis = await getRedisClient();
    const raw = await redis.get(pendingRedisKey(adminId));
    if (raw) {
      const parsed = JSON.parse(raw) as Pending2faSetup;
      if (parsed.expiresAt > Date.now()) {
        pending2faSetupByAdmin.set(adminId, parsed);
        return parsed;
      }
    }
  } catch {
    /* fall through */
  }
  const mem = pending2faSetupByAdmin.get(adminId);
  if (mem && mem.expiresAt > Date.now()) return mem;
  return undefined;
}

function pendingSetupResponse(pending: Pending2faSetup, accountLabel: string) {
  const urlSecret = (() => {
    try {
      return new URL(pending.otpauthUrl).searchParams.get('secret') || '';
    } catch {
      return '';
    }
  })();
  const urlMatches = normalizeTotpSecret(urlSecret) === normalizeTotpSecret(pending.secret);
  return {
    setupToken: pending.setupToken,
    secret: pending.secret,
    otpauthUrl: pending.otpauthUrl,
    secretHint: totpSecretHint(pending.secret),
    manualEntryKey: formatManualEntryKey(pending.secret),
    accountLabel,
    urlSecretMatches: urlMatches,
  };
}

async function getOrCreatePending2faSetup(adminId: number, accountLabel: string, forceNew = false) {
  if (!forceNew) {
    const existing = await loadPendingSetup(adminId);
    if (existing) {
      return { ...existing, cacheHit: true };
    }
  } else {
    pending2faSetupByAdmin.delete(adminId);
    try {
      const redis = await getRedisClient();
      await redis.del(pendingRedisKey(adminId));
    } catch {
      /* ignore */
    }
  }
  const secret = generateBase32Secret();
  const setupToken = jwt.sign(
    { adminId, purpose: 'admin_2fa_setup' },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '10m' } as jwt.SignOptions
  );
  const otpauthUrl = buildOtpAuthUrl('OceanBazarAdmin', accountLabel, secret);
  const entry: Pending2faSetup = {
    secret,
    setupToken,
    otpauthUrl,
    expiresAt: Date.now() + PENDING_2FA_TTL_SEC * 1000,
  };
  await persistPendingSetup(adminId, entry);
  return { ...entry, cacheHit: false };
}

router.use((req, res, next) => {
  const base = req.path || '';
  if (base.startsWith('/auth/login')) return next();
  if (base.startsWith('/auth/onboarding')) return next();
  if (base.startsWith('/auth/forgot-password')) return next();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return adminMutationLimiter(req, res, next);
  }
  next();
});

router.use((req, res, next) => {
  const base = req.path || '';
  if (base.startsWith('/auth/login')) return next();
  if (base.startsWith('/auth/login-2fa')) return next();
  if (base.startsWith('/auth/onboarding')) return next();
  if (base.startsWith('/auth/forgot-password')) return next();
  if (base.startsWith('/auth/sso/')) return next();
  if (base === '/meta/oauth/callback' && req.method === 'GET') return next();
  // EventSource cannot send Authorization — /live/stream authenticates via ?token=
  if (base === '/live/stream' || base.startsWith('/live/stream?')) return next();
  return requireAdmin(req, res, () => enforceAdminPolicy(req, res, next));
});

router.use((req, res, next) => {
  if (!req.admin) return next();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const startedAt = Date.now();
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 400) return;
    // target_id is VARCHAR(50); full path stored in details.fullPath by recordAdminAudit.
    const pathParts = String(req.path || '').split('/').filter(Boolean);
    const shortTarget = pathParts[0] || req.path || 'route';
    void recordAdminAudit(req, {
      action: `${req.method} ${req.path}`,
      targetType: 'admin_route',
      targetId: shortTarget,
      details: {
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        fullPath: req.path,
      },
    }).catch(() => {});
  });
  next();
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Admin auth (must be registered before studioRouter, which uses requireAdmin) ─

type AdminSecurityFlags = { twoFaEnabled: boolean; mustChangePassword: boolean; mustResetTwoFa: boolean };

async function getAdminSecurityFlags(adminId: number): Promise<AdminSecurityFlags> {
  try {
    const row = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { twoFaEnabled: true, mustChangePassword: true, mustResetTwoFa: true },
    });
    return {
      twoFaEnabled: Boolean(row?.twoFaEnabled),
      mustChangePassword: Boolean(row?.mustChangePassword),
      mustResetTwoFa: Boolean(row?.mustResetTwoFa),
    };
  } catch {
    return { twoFaEnabled: false, mustChangePassword: false, mustResetTwoFa: false };
  }
}

function needsAuthenticatorSetup(flags: AdminSecurityFlags): boolean {
  return flags.mustResetTwoFa || !flags.twoFaEnabled;
}

function adminPublicProfile(admin: { id: number; name: string; email: string; role: string; profileImage?: string | null }) {
  return { id: admin.id, name: admin.name, email: admin.email, role: admin.role, profileImage: admin.profileImage ?? null };
}

/** Shared post-auth gate used by password login and SSO exchange. */
async function respondWithAdminAuthGate(
  admin: { id: number; role: string; name: string; email: string; profileImage?: string | null },
  req: Request,
  res: Response,
  options?: { skipTotpChallenge?: boolean },
): Promise<boolean> {
  const flags = await getAdminSecurityFlags(admin.id);
  const profile = adminPublicProfile(admin);

  if (isAdmin2faDevMode()) {
    await finalizeAdminLogin(admin.id, admin.role, req, res);
    return true;
  }

  if (flags.mustChangePassword) {
    res.json({
      requiresPasswordChange: true,
      onboardingToken: signOnboardingToken(admin.id, admin.role, 'password'),
      admin: profile,
    });
    return true;
  }

  if (needsAuthenticatorSetup(flags)) {
    res.json({
      requires2faSetup: true,
      onboardingToken: signOnboardingToken(admin.id, admin.role, '2fa_setup'),
      admin: profile,
      mustResetTwoFa: flags.mustResetTwoFa,
    });
    return true;
  }

  // Microsoft / Google SSO: authenticator not required once enrolled.
  if (options?.skipTotpChallenge) {
    await finalizeAdminLogin(admin.id, admin.role, req, res);
    return true;
  }

  // Emergency password login: always challenge authenticator.
  const tempToken = jwt.sign(
    { adminId: admin.id, role: admin.role, purpose: 'admin_2fa' },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '5m' } as jwt.SignOptions,
  );
  res.json({ requires2fa: true, tempToken, admin: profile });
  return true;
}

function signOnboardingToken(adminId: number, role: string, step: 'password' | '2fa_setup') {
  return jwt.sign(
    { adminId, role, purpose: 'admin_onboarding', step },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '15m' } as jwt.SignOptions
  );
}

async function verifyAndConsumeAdminTotp(
  adminId: number,
  secret: string,
  otp: string,
  options?: { skipReplayCheck?: boolean }
): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'replay' }> {
  const normalizedSecret = normalizeTotpSecret(secret);
  const check = verifyAdminTotp(normalizedSecret, otp);
  if (!check.valid || check.periodCounter === undefined) {
    return { ok: false, reason: 'invalid' };
  }

  if (!options?.skipReplayCheck) {
    let lastCounter: number | null = null;
    try {
      const rows = await prisma.$queryRaw<Array<{ two_fa_last_counter: number | null }>>`
        SELECT two_fa_last_counter FROM admin_users WHERE id = ${adminId} LIMIT 1
      `;
      lastCounter = rows[0]?.two_fa_last_counter ?? null;
    } catch {
      /* column may not exist until migration applied */
    }
    if (lastCounter != null && check.periodCounter <= lastCounter) {
      return { ok: false, reason: 'replay' };
    }
    try {
      await prisma.$executeRaw`
        UPDATE admin_users SET two_fa_last_counter = ${check.periodCounter} WHERE id = ${adminId}
      `;
    } catch {
      /* non-fatal if column missing */
    }
  }

  return { ok: true };
}

async function finalizeAdminLogin(adminId: number, role: string, req: Request, res: Response) {
  const token = jwt.sign({ adminId, role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '8h' } as jwt.SignOptions);
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }
  await trackAdminSession(admin.id, req).catch(() => {});
  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'admin_login',
      targetType: 'admin_user',
      targetId: String(admin.id),
      details: { ip: req.ip, userAgent: req.headers['user-agent'] },
    },
  }).catch(() => {});
  res.json({ token, admin: adminPublicProfile(admin) });
}

function adminAppUrl(): string {
  return (process.env.ADMIN_URL || 'http://localhost:5173').replace(/\/$/, '');
}

router.get('/auth/sso/status', (_req: Request, res: Response) => {
  res.json({
    microsoft: isMicrosoftSsoConfigured(),
    google: isGoogleSsoConfigured(),
  });
});

router.get('/auth/sso/microsoft/start', async (_req: Request, res: Response) => {
  const result = await buildMicrosoftAuthorizeUrl();
  if ('error' in result) {
    res.status(503).json({ error: result.error });
    return;
  }
  res.redirect(result.url);
});

router.get('/auth/sso/microsoft/callback', async (req: Request, res: Response) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const base = adminAppUrl();
  if (!code || !state) {
    res.redirect(`${base}/?sso_error=missing_params`);
    return;
  }
  const exchanged = await exchangeMicrosoftCode(code, state);
  if ('error' in exchanged) {
    res.redirect(`${base}/?sso_error=${encodeURIComponent(exchanged.error)}`);
    return;
  }
  const admin = await findAdminForMicrosoftClaims(exchanged.claims);
  if (!admin) {
    res.redirect(`${base}/?sso_error=not_provisioned`);
    return;
  }
  const handoff = await createSsoHandoffCode({ adminId: admin.id, role: admin.role });
  if (!handoff) {
    res.redirect(`${base}/?sso_error=handoff_failed`);
    return;
  }
  await trackAdminSession(admin.id, req).catch(() => {});
  res.redirect(`${base}/?sso_code=${handoff}`);
});

router.get('/auth/sso/google/start', async (_req: Request, res: Response) => {
  const result = await buildGoogleAuthorizeUrl();
  if ('error' in result) {
    res.status(503).json({ error: result.error });
    return;
  }
  res.redirect(result.url);
});

router.get('/auth/sso/google/callback', async (req: Request, res: Response) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const base = adminAppUrl();
  if (!code || !state) {
    res.redirect(`${base}/?sso_error=missing_params`);
    return;
  }
  const exchanged = await exchangeGoogleCode(code, state);
  if ('error' in exchanged) {
    res.redirect(`${base}/?sso_error=${encodeURIComponent(exchanged.error)}`);
    return;
  }
  const admin = await findAdminForGoogleClaims(exchanged.claims);
  if (!admin) {
    res.redirect(`${base}/?sso_error=not_provisioned`);
    return;
  }
  const handoff = await createSsoHandoffCode({ adminId: admin.id, role: admin.role });
  if (!handoff) {
    res.redirect(`${base}/?sso_error=handoff_failed`);
    return;
  }
  await trackAdminSession(admin.id, req).catch(() => {});
  res.redirect(`${base}/?sso_code=${handoff}`);
});

router.get('/meta/oauth/callback', async (req: Request, res: Response) => {
  const code = String(req.query.code || '');
  const base = adminAppUrl();
  if (!code) {
    res.redirect(`${base}/?meta_oauth_error=missing_code`);
    return;
  }
  const result = await exchangeAndStoreMetaAccount(code, 'oauth_redirect');
  if (!result.ok) {
    res.redirect(`${base}/?meta_oauth_error=${encodeURIComponent(result.error)}`);
    return;
  }
  const payload = JSON.stringify({ type: 'meta_oauth_success', pageId: result.pageId, igId: result.igId });
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><body><script>
    try {
      if (window.opener) {
        window.opener.postMessage(${payload}, '*');
        window.close();
      } else {
        window.location.href = '${base}/?meta_connected=1';
      }
    } catch (e) {
      window.location.href = '${base}/?meta_connected=1';
    }
  </script><p>Meta connected. You can close this window.</p></body></html>`);
});

router.post('/auth/sso/exchange', async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ error: 'code required' });
    return;
  }
  const payload = await consumeSsoHandoffCode(code);
  if (!payload) {
    res.status(401).json({ error: 'invalid_or_expired_handoff' });
    return;
  }
  const admin = await prisma.adminUser.findUnique({ where: { id: payload.adminId } });
  if (!admin || !admin.active) {
    res.status(401).json({ error: 'inactive' });
    return;
  }
  // #region agent log
  try {
    const fs = await import('fs');
    const flags = await getAdminSecurityFlags(admin.id);
    fs.appendFileSync(
      'debug-7c9155.log',
      `${JSON.stringify({
        sessionId: '7c9155',
        runId: 'admin-2fa-reset',
        hypothesisId: 'H3',
        location: 'admin/index.ts:sso/exchange',
        message: 'SSO exchange auth gate',
        data: {
          adminId: admin.id,
          twoFaEnabled: flags.twoFaEnabled,
          mustResetTwoFa: flags.mustResetTwoFa,
          mustChangePassword: flags.mustChangePassword,
          skipTotp: true,
        },
        timestamp: Date.now(),
      })}\n`,
    );
  } catch { /* ignore */ }
  // #endregion
  await respondWithAdminAuthGate(admin, req, res, { skipTotpChallenge: true });
});

router.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  const admin = await prisma.adminUser.findFirst({
    where: { OR: [{ username }, { email: username }], active: true },
  });
  if (!admin) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // #region agent log
  try {
    const fs = await import('fs');
    const flags = await getAdminSecurityFlags(admin.id);
    fs.appendFileSync(
      'debug-7c9155.log',
      `${JSON.stringify({
        sessionId: '7c9155',
        runId: 'admin-2fa-reset',
        hypothesisId: 'H3',
        location: 'admin/index.ts:login',
        message: 'Emergency login auth gate',
        data: {
          adminId: admin.id,
          twoFaEnabled: flags.twoFaEnabled,
          mustResetTwoFa: flags.mustResetTwoFa,
          skipTotp: false,
        },
        timestamp: Date.now(),
      })}\n`,
    );
  } catch { /* ignore */ }
  // #endregion

  await respondWithAdminAuthGate(admin, req, res, { skipTotpChallenge: false });
});

function parseOtpInput(raw: unknown): string {
  return String(raw ?? '').replace(/\D+/g, '').slice(0, 6);
}

router.post('/auth/login-2fa', async (req: Request, res: Response) => {
  const { tempToken, otp: rawOtp } = req.body as { tempToken: string; otp: unknown };
  const otp = parseOtpInput(rawOtp);
  if (!tempToken || otp.length !== 6) {
    res.status(400).json({ error: 'tempToken and otp required' });
    return;
  }
  let payload: { adminId: number; role: 'super_admin' | 'admin' | 'staff'; purpose?: string };
  try {
    payload = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET!) as typeof payload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired 2FA challenge' });
    return;
  }
  if (payload.purpose !== 'admin_2fa') {
    res.status(401).json({ error: 'Invalid 2FA challenge' });
    return;
  }
  const rows = await prisma.$queryRaw<Array<{ two_fa_secret: string | null; two_fa_enabled: boolean }>>`
    SELECT two_fa_secret, COALESCE(two_fa_enabled, FALSE) AS two_fa_enabled
    FROM admin_users WHERE id = ${payload.adminId} LIMIT 1
  `;
  const row = rows[0];
  if (!row?.two_fa_enabled || !row?.two_fa_secret) {
    res.status(400).json({ error: '2FA is not enabled for this account' });
    return;
  }
  const totp = await verifyAndConsumeAdminTotp(payload.adminId, row.two_fa_secret, otp);
  if (!totp.ok) {
    if (isAdmin2faDevMode()) {
      await finalizeAdminLogin(payload.adminId, payload.role, req, res);
      return;
    }
    const msg =
      totp.reason === 'replay'
        ? 'This code was already used or has expired. Enter the latest code from your authenticator app.'
        : 'Invalid authenticator code';
    res.status(401).json({ error: msg });
    return;
  }
  await finalizeAdminLogin(payload.adminId, payload.role, req, res);
});

router.post('/auth/reauth', requireAdmin, async (req: Request, res: Response) => {
  const { otp: rawOtp, password } = req.body as { otp: unknown; password?: string };
  const otp = parseOtpInput(rawOtp);
  if (otp.length !== 6) {
    res.status(400).json({ error: 'otp required' });
    return;
  }
  const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.adminId } });
  if (!admin || !admin.active) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }
  if (password) {
    const passOk = await bcrypt.compare(password, admin.passwordHash);
    if (!passOk) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }
  }
  if (!admin.twoFaSecret || !admin.twoFaEnabled) {
    res.status(400).json({ error: '2FA is not enabled for this account' });
    return;
  }
  const check = await verifyAndConsumeAdminTotp(admin.id, admin.twoFaSecret, otp, { skipReplayCheck: true });
  if (!check.ok) {
    res.status(401).json({ error: 'Invalid authenticator code' });
    return;
  }
  const reauthToken = signReauthToken(admin.id, admin.role);
  res.json({ reauthToken, expiresIn: 300 });
});

router.post('/auth/onboarding/change-password', async (req: Request, res: Response) => {
  const { onboardingToken, newPassword } = req.body as { onboardingToken: string; newPassword: string };
  if (!onboardingToken || !newPassword) {
    res.status(400).json({ error: 'onboardingToken and newPassword required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  let payload: { adminId: number; role: string; purpose?: string; step?: string };
  try {
    payload = jwt.verify(onboardingToken, process.env.JWT_ACCESS_SECRET!) as typeof payload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired onboarding session' });
    return;
  }
  if (payload.purpose !== 'admin_onboarding' || payload.step !== 'password') {
    res.status(401).json({ error: 'Invalid onboarding session' });
    return;
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: payload.adminId } });
  if (!admin || !admin.active) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash, mustChangePassword: false },
  });

  const flags = await getAdminSecurityFlags(admin.id);
  const profile = adminPublicProfile(admin);

  if (!flags.twoFaEnabled || flags.mustResetTwoFa) {
    res.json({
      requires2faSetup: true,
      onboardingToken: signOnboardingToken(admin.id, admin.role, '2fa_setup'),
      admin: profile,
      mustResetTwoFa: flags.mustResetTwoFa,
    });
    return;
  }

  const tempToken = jwt.sign(
    { adminId: admin.id, role: admin.role, purpose: 'admin_2fa' },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '5m' } as jwt.SignOptions
  );
  res.json({ requires2fa: true, tempToken, admin: profile });
});

router.post('/auth/onboarding/2fa/setup', async (req: Request, res: Response) => {
  const { onboardingToken } = req.body as { onboardingToken: string };
  if (!onboardingToken) {
    res.status(400).json({ error: 'onboardingToken required' });
    return;
  }
  let payload: { adminId: number; purpose?: string; step?: string };
  try {
    payload = jwt.verify(onboardingToken, process.env.JWT_ACCESS_SECRET!) as typeof payload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired onboarding session' });
    return;
  }
  if (payload.purpose !== 'admin_onboarding' || payload.step !== '2fa_setup') {
    res.status(401).json({ error: 'Invalid onboarding session' });
    return;
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: payload.adminId } });
  if (!admin || !admin.active) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  const accountLabel = admin.username || admin.email;
  const pending = await getOrCreatePending2faSetup(admin.id, accountLabel);
  const body = pendingSetupResponse(pending, accountLabel);
  res.json(body);
});

router.post('/auth/onboarding/2fa/refresh', async (req: Request, res: Response) => {
  const { onboardingToken } = req.body as { onboardingToken: string };
  if (!onboardingToken) {
    res.status(400).json({ error: 'onboardingToken required' });
    return;
  }
  let payload: { adminId: number; purpose?: string; step?: string };
  try {
    payload = jwt.verify(onboardingToken, process.env.JWT_ACCESS_SECRET!) as typeof payload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired onboarding session' });
    return;
  }
  if (payload.purpose !== 'admin_onboarding' || payload.step !== '2fa_setup') {
    res.status(401).json({ error: 'Invalid onboarding session' });
    return;
  }
  const admin = await prisma.adminUser.findUnique({ where: { id: payload.adminId } });
  if (!admin || !admin.active) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }
  const accountLabel = admin.username || admin.email;
  const pending = await getOrCreatePending2faSetup(admin.id, accountLabel, true);
  const body = pendingSetupResponse(pending, accountLabel);
  res.json(body);
});

router.post('/auth/onboarding/2fa/check', async (req: Request, res: Response) => {
  const { onboardingToken, otp: rawOtp } = req.body as { onboardingToken: string; otp: unknown };
  const otp = parseOtpInput(rawOtp);
  if (!onboardingToken || otp.length !== 6) {
    res.status(400).json({ error: 'onboardingToken and otp required' });
    return;
  }
  let payload: { adminId: number; purpose?: string; step?: string };
  try {
    payload = jwt.verify(onboardingToken, process.env.JWT_ACCESS_SECRET!) as typeof payload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired onboarding session' });
    return;
  }
  if (payload.purpose !== 'admin_onboarding' || payload.step !== '2fa_setup') {
    res.status(401).json({ error: 'Invalid onboarding session' });
    return;
  }
  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.adminId },
    select: { username: true, email: true },
  });
  const pending = await loadPendingSetup(payload.adminId);
  if (!pending) {
    res.json({
      valid: false,
      error: 'No active 2FA setup. Refresh the page and generate a new QR.',
    });
    return;
  }
  const check = verifySetupTotp(pending.secret, otp);
  res.json({
    valid: check.valid,
    secretHint: totpSecretHint(pending.secret),
    accountLabel: admin?.username || admin?.email || 'admin',
  });
});

router.post('/auth/onboarding/2fa/enable', async (req: Request, res: Response) => {
  const { onboardingToken, setupToken, otp: rawOtp } = req.body as {
    onboardingToken: string;
    setupToken: string;
    otp: unknown;
  };
  const otp = parseOtpInput(rawOtp);
  if (!onboardingToken || !setupToken || otp.length !== 6) {
    res.status(400).json({ error: 'onboardingToken, setupToken and otp required' });
    return;
  }
  let onboardPayload: { adminId: number; role: string; purpose?: string; step?: string };
  let setupPayload: { adminId: number; purpose?: string; secret?: string };
  try {
    onboardPayload = jwt.verify(onboardingToken, process.env.JWT_ACCESS_SECRET!) as typeof onboardPayload;
    setupPayload = jwt.verify(setupToken, process.env.JWT_ACCESS_SECRET!) as typeof setupPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired setup session' });
    return;
  }
  if (onboardPayload.purpose !== 'admin_onboarding' || onboardPayload.step !== '2fa_setup') {
    res.status(401).json({ error: 'Invalid onboarding session' });
    return;
  }
  if (setupPayload.purpose !== 'admin_2fa_setup' || setupPayload.adminId !== onboardPayload.adminId) {
    res.status(401).json({ error: 'Invalid setup token' });
    return;
  }
  const pending = await loadPendingSetup(onboardPayload.adminId);
  const tokenMatch = pending?.setupToken?.trim() === setupToken.trim();
  if (!pending || pending.expiresAt <= Date.now() || !tokenMatch) {
    res.status(401).json({
      error: '2FA setup expired or QR was regenerated. Click Regenerate QR, scan the new code, then try again.',
    });
    return;
  }
  const enrollSecret = pending.secret;
  const setupCheck = verifySetupTotp(enrollSecret, otp);
  if (!setupCheck.valid && isAdmin2faDevMode()) {
    pending2faSetupByAdmin.delete(onboardPayload.adminId);
    try {
      const redis = await getRedisClient();
      await redis.del(pendingRedisKey(onboardPayload.adminId));
    } catch {
      /* ignore */
    }
    await finalizeAdminLogin(onboardPayload.adminId, onboardPayload.role, req, res);
    return;
  }
  if (!setupCheck.valid) {
    res.status(401).json({
      error:
        'Invalid authenticator code. Delete every old OceanBazar entry in Google Authenticator, refresh this page, scan the new QR, then enter the current code. Check that the setup key ends with the 4 characters shown below the QR.',
    });
    return;
  }

  await prisma.adminUser.update({
    where: { id: onboardPayload.adminId },
    data: {
      twoFaSecret: normalizeTotpSecret(enrollSecret),
      twoFaEnabled: true,
      mustChangePassword: false,
      mustResetTwoFa: false,
    },
  });
  pending2faSetupByAdmin.delete(onboardPayload.adminId);
  try {
    const redis = await getRedisClient();
    await redis.del(pendingRedisKey(onboardPayload.adminId));
  } catch {
    /* ignore */
  }

  await finalizeAdminLogin(onboardPayload.adminId, onboardPayload.role, req, res);
});

router.post('/auth/forgot-password/start', async (req: Request, res: Response) => {
  const { username } = req.body as { username: string };
  if (!username?.trim()) {
    res.status(400).json({ error: 'Username or email is required' });
    return;
  }

  const admin = await prisma.adminUser.findFirst({
    where: { OR: [{ username: username.trim() }, { email: username.trim() }], active: true },
    select: { id: true, role: true, twoFaEnabled: true, twoFaSecret: true },
  });

  if (!admin?.twoFaEnabled || !admin?.twoFaSecret) {
    res.status(400).json({
      error: 'Password reset is not available for this account. Contact your administrator.',
    });
    return;
  }

  const resetToken = jwt.sign(
    { adminId: admin.id, role: admin.role, purpose: 'admin_password_reset' },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '10m' } as jwt.SignOptions
  );

  res.json({ requires2fa: true, resetToken });
});

router.post('/auth/forgot-password/reset', async (req: Request, res: Response) => {
  const { resetToken, otp: rawOtp, newPassword } = req.body as {
    resetToken: string;
    otp: unknown;
    newPassword: string;
  };
  const otp = parseOtpInput(rawOtp);
  if (!resetToken || otp.length !== 6 || !newPassword) {
    res.status(400).json({ error: 'resetToken, otp and newPassword are required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  let payload: { adminId: number; role: string; purpose?: string };
  try {
    payload = jwt.verify(resetToken, process.env.JWT_ACCESS_SECRET!) as typeof payload;
  } catch {
    res.status(401).json({ error: 'Reset session expired. Please start again.' });
    return;
  }
  if (payload.purpose !== 'admin_password_reset') {
    res.status(401).json({ error: 'Invalid reset session' });
    return;
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.adminId },
    select: { id: true, active: true, twoFaEnabled: true, twoFaSecret: true },
  });
  if (!admin?.active || !admin.twoFaEnabled || !admin.twoFaSecret) {
    res.status(400).json({ error: 'Password reset is not available for this account' });
    return;
  }
  const totpReset = await verifyAndConsumeAdminTotp(admin.id, admin.twoFaSecret, otp);
  if (!totpReset.ok) {
    const msg =
      totpReset.reason === 'replay'
        ? 'This code was already used or has expired. Enter the latest code from your authenticator app.'
        : 'Invalid authenticator code';
    res.status(401).json({ error: msg });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: 'admin_password_reset',
      targetType: 'admin_user',
      targetId: String(admin.id),
      details: { ip: req.ip, userAgent: req.headers['user-agent'], method: 'self_service_2fa' },
    },
  }).catch(() => {});

  res.json({ success: true, message: 'Password updated successfully. You can now sign in.' });
});

router.get('/auth/me', requireAdmin, async (req: Request, res: Response) => {
  const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.adminId } });
  if (!admin) { res.status(404).json({ error: 'Admin not found' }); return; }
  let profileImage: string | null = null;
  try {
    const { ensureAdminGovernanceSchema } = await import('../../lib/adminGovernance');
    await ensureAdminGovernanceSchema();
    const rows = await prisma.$queryRaw<{ profile_image: string | null }[]>`
      SELECT profile_image FROM admin_users WHERE id = ${admin.id} LIMIT 1
    `;
    profileImage = rows?.[0]?.profile_image ?? null;
  } catch { /* column may not exist yet */ }
  res.json({
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      profileImage,
      authProvider: admin.authProvider || 'local',
      microsoftLinked: Boolean(admin.microsoftOid),
      googleLinked: Boolean(admin.googleSub),
    },
  });
});

router.get('/auth/2fa/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<Array<{ two_fa_enabled: boolean; must_reset_two_fa: boolean }>>`
      SELECT COALESCE(two_fa_enabled, FALSE) AS two_fa_enabled,
             COALESCE(must_reset_two_fa, FALSE) AS must_reset_two_fa
      FROM admin_users WHERE id = ${req.admin!.adminId} LIMIT 1
    `;
    res.json({
      enabled: Boolean(rows[0]?.two_fa_enabled),
      mustResetTwoFa: Boolean(rows[0]?.must_reset_two_fa),
    });
  } catch {
    res.json({ enabled: false, mustResetTwoFa: false });
  }
});

router.post('/auth/2fa/setup', requireAdmin, async (req: Request, res: Response) => {
  const { currentOtp: rawCurrentOtp } = req.body as { currentOtp?: unknown };
  const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.adminId } });
  if (!admin) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  // Already enrolled: require current authenticator before issuing a replacement secret.
  // Forced re-enroll (mustResetTwoFa / disabled) is handled via login onboarding, not here.
  if (admin.twoFaEnabled && admin.twoFaSecret && !admin.mustResetTwoFa) {
    const currentOtp = parseOtpInput(rawCurrentOtp);
    if (currentOtp.length !== 6) {
      res.status(400).json({
        error: 'Enter your current authenticator code to reset your authenticator app',
      });
      return;
    }
    const currentCheck = await verifyAndConsumeAdminTotp(admin.id, admin.twoFaSecret, currentOtp);
    if (!currentCheck.ok) {
      res.status(401).json({
        error:
          currentCheck.reason === 'replay'
            ? 'This code was already used. Enter the latest code from your authenticator app.'
            : 'Invalid current authenticator code',
      });
      return;
    }
  }

  const secret = generateBase32Secret();
  const setupToken = jwt.sign(
    { adminId: admin.id, purpose: 'admin_2fa_setup', secret },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '10m' } as jwt.SignOptions
  );
  const otpauthUrl = buildOtpAuthUrl('OceanBazarAdmin', admin.username || admin.email, secret);
  res.json({ setupToken, secret, otpauthUrl });
});

router.post('/auth/2fa/enable', requireAdmin, async (req: Request, res: Response) => {
  const { setupToken, otp: rawOtp } = req.body as { setupToken: string; otp: unknown };
  const otp = parseOtpInput(rawOtp);
  if (!setupToken || otp.length !== 6) {
    res.status(400).json({ error: 'setupToken and otp required' });
    return;
  }
  let payload: { adminId: number; purpose?: string; secret?: string };
  try {
    payload = jwt.verify(setupToken, process.env.JWT_ACCESS_SECRET!) as typeof payload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired setup token' });
    return;
  }
  if (payload.purpose !== 'admin_2fa_setup' || !payload.secret || payload.adminId !== req.admin!.adminId) {
    res.status(401).json({ error: 'Invalid setup token' });
    return;
  }
  const totpEnable = await verifyAndConsumeAdminTotp(
    req.admin!.adminId,
    payload.secret,
    otp,
    { skipReplayCheck: true }
  );
  if (!totpEnable.ok) {
    res.status(401).json({ error: 'Invalid authenticator code' });
    return;
  }
  const normalized = normalizeTotpSecret(payload.secret);
  await prisma.$executeRaw`
    UPDATE admin_users
    SET two_fa_secret = ${normalized},
        two_fa_enabled = TRUE,
        two_fa_last_counter = NULL,
        must_reset_two_fa = FALSE
    WHERE id = ${req.admin!.adminId}
  `;
  res.json({ success: true, enabled: true });
});

router.post('/auth/2fa/disable', requireAdmin, async (req: Request, res: Response) => {
  res.status(403).json({ error: '2FA is mandatory for all admin accounts and cannot be disabled' });
});

router.get('/auth/realtime-token', requireAdmin, async (req: Request, res: Response) => {
  const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.adminId } });
  if (!admin) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  // Spring's StompAuthChannelInterceptor validates this token against JWT_SECRET_KEY.
  // Sign with JWT_SECRET_KEY so both Java STOMP and the BFF SSE endpoint accept it.
  // (The SSE endpoint tries JWT_SECRET_KEY first — see /live/stream route.)
  const SECRET = process.env.JWT_SECRET_KEY || process.env.JWT_ACCESS_SECRET || 'oceanbazar-secret-key-change-in-production';
  const token = jwt.sign(
    { admin_id: String(admin.id), adminId: admin.id, role: admin.role, scope: 'realtime' },
    SECRET,
    { expiresIn: '15m' } as jwt.SignOptions
  );

  res.json({
    token,
    expiresIn: 15 * 60,
    scope: 'realtime',
    admin: { id: admin.id, role: admin.role }
  });
});

// ─── Sub-routers ──────────────────────────────────────────────────────────────

router.use('/file-import', requireAdmin, fileImportRouter);
router.use('/ob-points', requireAdmin, obPointsAdminRouter);
router.use('/tickets', requireAdmin, ticketsAdminRouter);
router.use('/inventory', requireAdmin, inventoryRouter);
router.use('/returns', requireAdmin, returnsRouter);
router.use('/delivery', requireAdmin, deliveryAdminRouter);
router.use('/payments', requireAdmin, paymentsAdminRouter);
router.use('/coupons', requireAdmin, couponsAdminRouter);
router.use('/disputes', requireAdmin, disputesRouter);
router.use('/chat', requireAdmin, chatAdminRouter);
router.use('/notifications', requireAdmin, notificationsRouter);
router.use('/applications', requireAdmin, applicationsRouter);
router.use('/team', requireAdmin, teamRouter);
router.use('/audit-logs', requireAdmin, auditLogsRouter);
router.use('/global-settings', requireAdmin, globalSettingsRouter);
router.use('/trust-badges', requireAdmin, trustBadgesAdminRouter);
router.use('/analytics', requireAdmin, analyticsRouter);
router.use('/cod-otp', codOtpRouter); // auth handled inside per-route (requireAdmin)
router.use('/governance', requireAdmin, governanceRouter);
router.use('/email', requireAdmin, emailRouter);
router.use('/email-templates', requireAdmin, emailTemplatesRouter);
router.use('/seo', requireAdmin, seoRouter);
router.use('/intelligence', requireAdmin, intelligenceRouter);
router.use('/marketing', requireAdmin, marketingRouter);
router.use('/meta', requireAdmin, metaAdminRouter);
router.use('/communications', requireAdmin, communicationsRouter);
router.use('/integrations', requireAdmin, integrationsRouter);
router.use('/client-errors', requireAdmin, clientErrorsAdminRouter);

// ─── Live routes — registered BEFORE studioRouter so the query-param SSE endpoint
//     is not blocked by studioRouter's router.use(requireAdmin). EventSource cannot
//     set Authorization headers, so the stream authenticates via ?token query param.

router.get('/live/snapshot', requireAdmin, async (_req: Request, res: Response) => {
  const [totalOrders, totalRevenue, pendingVerificationRevenue, totalUsers, pendingOrders, activeChats, openTickets, pendingReturns] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: { in: ['paid', 'under_verification', 'pending_verification'] } } }),
    prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: { in: ['under_verification', 'pending_verification'] } } }),
    prisma.user.count(),
    prisma.order.count({ where: { status: 'pending' } }),
    prisma.chat_sessions.count({ where: { is_active: true } }),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.return_requests.count({ where: { status: 'pending' } }),
  ]);
  res.json({
    totalOrders,
    totalRevenue: Number(totalRevenue._sum.total || 0),
    pendingVerificationRevenue: Number(pendingVerificationRevenue._sum.total || 0),
    totalUsers,
    pendingOrders,
    activeChats,
    openTickets,
    pendingReturns,
    timestamp: new Date().toISOString(),
  });
});

// SSE — token in query param (EventSource cannot set headers)
router.get('/live/stream', async (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) { res.status(401).end(); return; }
  let tokenValid = false;
  let isAdminToken = false;
  const isAdminRole = (role: unknown) => {
    const r = String(role || '').toLowerCase();
    return (
      r === 'super_admin' ||
      r === 'admin' ||
      r === 'staff' ||
      r === 'warehouse' ||
      r === 'support' ||
      r === 'finance' ||
      r === 'viewer'
    );
  };
  const verifyAndInspect = (secret: string) => {
    const payload = jwt.verify(token, secret) as Record<string, unknown>;
    const adminId = payload.admin_id ?? payload.adminId;
    if (adminId || isAdminRole(payload.role)) {
      isAdminToken = true;
    }
  };
  try {
    verifyAndInspect(process.env.JWT_SECRET_KEY || process.env.JWT_ACCESS_SECRET || 'oceanbazar-secret-key-change-in-production');
    tokenValid = true;
  } catch { /* try BFF access secret */ }
  if (!tokenValid) {
    try {
      verifyAndInspect(process.env.JWT_ACCESS_SECRET || 'oceanbazar-secret-key-change-in-production');
      tokenValid = true;
    } catch { /* invalid */ }
  }
  if (!tokenValid || !isAdminToken) {
    res.status(401).end(); return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders(); // flush to client immediately so EventSource.onopen fires

  const send = async () => {
    try {
      const [totalOrders, totalRevenue, totalUsers, pendingOrders, activeChats, openTickets, pendingReturns] = await Promise.all([
        prisma.order.count(),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { paymentStatus: { in: ['paid', 'under_verification', 'pending_verification'] } },
        }),
        prisma.user.count(),
        prisma.order.count({ where: { status: 'pending' } }),
        prisma.chat_sessions.count({ where: { is_active: true } }),
        prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
        prisma.return_requests.count({ where: { status: 'pending' } }),
      ]);
      const payload = { totalOrders, totalRevenue: Number(totalRevenue._sum.total || 0), totalUsers, pendingOrders, activeChats, openTickets, pendingReturns, timestamp: new Date().toISOString() };
      res.write(`event: live_update\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch { /* non-fatal */ }
  };

  await send();
  const interval = setInterval(send, 10000);
  req.on('close', () => clearInterval(interval));
});

// Dashboard routes BEFORE studioRouter — studio is mounted at "/" with requireAdmin and
// unmatched paths can fall through to the Java coreApiProxy (which returns
// {"detail":"Invalid admin token"} and triggers CRM logout via the axios 401 interceptor).
router.get('/overview', requireAdmin, async (_req, res: Response) => {
  const [totalOrders, totalRevenue, totalUsers, pendingTickets, totalProducts] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { paymentStatus: { in: ['paid', 'under_verification', 'pending_verification'] } },
    }),
    prisma.user.count(),
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.product.count(),
  ]);
  res.json({
    totalOrders,
    totalRevenue: Number(totalRevenue._sum.total ?? 0),
    totalUsers,
    pendingTickets,
    totalProducts,
  });
});

router.get('/activity', requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));
    const perSourceTake = page * limit + limit;

    const [orders, payments, returns, tickets, customers, orderCount, paymentCount, returnCount, ticketCount, customerCount] =
      await Promise.all([
        prisma.order.findMany({
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: perSourceTake,
        }),
        prisma.paymentTransaction.findMany({
          include: {
            user: { select: { name: true } },
            order: { select: { orderNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: perSourceTake,
        }),
        prisma.return_requests.findMany({
          orderBy: { created_at: 'desc' },
          take: perSourceTake,
        }),
        prisma.ticket.findMany({
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: perSourceTake,
        }),
        prisma.user.findMany({
          select: { id: true, name: true, email: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: perSourceTake,
        }),
        prisma.order.count(),
        prisma.paymentTransaction.count(),
        prisma.return_requests.count(),
        prisma.ticket.count(),
        prisma.user.count(),
      ]);

    type RawActivity = { id: string; type: string; text: string; time: string; color?: string; sortTime: number };
    const merged: RawActivity[] = [];

    for (const o of orders) {
      const label = String(o.orderNumber || o.id).slice(-6).toUpperCase();
      merged.push({
        id: `order-${o.id}`,
        type: 'order',
        text: `Order #${label} — ${o.user?.name || 'Guest'} — ৳${Number(o.total ?? 0).toLocaleString()}`,
        time: o.createdAt.toISOString(),
        color:
          o.status === 'delivered'
            ? 'text-crm-success'
            : o.status === 'cancelled'
              ? 'text-crm-danger'
              : 'text-crm-primary',
        sortTime: o.createdAt.getTime(),
      });
    }

    for (const p of payments) {
      const label = String(p.order?.orderNumber || p.orderId).slice(-6).toUpperCase();
      merged.push({
        id: `payment-${p.id}`,
        type: 'payment',
        text: `Payment ${p.status} — ${p.method.toUpperCase()} — Order #${label} — ৳${Number(p.amount).toLocaleString()}`,
        time: p.createdAt.toISOString(),
        color:
          p.status === 'success'
            ? 'text-crm-success'
            : p.status === 'failed'
              ? 'text-crm-danger'
              : 'text-crm-warning',
        sortTime: p.createdAt.getTime(),
      });
    }

    for (const r of returns) {
      merged.push({
        id: `return-${r.id}`,
        type: 'return',
        text: `Return request ${r.status} — Order #${String(r.order_id).slice(-6).toUpperCase()}`,
        time: r.created_at.toISOString(),
        color: r.status === 'approved' || r.status === 'completed' ? 'text-crm-success' : 'text-crm-warning',
        sortTime: r.created_at.getTime(),
      });
    }

    for (const t of tickets) {
      merged.push({
        id: `ticket-${t.id}`,
        type: 'ticket',
        text: `Ticket: ${t.subject.slice(0, 60)}${t.subject.length > 60 ? '…' : ''} — ${t.user?.name || 'Customer'}`,
        time: t.createdAt.toISOString(),
        color: t.status === 'resolved' || t.status === 'closed' ? 'text-crm-success' : 'text-crm-purple',
        sortTime: t.createdAt.getTime(),
      });
    }

    for (const u of customers) {
      merged.push({
        id: `customer-${u.id}`,
        type: 'customer',
        text: `New customer — ${u.name}${u.email ? ` (${u.email})` : ''}`,
        time: u.createdAt.toISOString(),
        color: 'text-crm-purple',
        sortTime: u.createdAt.getTime(),
      });
    }

    merged.sort((a, b) => b.sortTime - a.sortTime);

    const total = orderCount + paymentCount + returnCount + ticketCount + customerCount;
    const offset = (page - 1) * limit;
    const items = merged.slice(offset, offset + limit).map(({ sortTime: _sortTime, ...item }) => item);
    const hasMore = items.length === limit && (offset + items.length < merged.length || perSourceTake < total);

    res.json({ items, page, limit, total, hasMore });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load activity', detail: String(err?.message || err).slice(0, 200) });
  }
});

router.use(studioRouter);

// ─── Products CRUD ────────────────────────────────────────────────────────────

router.get('/products', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = parseInt(String(req.query.limit || '50'));
  const status = String(req.query.status || '');
  const search = String(req.query.search || '');

  const where: Record<string, unknown> = {};
  if (status && status !== 'all') where.status = status;
  if (search) {
    where.OR = [
      { titleEn: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { id: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const [products, total, activeCount, lowStockCount] = await Promise.all([
      prismaAny.product.findMany({
        where,
        include: { productCategories: { include: { category: true } }, productAssets: { orderBy: { sortOrder: 'asc' } }, pricing: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
      prisma.product.count({ where: { status: 'active' } }),
      prisma.product.count({ where: { stock: { lt: 10 } } }),
    ]);
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'crm-products',hypothesisId:'H-schema',location:'admin/index.ts:GET /products',message:'products list ok',data:{page,limit,total,count:Array.isArray(products)?products.length:0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    res.json({ products, total, page, limit, activeCount, lowStockCount });
  } catch (err: any) {
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'crm-products',hypothesisId:'H-schema',location:'admin/index.ts:GET /products:err',message:'products list failed',data:{code:err?.code||null,msg:String(err?.message||'').slice(0,300),meta:err?.meta||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error('[admin GET /products]', err?.code, err?.message);
    res.status(500).json({ error: err?.message || 'Failed to fetch products', code: err?.code });
  }
});

router.post('/products', requireAdmin, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const data = req.body as Record<string, unknown>;
  const newId = generateEntityId();
  const categoryId = typeof data.categoryId === 'string' && data.categoryId.trim() ? data.categoryId.trim() : null;
  // #region agent log
  fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'product-create',hypothesisId:'H-cat',location:'admin/index.ts:POST /products',message:'product create attempt',data:{newId,hasCategoryId:Boolean(categoryId),categoryId,titleEn:String(data.titleEn||'').slice(0,80),stock:data.stock??null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  try {
    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
      if (!cat) {
        res.status(400).json({ error: 'Invalid categoryId — select a valid folder/category before publishing.' });
        return;
      }
    }
    const product = await prisma.product.create({
      data: {
        id: newId,
        titleEn: data.titleEn as string,
        titleBn: (data.titleBn as string) || (data.titleEn as string),
        descriptionEn: data.descriptionEn as string | undefined,
        descriptionBn: data.descriptionBn as string | undefined,
        brand: data.brand as string | undefined,
        brandId: (data.brandId as string) || undefined,
        brandLogoUrl: data.brandLogoUrl as string | undefined,
        sku: data.sku as string | undefined,
        pricingMode: (data.pricingMode as string) || 'tiered',
        moq: (data.moq as number) || 1,
        stock: (data.stock as number) || 0,
        status: (data.status as 'active' | 'draft' | 'archived') || 'draft',
        isFeatured: Boolean(data.isFeatured),
        isBestSeller: Boolean(data.isBestSeller),
        isBestRated: Boolean(data.isBestRated),
        ...(categoryId
          ? {
              productCategories: {
                create: [{ categoryId, isPrimary: true, sortOrder: 0 }],
              },
            }
          : {}),
        pricing: {
          create: [
            {
              customerType: 'retail',
              price: Number(data.retailPrice),
              compareAt: data.compareAt != null ? Number(data.compareAt) : null,
              tier1MinQty: null,
              tier1Discount: null,
              tier2MinQty: null,
              tier2Discount: null,
              tier3MinQty: null,
              tier3Discount: null,
            },
            ...(data.wholesalePrice != null
              ? [
                  {
                    customerType: 'wholesale' as const,
                    price: Number(data.wholesalePrice),
                    compareAt: data.wholesaleCompareAt != null ? Number(data.wholesaleCompareAt) : null,
                    tier1MinQty: null,
                    tier1Discount: null,
                    tier2MinQty: null,
                    tier2Discount: null,
                    tier3MinQty: null,
                    tier3Discount: null,
                  },
                ]
              : []),
          ],
        },
      },
      include: { pricing: true, productCategories: true },
    });
    // Keep legacy products.category_id in sync when the column still exists (NOT NULL historically caused 502).
    if (categoryId) {
      try {
        await prisma.$executeRaw`UPDATE products SET category_id = ${categoryId} WHERE id = ${newId}`;
      } catch { /* column may be absent or already synced */ }
    }
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'product-create',hypothesisId:'H-cat',location:'admin/index.ts:POST /products:ok',message:'product create success',data:{productId:product.id,pcmCount:Array.isArray((product as any).productCategories)?(product as any).productCategories.length:0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    res.status(201).json({ product });
  } catch (err: any) {
    const code = err?.code || '';
    const msg = String(err?.message || 'Product create failed');
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'product-create',hypothesisId:'H-cat',location:'admin/index.ts:POST /products:err',message:'product create failed',data:{code,msg:msg.slice(0,300),categoryId,meta:err?.meta||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    console.error('[admin POST /products]', code, msg);
    if (code === 'P2011' || /category_id/i.test(msg)) {
      res.status(400).json({
        error: 'Category is required (or database category_id is still NOT NULL). Select a category and try again.',
        code,
      });
      return;
    }
    res.status(500).json({ error: msg.slice(0, 200), code: code || undefined });
  }
});

router.delete('/products/:id', requireAdmin, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const updated = await prisma.product.updateMany({ where: { id }, data: { status: 'archived' } });
  if (!updated.count) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ message: 'Product archived' });
});

router.post('/products/:id/duplicate', requireAdmin, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const sourceId = routeParam(req.params.id);
  const source = await prisma.product.findUnique({
    where: { id: sourceId },
    include: {
      pricing: true,
      productAssets: { orderBy: { sortOrder: 'asc' } },
      productCategories: true,
      productAttributes: true,
      variants: { orderBy: { sortOrder: 'asc' } },
      productTags: true,
    },
  });
  if (!source) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const newId = generateEntityId();
  await prisma.$transaction(async (tx) => {
    await tx.product.create({
      data: {
        id: newId,
        brandId: source.brandId,
        sellerId: source.sellerId,
        titleEn: `${source.titleEn} (Copy)`,
        titleBn: source.titleBn ? `${source.titleBn} (Copy)` : `${source.titleEn} (Copy)`,
        descriptionEn: source.descriptionEn,
        descriptionBn: source.descriptionBn,
        brand: source.brand,
        brandLogoUrl: source.brandLogoUrl,
        sku: source.sku ? `${source.sku}-copy` : null,
        status: 'draft',
        weight: source.weight,
        weightUnit: source.weightUnit,
        pricingMode: source.pricingMode,
        moq: source.moq,
        stock: source.stock,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        importSource: source.importSource,
        specifications: source.specifications ?? undefined,
        attributesExtra: source.attributesExtra ?? undefined,
        isFeatured: false,
        isBestSeller: false,
        isBestRated: false,
        reviewCount: 0,
        ratingAvg: null,
        reviewsSnapshot: undefined,
        popularityRank: null,
        popularityLabelEn: null,
        popularityLabelBn: null,
        pricing: {
          create: source.pricing.map((row) => ({
            customerType: row.customerType,
            price: row.price,
            compareAt: row.compareAt,
            tier1MinQty: row.tier1MinQty,
            tier1Discount: row.tier1Discount,
            tier2MinQty: row.tier2MinQty,
            tier2Discount: row.tier2Discount,
            tier3MinQty: row.tier3MinQty,
            tier3Discount: row.tier3Discount,
            tierBands: row.tierBands ?? undefined,
            sortOrder: row.sortOrder,
          })),
        },
      },
    });

    if (source.productAssets.length) {
      await tx.productAsset.createMany({
        data: source.productAssets.map((asset) => ({
          productId: newId,
          assetType: asset.assetType,
          url: asset.url,
          altEn: asset.altEn,
          altBn: asset.altBn,
          sortOrder: asset.sortOrder,
          isPrimary: asset.isPrimary,
          colorKey: asset.colorKey,
          fileSize: asset.fileSize,
          mimeType: asset.mimeType,
        })),
      });
    }

    if (source.productCategories.length) {
      await tx.productCategoryMap.createMany({
        data: source.productCategories.map((map) => ({
          productId: newId,
          categoryId: map.categoryId,
          isPrimary: map.isPrimary,
          sortOrder: map.sortOrder,
        })),
      });
    }

    if (source.productAttributes.length) {
      await tx.productAttribute.createMany({
        data: source.productAttributes.map((attr) => ({
          productId: newId,
          attrKey: attr.attrKey,
          attrValue: attr.attrValue,
          sortOrder: attr.sortOrder,
        })),
      });
    }

    if (source.variants.length) {
      await tx.productVariant.createMany({
        data: source.variants.map((variant) => ({
          id: generateEntityId(),
          productId: newId,
          sku: variant.sku ? `${variant.sku}-copy` : null,
          nameEn: variant.nameEn,
          nameBn: variant.nameBn,
          attributes: variant.attributes as object,
          priceOverride: variant.priceOverride,
          stock: variant.stock,
          weight: variant.weight,
          isActive: variant.isActive,
          sortOrder: variant.sortOrder,
        })),
      });
    }

    if (source.productTags.length) {
      await tx.productTag.createMany({
        data: source.productTags.map((tag) => ({
          productId: newId,
          tagId: tag.tagId,
        })),
      });
    }
  });

  const product = await prisma.product.findUnique({
    where: { id: newId },
    include: { pricing: true, productAssets: { orderBy: { sortOrder: 'asc' } } },
  });
  res.status(201).json({ product });
});

// ─── Categories CRUD ──────────────────────────────────────────────────────────

router.get('/categories', requireAdmin, async (_req, res: Response) => {
  const categories = await prisma.category.findMany({
    include: { children: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ categories });
});

router.post('/categories', requireAdmin, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { nameEn, nameBn, parentId, icon, imageUrl, sortOrder } = req.body;
  const cat = await prisma.category.create({
    data: {
      id: generateEntityId(),
      nameEn,
      nameBn: nameBn || nameEn,
      parentId: parentId ?? null,
      icon: icon ?? null,
      imageUrl: imageUrl ?? null,
      sortOrder: sortOrder ?? 0,
      slug: generateSlug(nameEn),
    },
  });
  void invalidateCache('bff:categories');
  res.status(201).json({ category: cat });
});

// ─── Category tree & explorer routes ─────────────────────────────────────────

const EXPLORER_PRODUCT_STATUSES = ['active', 'draft', 'suspended'] as const;
const MAX_CATEGORY_TREE_DEPTH = 5;

async function getCategoryCountMaps(categoryIds?: string[]) {
  const productWhere = {
    product: { status: { in: [...EXPLORER_PRODUCT_STATUSES] } },
    ...(categoryIds?.length ? { categoryId: { in: categoryIds } } : {}),
  };

  const [childCounts, productCounts] = await Promise.all([
    prisma.category.groupBy({
      by: ['parentId'],
      where: {
        parentId: { not: null },
        ...(categoryIds?.length ? { parentId: { in: categoryIds } } : {}),
      },
      _count: { id: true },
    }),
    prisma.productCategoryMap.groupBy({
      by: ['categoryId'],
      where: productWhere,
      _count: { productId: true },
    }),
  ]);

  const childCountMap = new Map<string, number>();
  for (const row of childCounts) {
    if (row.parentId) childCountMap.set(row.parentId, row._count.id);
  }

  const productCountMap = new Map<string, number>();
  for (const row of productCounts) {
    productCountMap.set(row.categoryId, row._count.productId);
  }

  return { childCountMap, productCountMap };
}

function decorateCategoryNode<T extends { id: string; is_leaf?: boolean }>(
  cat: T,
  childCountMap: Map<string, number>,
  productCountMap: Map<string, number>,
  children: Array<Record<string, unknown>> = [],
): Record<string, unknown> {
  const childCount = childCountMap.get(cat.id) ?? children.length;
  const productCount = productCountMap.get(cat.id) ?? 0;
  const isLeaf = childCount === 0;
  return {
    ...cat,
    children,
    childCount,
    productCount,
    isLeaf,
  };
}

async function buildCategoryTree(): Promise<Array<Record<string, unknown>>> {
  const allCategories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  const { childCountMap, productCountMap } = await getCategoryCountMaps();

  const childrenByParent = new Map<string | null, typeof allCategories>();
  for (const cat of allCategories) {
    const parentKey = cat.parentId ?? null;
    if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
    childrenByParent.get(parentKey)!.push(cat);
  }

  const buildNode = (cat: (typeof allCategories)[number], depth: number): Record<string, unknown> => {
    const rawChildren =
      depth < MAX_CATEGORY_TREE_DEPTH ? childrenByParent.get(cat.id) || [] : [];
    const children = rawChildren.map((child) => buildNode(child, depth + 1));
    return decorateCategoryNode(cat, childCountMap, productCountMap, children);
  };

  return (childrenByParent.get(null) || []).map((root) => buildNode(root, 0));
}

async function enrichSubfolders<T extends { id: string; is_leaf?: boolean }>(subfolders: T[]) {
  if (!subfolders.length) return [];
  const ids = subfolders.map((s) => s.id);
  const { childCountMap, productCountMap } = await getCategoryCountMaps(ids);
  return subfolders.map((folder) => decorateCategoryNode(folder, childCountMap, productCountMap));
}

router.get('/categories/tree', requireAdmin, async (_req: Request, res: Response) => {
  const tree = await buildCategoryTree();
  res.json({ tree });
});

router.get('/categories/root/contents', requireAdmin, async (_req: Request, res: Response) => {
  const [rawSubfolders, products] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.product.findMany({
      where: {
        status: { in: [...EXPLORER_PRODUCT_STATUSES] },
        productCategories: { none: {} },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { productAssets: { orderBy: { sortOrder: 'asc' } }, pricing: true },
    }),
  ]);
  const subfolders = await enrichSubfolders(rawSubfolders);
  res.json({ subfolders, products, brands: [] });
});

router.get('/categories/:id/breadcrumb', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const crumbs: { id: string; nameEn: string; nameBn: string }[] = [];
  let current = await prisma.category.findUnique({ where: { id } });
  while (current) {
    crumbs.unshift({ id: current.id, nameEn: current.nameEn, nameBn: current.nameBn });
    if (!current.parentId) break;
    current = await prisma.category.findUnique({ where: { id: current.parentId } });
  }
  res.json(crumbs);
});

// PATCH /api/admin/products/:id/move — reassign primary category
router.patch('/products/:id/move', requireAdmin, async (req: Request, res: Response) => {
  const productId = routeParam(req.params.id);
  const { categoryId } = req.body as { categoryId: string };
  if (!categoryId) { res.status(400).json({ error: 'categoryId required' }); return; }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) { res.status(404).json({ error: 'Product not found' }); return; }
  await prisma.productCategoryMap.deleteMany({ where: { productId } });
  await prisma.productCategoryMap.create({ data: { productId, categoryId } });
  res.json({ message: 'Product moved', productId, categoryId });
});

// PATCH /api/admin/categories/:id/move — reparent a category
router.patch('/categories/:id/move', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const { newParentId } = req.body as { newParentId: string | null };
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) { res.status(404).json({ error: 'Category not found' }); return; }
  const updated = await prisma.category.update({
    where: { id },
    data: { parentId: newParentId || null },
  });
  res.json({ category: updated });
});

// GET /api/admin/categories/:id/brands — distinct brands in a category
router.get('/categories/:id/brands', requireAdmin, async (req: Request, res: Response) => {
  const categoryId = routeParam(req.params.id);
  const products = await prisma.product.findMany({
    where: { status: 'active', productCategories: { some: { categoryId } }, brand: { not: null } },
    select: {
      brandId: true,
      brand: true,
      brandRelation: { select: { id: true, nameEn: true, logoUrl: true } },
    },
  });
  const brandMap = new Map<string, { id: string; nameEn: string; logoUrl: string | null; productCount: number }>();
  for (const p of products) {
    const brandId = (p.brandId || p.brand || '').trim();
    const brandName = (p.brandRelation?.nameEn || p.brand || '').trim();
    if (!brandId || !brandName) continue;
    const existing = brandMap.get(brandId);
    if (existing) {
      existing.productCount += 1;
      continue;
    }
    brandMap.set(brandId, {
      id: brandId,
      nameEn: brandName,
      logoUrl: p.brandRelation?.logoUrl ?? null,
      productCount: 1,
    });
  }
  const brands = Array.from(brandMap.values()).sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  res.json({ brands });
});

// GET /api/admin/categories/:id/brands/:brandId/products
router.get('/categories/:id/brands/:brandId/products', requireAdmin, async (req: Request, res: Response) => {
  const categoryId = routeParam(req.params.id);
  const brandParam = decodeURIComponent(String(req.params.brandId));
  const page = parseInt(String(req.query.page || '1'));
  const size = parseInt(String(req.query.size || '50'));
  const products = await prisma.product.findMany({
    where: {
      status: 'active',
      productCategories: { some: { categoryId } },
      OR: [{ brandId: brandParam }, { brand: brandParam }],
    },
    skip: (page - 1) * size,
    take: size,
    orderBy: { createdAt: 'desc' },
    include: { productAssets: { orderBy: { sortOrder: 'asc' } }, pricing: true },
  });
  res.json({ products });
});

router.get('/categories/:id/contents', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const page = parseInt(String(req.query.page || '1'));
  const size = parseInt(String(req.query.size || '50'));
  const [rawSubfolders, products] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: id },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.product.findMany({
      where: {
        status: { in: [...EXPLORER_PRODUCT_STATUSES] },
        productCategories: { some: { categoryId: id } },
      },
      skip: (page - 1) * size,
      take: size,
      orderBy: { createdAt: 'desc' },
      include: { productAssets: { orderBy: { sortOrder: 'asc' } }, pricing: true },
    }),
  ]);
  const subfolders = await enrichSubfolders(rawSubfolders);
  res.json({ subfolders, products, brands: [] });
});

// ─── Orders ───────────────────────────────────────────────────────────────────

router.get('/orders', requireAdmin, adminOrderListingLimiter, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const { status } = req.query as Record<string, string>;
  const where: any = {};
  if (status) where.status = status;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: { select: { name: true, email: true } }, items: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);
  res.json({ orders, total, page, limit });
});

router.get('/orders/:id', requireAdmin, adminOrderListingLimiter, async (req: Request, res: Response) => {
  const orderId = routeParam(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      items: true,
      timeline: { orderBy: { createdAt: 'asc' } },
      shipments: true,
      shippingAddress: true,
      paymentTxs: true,
    },
  });
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  // Fallback product images for legacy items that never got a snapshot.
  const missingImageProductIds = [...new Set(order.items.filter((i) => !i.productImage).map((i) => i.productId))];
  const imageByProductId = new Map<string, string>();
  if (missingImageProductIds.length) {
    const assets = await prisma.productAsset.findMany({
      where: { productId: { in: missingImageProductIds }, assetType: 'image' },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    });
    for (const asset of assets) {
      if (!imageByProductId.has(asset.productId)) imageByProductId.set(asset.productId, asset.url);
    }
  }
  const items = await attachVariantLabels(
    prisma,
    order.items.map((i) => ({
      ...i,
      productImage: i.productImage || imageByProductId.get(i.productId) || null,
    })),
  );

  const courierShipments = await prisma.courier_shipments.findMany({
    where: { order_id: orderId },
    orderBy: { created_at: 'desc' },
  });

  res.json({ order: { ...order, items, courierShipments } });
});

async function handleOrderStatusUpdate(req: Request, res: Response) {
  const { status, note } = req.body as { status: string; note?: string };
  const order = await prisma.order.update({
    where: { id: routeParam(req.params.id) },
    data: { status: status as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' },
  });
  await prisma.orderTimeline.create({
    data: { orderId: order.id, status, note: note ?? `Status updated to ${status}`, actorType: 'admin', actorId: String(req.admin!.adminId) },
  });

  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_ORDER_STATUS', targetType: 'order', targetId: order.id, details: { status, note } },
  });

  try { emitAdminEvent('admin:order:updated', { orderId: order.id, orderNumber: order.orderNumber, status }); } catch { /* non-fatal */ }

  // Send email/SMS on meaningful status changes
  try {
    const { sendShippingUpdate, sendReviewRequestEmail } = await import('../../services/emailService');
    const { sendShippingUpdateSms } = await import('../../services/smsService');
    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        user: { select: { email: true, phone: true } },
        items: { select: { productTitle: true }, take: 6 },
      },
    });
    if (fullOrder?.user.email) sendShippingUpdate(fullOrder.user.email, order.orderNumber, status).catch(() => {});
    if (fullOrder?.user.phone) sendShippingUpdateSms(fullOrder.user.phone, order.orderNumber, status).catch(() => {});
    if (status === 'delivered' && fullOrder?.user.email) {
      sendReviewRequestEmail(
        fullOrder.user.email,
        order.orderNumber,
        order.id,
        (fullOrder.items || []).map((i) => i.productTitle).filter(Boolean),
      ).catch(() => {});
    }
  } catch { /* non-fatal */ }

  if (status === 'processing') {
    try { await notifyCustomer({ userId: order.userId, event: 'order_processing', vars: { orderNumber: order.orderNumber } }); } catch { /* non-fatal */ }
  }

  res.json({ order });
}
router.put('/orders/:id/status', requireAdmin, handleOrderStatusUpdate);
router.patch('/orders/:id/status', requireAdmin, handleOrderStatusUpdate);

router.patch('/orders/:id/tracking', requireAdmin, async (req: Request, res: Response) => {
  const { trackingNumber, carrier } = req.body;
  const order = await prisma.order.update({
    where: { id: routeParam(req.params.id) },
    data: { ...(trackingNumber && { trackingNumber }), ...(carrier && {}) },
  });
  if (trackingNumber) {
    await prisma.orderTimeline.create({
      data: { orderId: order.id, status: order.status, note: `Tracking updated: ${trackingNumber}${carrier ? ` via ${carrier}` : ''}`, actorType: 'admin' },
    });
  }
  res.json({ order });
});

router.patch('/orders/:id/payment-status', requireAdmin, async (req: Request, res: Response) => {
  const { paymentStatus } = req.body;
  const order = await prisma.order.update({
    where: { id: routeParam(req.params.id) },
    data: { paymentStatus },
  });
  await prisma.orderTimeline.create({
    data: { orderId: order.id, status: order.status, note: `Payment status → ${paymentStatus}`, actorType: 'admin' },
  });
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_PAYMENT_STATUS', targetType: 'order', targetId: order.id, details: { paymentStatus } },
  });
  try { emitAdminEvent('admin:payment', { orderId: order.id, paymentStatus }); } catch { /* non-fatal */ }
  res.json({ order });
});

// ─── Shipments ────────────────────────────────────────────────────────────────

router.post('/shipments', requireAdmin, async (req: Request, res: Response) => {
  const { orderId, carrier, estimatedDelivery } = req.body as {
    orderId: string; carrier: string; estimatedDelivery?: string;
  };

  const trackingNumber = generateTrackingNumber();
  const shipment = await prisma.shipment.create({
    data: {
      id: generateEntityId(),
      orderId,
      carrier,
      trackingNumber,
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'shipped', trackingNumber },
  });
  await prisma.orderTimeline.create({
    data: { orderId, status: 'shipped', note: `Shipped via ${carrier}. Tracking: ${trackingNumber}`, actorType: 'admin' },
  });

  res.status(201).json({ shipment, trackingNumber });
});

// ─── Customers ────────────────────────────────────────────────────────────────

router.get('/customers/:id', requireAdmin, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: routeParam(req.params.id) },
    include: { savedAddresses: true },
  });
  if (!user) { res.status(404).json({ error: 'Customer not found' }); return; }
  res.json({ user });
});

router.get('/customers/:id/360', requireAdmin, async (req: Request, res: Response) => {
  const customerId = routeParam(req.params.id);
  const profile = await prisma.user.findUnique({
    where: { id: customerId },
    include: { customer: true, savedAddresses: true },
  });
  if (!profile) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  const [orders, payments, returns, reviews, tickets, disputes, wholesaleApplications, businessInquiries] = await Promise.all([
    prisma.order.findMany({
      where: { userId: customerId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.paymentTransaction.findMany({
      where: { userId: customerId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.return_requests.findMany({
      where: { user_id: customerId },
      orderBy: { created_at: 'desc' },
      take: 25,
    }),
    prisma.productReview.findMany({
      where: { userId: customerId },
      include: { product: { select: { id: true, titleEn: true } } },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    prisma.ticket.findMany({
      where: { userId: customerId },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    }),
    prisma.disputes.findMany({
      where: { user_id: customerId },
      orderBy: { updated_at: 'desc' },
      take: 25,
    }),
    prisma.wholesale_applications.findMany({
      where: { user_id: customerId },
      orderBy: { created_at: 'desc' },
      take: 25,
    }),
    prisma.business_inquiries.findMany({
      where: {
        OR: [
          ...(profile.email ? [{ email: profile.email }] : []),
          ...(profile.phone ? [{ phone: profile.phone }] : []),
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 25,
    }),
  ]);
  res.json({
    profile,
    recentOrders: orders,
    recentPayments: payments,
    recentReturns: returns,
    recentReviews: reviews,
    recentTickets: tickets,
    recentDisputes: disputes,
    applications: {
      wholesale: wholesaleApplications,
      businessInquiries,
    },
  });
});

router.put('/customers/:id', requireAdmin, async (req: Request, res: Response) => {
  const { name, email, phone, userType, accountStatus, preferredLang } = req.body;
  const user = await prisma.user.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(phone && { phone }),
      ...(userType && { userType }),
      ...(accountStatus && { accountStatus }),
      ...(preferredLang && { preferredLang }),
    },
  });
  res.json({ user });
});

router.patch('/customers/:id/account-status', requireAdmin, async (req: Request, res: Response) => {
  const { accountStatus } = req.body;
  const user = await prisma.user.update({
    where: { id: routeParam(req.params.id) },
    data: { accountStatus },
  });
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'UPDATE_CUSTOMER_STATUS', targetType: 'user', targetId: user.id, details: { accountStatus } },
  });
  res.json({ user });
});

router.delete('/customers/:id', requireAdmin, requireRole('super_admin'), async (req: Request, res: Response) => {
  await prisma.user.update({ where: { id: routeParam(req.params.id) }, data: { accountStatus: 'suspended' } });
  res.json({ message: 'Customer suspended' });
});

router.get('/customers/:id/orders', requireAdmin, async (req: Request, res: Response) => {
  const orders = await prisma.order.findMany({
    where: { userId: routeParam(req.params.id) },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ orders });
});

router.get('/customers', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const [users, total] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 }),
    prisma.user.count(),
  ]);
  res.json({ users, total, page });
});

// ─── Reviews moderation ──────────────────────────────────────────────────────

router.get('/reviews', requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const { status, q } = req.query as Record<string, string>;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
  const where: Record<string, unknown> = status ? { status: status as 'pending' | 'approved' | 'rejected' } : {};
  if (q?.trim()) {
    where.OR = [
      { title: { contains: q.trim(), mode: 'insensitive' } },
      { body: { contains: q.trim(), mode: 'insensitive' } },
      { product: { titleEn: { contains: q.trim(), mode: 'insensitive' } } },
      { user: { name: { contains: q.trim(), mode: 'insensitive' } } },
    ];
  }
  const [reviews, total, pendingCount] = await Promise.all([
    prisma.productReview.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: {
          select: {
            id: true,
            titleEn: true,
            titleBn: true,
            ratingAvg: true,
            reviewCount: true,
            productAssets: {
              where: { assetType: 'image' },
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
              take: 1,
              select: { url: true },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.productReview.count({ where }),
    prisma.productReview.count({ where: { status: 'pending' } }),
  ]);
  res.json({
    reviews: reviews.map((r) => ({
      ...r,
      imageUrls: (r as any).imageUrls ?? [],
      verifiedPurchase: (r as any).verifiedPurchase ?? false,
      productImage: r.product.productAssets[0]?.url ?? null,
    })),
    total,
    pendingCount,
    page,
    limit,
  });
});

// GET /api/admin/reviews/pending — alias for ?status=pending
router.get('/reviews/pending', requireAdmin, async (_req: Request, res: Response) => {
  const reviews = await prisma.productReview.findMany({
    where: { status: 'pending' },
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: {
        select: {
          id: true,
          titleEn: true,
          titleBn: true,
          ratingAvg: true,
          reviewCount: true,
          productAssets: {
            where: { assetType: 'image' },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1,
            select: { url: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({
    reviews: reviews.map((r) => ({
      ...r,
      imageUrls: (r as any).imageUrls ?? [],
      verifiedPurchase: (r as any).verifiedPurchase ?? false,
      productImage: r.product.productAssets[0]?.url ?? null,
    })),
  });
});

// GET /api/admin/reviews/product/:productId
router.get('/reviews/product/:productId', requireAdmin, async (req: Request, res: Response) => {
  const reviews = await prisma.productReview.findMany({
    where: { productId: routeParam(req.params.productId) },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ reviews });
});

// PATCH /api/admin/reviews/:id/moderate — alias for PATCH /reviews/:id
router.patch('/reviews/:id/moderate', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const { status, note } = req.body as { status: string; note?: string };
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'status must be pending, approved, or rejected' });
    return;
  }
  const prev = await prisma.productReview.findUnique({ where: { id } });
  if (!prev) { res.status(404).json({ error: 'Review not found' }); return; }
  const review = await prisma.productReview.update({
    where: { id },
    data: { status: status as 'pending' | 'approved' | 'rejected' },
  });
  await refreshProductReviewStats(prev.productId);
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'MODERATE_REVIEW', targetType: 'product_review', targetId: id, details: { from: prev.status, to: status, note } },
  });
  try { emitAdminEvent('admin:reviews:moderated', { id, productId: prev.productId, status }); } catch { /* non-fatal */ }
  try { emitBroadcast('storefront:reviews:updated', { productId: prev.productId }); } catch { /* non-fatal */ }
  res.json({ review });
});

// ─── Commerce engagement moderation (Q&A, newsletter, restock) ───────────────

async function ensureAdminQaColumns() {
  try {
    const { readyQaTable } = await import('../qa');
    await readyQaTable();
  } catch { /* non-fatal */ }
}

router.get('/qa/pending', requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureAdminQaColumns();
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT q.id, q.product_id, q.user_id, q.question, q.answer, q.asked_at, q.asker_name, q.asker_email,
             q.image_urls, q.answer_image_urls, q.answered_by_name, q.status, q.is_approved,
             p.title_en AS product_title, p.title_bn AS product_title_bn, p.sku AS product_sku,
             (
               SELECT pa.url FROM product_assets pa
               WHERE pa.product_id = q.product_id AND pa.asset_type = 'image'
               ORDER BY pa.is_primary DESC, pa.sort_order ASC
               LIMIT 1
             ) AS product_image,
             u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
             u.profile_image AS customer_avatar
      FROM product_qa q
      LEFT JOIN products p ON p.id = q.product_id
      LEFT JOIN users u ON u.id = q.user_id
      WHERE COALESCE(q.status, 'pending') = 'pending' AND q.is_approved = FALSE
      ORDER BY q.asked_at DESC
      LIMIT 200
    `;
    const items = rows.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      productId: r.product_id,
      user_id: r.user_id,
      userId: r.user_id,
      question: r.question,
      answer: r.answer,
      asked_at: r.asked_at,
      asker_name: r.asker_name || r.customer_name || null,
      asker_email: r.asker_email || r.customer_email || null,
      imageUrls: (r.image_urls as string[]) ?? [],
      answerImageUrls: (r.answer_image_urls as string[]) ?? [],
      status: r.status || 'pending',
      product_title: r.product_title,
      productTitle: r.product_title,
      productTitleBn: r.product_title_bn,
      productSku: r.product_sku,
      productImage: r.product_image,
      customer: {
        id: r.user_id,
        name: r.customer_name || r.asker_name || 'Guest',
        email: r.customer_email || r.asker_email || null,
        phone: r.customer_phone || null,
        avatar: r.customer_avatar || null,
      },
    }));
    res.json({ items, pendingCount: items.length });
  } catch (err: unknown) {
    console.error('[engagement] qa/pending:', (err as Error).message);
    res.json({ items: [], pendingCount: 0 });
  }
});

router.get('/qa', requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureAdminQaColumns();
    const status = String(req.query.status || 'pending');
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT q.id, q.product_id, q.user_id, q.question, q.answer, q.asked_at, q.answered_at,
              q.asker_name, q.asker_email, q.image_urls, q.answer_image_urls, q.answered_by_name,
              q.status, q.is_approved,
              p.title_en AS product_title, p.title_bn AS product_title_bn, p.sku AS product_sku,
              (
                SELECT pa.url FROM product_assets pa
                WHERE pa.product_id = q.product_id AND pa.asset_type = 'image'
                ORDER BY pa.is_primary DESC, pa.sort_order ASC
                LIMIT 1
              ) AS product_image,
              u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone,
              u.profile_image AS customer_avatar
       FROM product_qa q
       LEFT JOIN products p ON p.id = q.product_id
       LEFT JOIN users u ON u.id = q.user_id
       WHERE ($1 = 'all' OR COALESCE(q.status, CASE WHEN q.is_approved THEN 'approved' ELSE 'pending' END) = $1)
       ORDER BY q.asked_at DESC
       LIMIT 300`,
      status,
    );
    const pendingCountRow = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c FROM product_qa
      WHERE COALESCE(status, 'pending') = 'pending' AND is_approved = FALSE
    `;
    res.json({
      items: rows.map((r) => ({
        id: r.id,
        productId: r.product_id,
        userId: r.user_id,
        question: r.question,
        answer: r.answer,
        askedAt: r.asked_at,
        answeredAt: r.answered_at,
        askerName: r.asker_name || r.customer_name || null,
        askerEmail: r.asker_email || r.customer_email || null,
        imageUrls: (r.image_urls as string[]) ?? [],
        answerImageUrls: (r.answer_image_urls as string[]) ?? [],
        answeredByName: r.answered_by_name || null,
        status: r.status || (r.is_approved ? 'approved' : 'pending'),
        productTitle: r.product_title,
        productTitleBn: r.product_title_bn,
        productSku: r.product_sku,
        productImage: r.product_image,
        customer: {
          id: r.user_id,
          name: r.customer_name || r.asker_name || 'Guest',
          email: r.customer_email || r.asker_email || null,
          phone: r.customer_phone || null,
          avatar: r.customer_avatar || null,
        },
      })),
      pendingCount: Number(pendingCountRow[0]?.c ?? 0),
    });
  } catch (err: unknown) {
    console.error('[engagement] qa list:', (err as Error).message);
    res.json({ items: [], pendingCount: 0 });
  }
});

router.patch('/qa/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const { approved, answer, answerImageUrls } = req.body as {
    approved?: boolean;
    answer?: string;
    answerImageUrls?: string[];
  };
  if (approved === undefined) {
    res.status(400).json({ error: 'approved is required' });
    return;
  }
  await ensureAdminQaColumns();
  const safeAnswerImages = (Array.isArray(answerImageUrls) ? answerImageUrls : [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//.test(u))
    .slice(0, 5);
  const status = approved ? 'approved' : 'rejected';
  const answeredBy = approved ? 'OceanBazar Customer Support' : null;
  const answerText = answer != null ? String(answer).trim() || null : null;
  await prisma.$executeRawUnsafe(
    `UPDATE product_qa
     SET is_approved = $1,
         status = $2,
         answer = COALESCE($3, answer),
         answer_image_urls = CASE WHEN cardinality($4::text[]) > 0 THEN $4::text[] ELSE answer_image_urls END,
         answered_by_name = CASE WHEN $1 THEN COALESCE(answered_by_name, $5) ELSE answered_by_name END,
         answered_at = CASE WHEN $1 AND ($3 IS NOT NULL OR cardinality($4::text[]) > 0) THEN NOW() ELSE answered_at END
     WHERE id = $6`,
    approved,
    status,
    answerText,
    safeAnswerImages,
    answeredBy,
    id,
  );
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.adminId,
      action: 'MODERATE_QA',
      targetType: 'product_qa',
      targetId: id,
      details: { approved, hasAnswer: Boolean(answerText), answerImages: safeAnswerImages.length },
    },
  });
  try {
    const row = await prisma.$queryRaw<Array<{ product_id: string }>>`
      SELECT product_id FROM product_qa WHERE id = ${id} LIMIT 1
    `;
    const productId = row[0]?.product_id;
    if (productId) {
      emitAdminEvent('admin:qa:moderated', { id, productId, approved, status });
      emitBroadcast('storefront:qa:updated', { productId });
    }
  } catch { /* non-fatal */ }
  res.json({ success: true });
});

router.get('/newsletter/subscribers', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<Array<{ email: string; subscribed_at: Date }>>`
      SELECT DISTINCT ON (to_address)
        to_address AS email,
        created_at AS subscribed_at
      FROM email_logs
      WHERE template = 'newsletter_signup'
      ORDER BY to_address, created_at DESC
      LIMIT 1000
    `;
    res.json({ items: rows });
  } catch (err: unknown) {
    console.error('[engagement] newsletter/subscribers:', (err as Error).message);
    res.json({ items: [] });
  }
});

router.get('/stock-alerts/subscribers', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<Array<{
      email: string;
      type: string;
      subscribed_at: Date;
      product_id: string;
      product_title: string | null;
    }>>`
      SELECT
        el.to_address AS email,
        el.template AS type,
        el.created_at AS subscribed_at,
        REPLACE(el.template, 'restock_notify:', '') AS product_id,
        p.title_en AS product_title
      FROM email_logs el
      LEFT JOIN products p ON p.id = REPLACE(el.template, 'restock_notify:', '')
      WHERE el.template LIKE 'restock_notify:%'
      ORDER BY el.created_at DESC
      LIMIT 1000
    `;
    res.json({ items: rows });
  } catch (err: unknown) {
    console.error('[engagement] stock-alerts/subscribers:', (err as Error).message);
    res.json({ items: [] });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

router.patch('/reviews/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = routeParam(req.params.id);
  const { status } = req.body as { status: string };
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'status must be pending, approved, or rejected' });
    return;
  }
  const prev = await prisma.productReview.findUnique({ where: { id } });
  if (!prev) {
    res.status(404).json({ error: 'Review not found' });
    return;
  }
  const review = await prisma.productReview.update({
    where: { id },
    data: { status: status as 'pending' | 'approved' | 'rejected' },
  });
  await refreshProductReviewStats(prev.productId);
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.adminId,
      action: 'MODERATE_REVIEW',
      targetType: 'product_review',
      targetId: id,
      details: { from: prev.status, to: status },
    },
  });
  res.json({ review });
});

router.get('/analytics/dashboard', requireAdmin, async (_req, res: Response) => {
  const [orderStats, revenueByDay, topProducts, newUsers] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: true }),
    prisma.order.groupBy({
      by: ['createdAt'],
      _sum: { total: true },
      where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) }, paymentStatus: 'paid' },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.orderItem.groupBy({ by: ['productId'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } }),
  ]);
  res.json({ orderStats, revenueByDay, topProducts, newUsers });
});

// ─── Live snapshot and stream handlers moved above studioRouter ──────────────

// ─── Fulfillment aliases (CRM calls /api/admin/fulfillment/shipments) ────────

router.get('/fulfillment/shipments', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const where: any = {};
  if (req.query.status) where.internal_status = req.query.status;
  if (req.query.orderId) where.order_id = req.query.orderId;
  const [shipments, total] = await Promise.all([
    prisma.courier_shipments.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.courier_shipments.count({ where }),
  ]);
  res.json({ shipments, total, page, limit });
});

router.get('/fulfillment/shipments/order/:orderId', requireAdmin, async (req: Request, res: Response) => {
  const shipments = await prisma.courier_shipments.findMany({ where: { order_id: routeParam(req.params.orderId) } });
  const legacyShipments = await prisma.shipment.findMany({ where: { orderId: routeParam(req.params.orderId) } });
  res.json({ shipments: [...shipments, ...legacyShipments] });
});

router.get('/fulfillment/shipments/:id', requireAdmin, async (req: Request, res: Response) => {
  const cs = await prisma.courier_shipments.findUnique({ where: { id: routeParam(req.params.id) } });
  if (cs) { res.json({ shipment: cs }); return; }
  const legacy = await prisma.shipment.findUnique({ where: { id: routeParam(req.params.id) } });
  if (legacy) { res.json({ shipment: legacy }); return; }
  res.status(404).json({ error: 'Shipment not found' });
});

router.post('/fulfillment/shipments', requireAdmin, async (req: Request, res: Response) => {
  const { orderId, carrier, estimatedDelivery, trackingNumber } = req.body;
  const shipment = await prisma.shipment.create({
    data: {
      id: generateEntityId(),
      orderId,
      carrier: carrier || 'manual',
      trackingNumber: trackingNumber || generateTrackingNumber(),
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
    },
  });
  await prisma.order.update({ where: { id: orderId }, data: { status: 'shipped', trackingNumber: shipment.trackingNumber } });
  res.status(201).json({ shipment });
});

router.patch('/fulfillment/shipments/:id/status', requireAdmin, async (req: Request, res: Response) => {
  const { status } = req.body;
  const cs = await prisma.courier_shipments.findUnique({ where: { id: routeParam(req.params.id) } });
  if (cs) {
    const updated = await prisma.courier_shipments.update({ where: { id: cs.id }, data: { internal_status: status, updated_at: new Date() } });
    res.json({ shipment: updated });
    return;
  }
  const legacy = await prisma.shipment.findUnique({ where: { id: routeParam(req.params.id) } });
  if (legacy) {
    const updated = await prisma.shipment.update({ where: { id: legacy.id }, data: { status } });
    res.json({ shipment: updated });
    return;
  }
  res.status(404).json({ error: 'Shipment not found' });
});

router.delete('/fulfillment/shipments/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.courier_shipments.delete({ where: { id: routeParam(req.params.id) } });
  } catch {
    try { await prisma.shipment.delete({ where: { id: routeParam(req.params.id) } }); }
    catch { res.status(404).json({ error: 'Shipment not found' }); return; }
  }
  res.json({ message: 'Shipment deleted' });
});

router.put('/fulfillment/shipments/:id/tracking', requireAdmin, async (req: Request, res: Response) => {
  const { carrier, trackingNumber, trackingUrl } = req.body;
  try {
    const cs = await prisma.courier_shipments.update({
      where: { id: routeParam(req.params.id) },
      data: { ...(carrier && { courier: carrier }), ...(trackingNumber && { tracking_number: trackingNumber }) },
    });
    res.json({ shipment: cs });
  } catch {
    const legacy = await prisma.shipment.update({
      where: { id: routeParam(req.params.id) },
      data: { ...(carrier && { carrier }), ...(trackingNumber && { trackingNumber }), ...(trackingUrl && { trackingUrl }) },
    });
    res.json({ shipment: legacy });
  }
});

// ─── Notifications extras ────────────────────────────────────────────────────

router.post('/notifications/read-all', requireAdmin, async (_req: Request, res: Response) => {
  await prisma.notifications.updateMany({ where: { read_status: false, audience: 'admin' }, data: { read_status: true } });
  res.json({ message: 'All marked read' });
});

router.post('/notifications/broadcast-customers', requireAdmin, requireAdminReauth(), async (req: Request, res: Response) => {
  const { title, message, image } = req.body;
  const notif = await prisma.notifications.create({
    data: { id: uuidv4(), title, message, audience: 'customers', image, created_by_admin_id: String(req.admin!.adminId) },
  });
  emitBroadcast('notification:new', notif);
  res.status(201).json({ notification: notif });
});

// ─── Chat conversation aliases (CRM calls /chat/conversations) ──────────────

router.get('/chat/conversations', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const [sessions, total] = await Promise.all([
    prisma.chat_sessions.findMany({ orderBy: { last_message_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.chat_sessions.count(),
  ]);
  res.json({ sessions, total, page, limit });
});

router.get('/chat/conversations/:id', requireAdmin, async (req: Request, res: Response) => {
  const session = await prisma.chat_sessions.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json({ session });
});

router.post('/chat/conversations/:id/reply', requireAdmin, async (req: Request, res: Response) => {
  const session = await prisma.chat_sessions.findUnique({ where: { id: routeParam(req.params.id) } });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const newMsg = { id: Date.now().toString(36), sender: 'admin', senderId: String(req.admin!.adminId), message: req.body.message, timestamp: new Date().toISOString() };
  (messages as any[]).push(newMsg);
  await prisma.chat_sessions.update({ where: { id: session.id }, data: { messages, agent_engaged: true, last_message_at: new Date() } });
  emitToUser(session.user_id, 'chat:message', newMsg);
  emitToRoom('admin:chat', 'chat:message', { sessionId: session.id, ...newMsg });
  res.status(201).json({ message: newMsg });
});

router.post('/chat/conversations/:id/close', requireAdmin, async (req: Request, res: Response) => {
  const session = await prisma.chat_sessions.update({
    where: { id: routeParam(req.params.id) },
    data: { is_active: false, closed_by_agent_at: new Date() },
  });
  res.json({ session, message: 'Session closed' });
});

// ─── Upload / Media endpoints ────────────────────────────────────────────────

router.post('/upload', requireAdmin, memUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const mime = req.file.mimetype || '';
  const rt: 'image' | 'video' | 'auto' = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : 'auto';
  const folder = String(req.body?.folder || 'admin').replace(/^\/+|\/+$/g, '') || 'admin';
  try {
    const result = await uploadMedia(req.file.buffer, folder, { resourceType: rt });
    res.json(result);
  } catch (err: any) {
    console.error('[admin/upload]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

router.post('/media/upload', requireAdmin, memUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const folder = String((req.body.folder as string) || 'media').replace(/^\/+|\/+$/g, '') || 'media';
  const mime = req.file.mimetype || '';
  const rt: 'image' | 'video' | 'auto' = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : 'auto';
  try {
    const result = await uploadMedia(req.file.buffer, folder, { resourceType: rt });
    res.json(result);
  } catch (err: any) {
    console.error('[admin/media/upload]', err?.message || err);
    res.status(500).json({ error: err?.message || 'Upload failed' });
  }
});

router.post('/media/upload-multiple', requireAdmin, memUpload.array('files', 20), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) { res.status(400).json({ error: 'No files' }); return; }
  const folder = (req.body.folder as string) || 'media';
  const results = await Promise.all(files.map(f => {
    const mime = f.mimetype || '';
    const rt: 'image' | 'video' | 'auto' = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : 'auto';
    return uploadMedia(f.buffer, folder, { resourceType: rt });
  }));
  res.json({ results });
});

router.delete('/media/delete', requireAdmin, async (req: Request, res: Response) => {
  const publicId = (req.query.publicId as string) || '';
  if (!publicId) { res.status(400).json({ error: 'publicId required' }); return; }
  const result = await deleteImage(publicId);
  res.json(result);
});

router.get('/media/list', requireAdmin, async (req: Request, res: Response) => {
  const folder = (req.query.folder as string) || 'oceanbazar';
  try {
    const result = await cloudinary.api.resources({ type: 'upload', prefix: folder, max_results: 200 });
    res.json({ resources: result.resources });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/media/transform-url', requireAdmin, (req: Request, res: Response) => {
  const { publicId, transformation } = req.body as { publicId: string; transformation?: Record<string, unknown> };
  if (!publicId) { res.status(400).json({ error: 'publicId required' }); return; }
  const url = cloudinary.url(publicId, { secure: true, ...transformation });
  res.json({ url });
});

router.post('/media/rename', requireAdmin, async (req: Request, res: Response) => {
  const { fromPublicId, toPublicId } = req.body as { fromPublicId: string; toPublicId: string };
  if (!fromPublicId || !toPublicId) { res.status(400).json({ error: 'fromPublicId and toPublicId required' }); return; }
  try {
    const result = await cloudinary.uploader.rename(fromPublicId, toPublicId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products/upload', requireAdmin, memUpload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const mime = req.file.mimetype || '';
  const rt: 'image' | 'video' | 'auto' = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : 'auto';
  const result = await uploadMedia(req.file.buffer, 'products', { resourceType: rt });
  res.json(result);
});

// ─── Wholesale approve/revoke (CRM calls) ───────────────────────────────────

router.post('/wholesale/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  const user = await prisma.user.update({ where: { id: routeParam(req.params.id) }, data: { userType: 'wholesale' } });
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'APPROVE_WHOLESALE', targetType: 'user', targetId: user.id, details: {} },
  });
  try {
    emitToUser(user.id, 'notification:new', { title: 'Wholesale Access Approved 🎉', body: 'Your account has been upgraded to Wholesale. You now have access to wholesale pricing and higher order quantities.' });
  } catch { /* non-fatal */ }
  res.json({ user, message: 'Wholesale approved' });
});

router.post('/wholesale/:id/revoke', requireAdmin, async (req: Request, res: Response) => {
  const user = await prisma.user.update({ where: { id: routeParam(req.params.id) }, data: { userType: 'retail' } });
  await prisma.auditLog.create({
    data: { adminId: req.admin!.adminId, action: 'REVOKE_WHOLESALE', targetType: 'user', targetId: user.id, details: {} },
  });
  try {
    emitToUser(user.id, 'notification:new', { title: 'Account Type Updated', body: 'Your account has been moved to Retail pricing. Contact support if you believe this is an error.' });
  } catch { /* non-fatal */ }
  res.json({ user, message: 'Wholesale revoked' });
});

// ─── Applications aliases ────────────────────────────────────────────────────

router.patch('/applications/partner-requests/:id', requireAdmin, async (req: Request, res: Response) => {
  const { status, admin_notes } = req.body;
  const updated = await prismaAny.business_inquiries.update({
    where: { id: routeParam(req.params.id) },
    data: {
      ...(status && { status }),
      ...(admin_notes !== undefined && { admin_notes }),
      reviewed_by_admin_id: String(req.admin!.adminId),
      reviewed_at: new Date(),
      updated_at: new Date(),
    },
  });
  res.json({ inquiry: updated });
});

router.get('/applications/business-inquiries', requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = 20;
  const [inquiries, total] = await Promise.all([
    prisma.business_inquiries.findMany({ orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.business_inquiries.count(),
  ]);
  res.json({ inquiries, total, page, limit });
});

export default router;
