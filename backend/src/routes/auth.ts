import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import {
  sendOtp, verifyOtp,
  registerUser, loginWithPassword,
  findOrCreateUserByEmail, findOrCreateUserByPhone,
  issueAccessToken,
  changePassword, resetPassword, upsertSocialUser,
} from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { emitAdminEvent } from '../lib/adminEvents';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter';
import { prisma } from '../lib/prisma';

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { verifyFirebaseToken } from '../services/firebaseService';
import { verifyRecaptchaToken } from '../services/recaptchaService';
import {
  issueRefreshSession,
  rotateRefreshSession,
  revokeRefreshSessionByToken,
  getLoginVerificationDecision,
} from '../services/userSessionService';
import {
  isMobileClient,
  readRefreshToken,
  refreshTokenSource,
} from '../utils/mobileClient';

const router = Router();

/** HttpOnly refresh cookie — must survive laptop sleep / browser reopen. */
function refreshCookieOptions() {
  const secure =
    process.env.NODE_ENV === 'production' ||
    process.env.TRUST_PROXY === '1' ||
    process.env.COOKIE_SECURE === 'true';
  const domain = (process.env.COOKIE_DOMAIN || '').trim() || undefined;
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: 7 * 86400_000,
    ...(domain ? { domain } : {}),
  };
}

type AuthUserPayload = Record<string, unknown>;

/**
 * Web: set HttpOnly cookie + return { access, user? }.
 * Mobile (X-Client-Platform: mobile): also return refresh in JSON for secure storage.
 */
function respondWithSession(
  req: Request,
  res: Response,
  opts: { access: string; refresh: string; user?: AuthUserPayload; status?: number },
) {
  const mobile = isMobileClient(req);
  const body: { access: string; user?: AuthUserPayload; refresh?: string } = {
    access: opts.access,
  };
  if (opts.user) body.user = opts.user;
  // Only native clients get refresh in the body — keeps XSS blast radius low on web.
  if (mobile) body.refresh = opts.refresh;

  // #region agent log
  fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '781e0c',
    },
    body: JSON.stringify({
      sessionId: '781e0c',
      runId: 'mobile-auth',
      hypothesisId: 'H3',
      location: 'auth.ts:respondWithSession',
      message: 'Auth session response shaped',
      data: {
        mobile,
        hasUser: Boolean(opts.user),
        includesRefreshInBody: Boolean(body.refresh),
        status: opts.status || 200,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const responder = opts.status ? res.status(opts.status) : res;
  responder.cookie('refreshToken', opts.refresh, refreshCookieOptions()).json(body);
}

// ─── Setup Passport strategies (only if real OAuth creds are configured) ─────

const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  && !process.env.GOOGLE_CLIENT_ID.startsWith('your_'));
const hasFacebook = !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET
  && !process.env.FACEBOOK_APP_ID.startsWith('your_'));

if (hasGoogle) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      },
      async (_at, _rt, profile, done) => {
        try {
          const user = await upsertSocialUser({
            provider: 'google',
            providerId: profile.id,
            name: profile.displayName,
            email: profile.emails?.[0]?.value,
            accessToken: _at,
          });
          done(null, user);
        } catch (e) {
          done(e as Error);
        }
      }
    )
  );
}

if (hasFacebook) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID!,
        clientSecret: process.env.FACEBOOK_APP_SECRET!,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL!,
        profileFields: ['id', 'displayName', 'emails'],
      },
      async (_at, _rt, profile, done) => {
        try {
          const user = await upsertSocialUser({
            provider: 'facebook',
            providerId: profile.id,
            name: profile.displayName,
            email: profile.emails?.[0]?.value,
            accessToken: _at,
          });
          done(null, user);
        } catch (e) {
          done(e as Error);
        }
      }
    )
  );
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('email').optional({ values: 'falsy' }).isEmail(),
    body('phone').optional({ values: 'falsy' }).customSanitizer((v) => {
      if (typeof v !== 'string' || !v.trim()) return v;
      // Normalize BD local formats before mobile validation
      const t = v.trim();
      if (t.includes('@')) return t;
      let digits = t.replace(/[^\d+]/g, '');
      if (digits.startsWith('+')) return digits;
      if (digits.startsWith('00')) digits = digits.slice(2);
      if (digits.startsWith('88') && digits.length >= 11) return `+${digits}`;
      if (digits.startsWith('0')) return `+880${digits.slice(1)}`;
      return `+880${digits}`;
    }).custom((v) => {
      if (typeof v !== 'string' || !v.trim()) return true;
      // Bangladesh mobile: +880 1X XXXXXXXX (10 digits after country code, starting with 1)
      if (!/^\+8801\d{9}$/.test(v)) {
        throw new Error('Enter a valid Bangladesh mobile number (11 digits, e.g. 017XXXXXXXX)');
      }
      return true;
    }),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    try {
      const recaptchaToken = (req.body as { recaptchaToken?: string }).recaptchaToken;
      const captcha = await verifyRecaptchaToken(recaptchaToken || '', 'register');
      if (!captcha.ok) {
        res.status(403).json({
          error: 'reCAPTCHA verification failed',
          reason: captcha.reason,
          detail: captcha.detail,
        });
        return;
      }
      console.log(`[AUTH] Register attempt for email: ${req.body.email}, phone: ${req.body.phone}`);
      const user = await registerUser(req.body);
      console.log(`[AUTH] Register successful for user: ${user.id}, email: ${user.email}, phone: ${user.phone}`);
      try { emitAdminEvent('admin:user:new', { userId: user.id, userType: user.userType }); } catch { /* non-fatal */ }
      if (user.email) {
        try {
          const { sendWelcomeCatalogEmail } = await import('../services/emailService');
          sendWelcomeCatalogEmail(user.email, user.name).catch(() => {});
        } catch { /* non-fatal */ }
      }
      const access = issueAccessToken(user.id, user.userType);
      const refresh = await issueRefreshSession(user.id, req);
      respondWithSession(req, res, { access, refresh, user: sanitizeUser(user) as AuthUserPayload });
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      console.error(`[AUTH] Register failed for email: ${req.body.email}, phone: ${req.body.phone}, error: ${err.message}`);
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// ─── POST /api/auth/send-otp ──────────────────────────────────────────────────

router.post('/send-otp', otpLimiter, async (req: Request, res: Response) => {
  const { target, type = 'login' } = req.body as { target: string; type: string };
  if (!target) { res.status(400).json({ error: 'target (email or phone) required' }); return; }
  await sendOtp(target, type as 'login' | 'forgot_password' | 'verify_email');
  res.json({ message: 'Verification code sent to your configured email or phone channel.' });
});

// ─── POST /api/auth/verify-otp ────────────────────────────────────────────────

router.post('/verify-otp', authLimiter, async (req: Request, res: Response) => {
  const { target, code, type = 'login' } = req.body as { target: string; code: string; type?: string };
  if (!target || !code) { res.status(400).json({ error: 'target and code required' }); return; }

  const otpType = (type === 'verify_email' ? 'verify_email' : 'login') as 'login' | 'verify_email';
  const ok = await verifyOtp(target, code, otpType);
  if (!ok) { res.status(401).json({ error: 'Invalid or expired OTP' }); return; }

  // Any successful email OTP proves ownership of that address.
  if (target.includes('@')) {
    const email = String(target).trim().toLowerCase();
    await prisma.user.updateMany({
      where: { email },
      data: { emailVerified: true },
    });
  }

  // For verify_email type, just confirm verification without creating a session
  if (otpType === 'verify_email') {
    res.json({ verified: true, message: 'OTP verified successfully' });
    return;
  }

  const isEmail = target.includes('@');
  const user = isEmail
    ? await findOrCreateUserByEmail(target)
    : await findOrCreateUserByPhone(target);

  const access = issueAccessToken(user.id, user.userType);
  const refresh = await issueRefreshSession(user.id, req, { verified: true });
  respondWithSession(req, res, { access, refresh, user: sanitizeUser(user) as AuthUserPayload });
});

// ─── POST /api/auth/login (password) ─────────────────────────────────────────

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const { identifier, password, recaptchaToken } = req.body as { identifier: string; password: string; recaptchaToken?: string };
  if (!identifier || !password) {
    res.status(400).json({ error: 'identifier and password required' });
    return;
  }
  try {
    // Lite / native mobile clients use X-Client-Platform (no browser reCAPTCHA).
    const skipCaptcha = isMobileClient(req);
    // #region agent log
    try {
      const fs = await import('fs');
      const path = await import('path');
      fs.appendFileSync(
        path.resolve(__dirname, '../../../debug-1eb282.log'),
        `${JSON.stringify({
          sessionId: '1eb282',
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'auth.ts:login',
          message: 'password login captcha gate',
          data: {
            skipCaptcha,
            platform: String(req.headers['x-client-platform'] || ''),
            hasRecaptcha: Boolean(recaptchaToken),
          },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion
    if (!skipCaptcha) {
      const captcha = await verifyRecaptchaToken(recaptchaToken || '', 'login');
      if (!captcha.ok) {
        res.status(403).json({
          error: 'reCAPTCHA verification failed',
          reason: captcha.reason,
          detail: captcha.detail,
        });
        return;
      }
    }
    console.log(`[AUTH] Login attempt for identifier: ${identifier}`);
    const user = await loginWithPassword(identifier, password);
    console.log(`[AUTH] Login successful for user: ${user.id}, email: ${user.email}, phone: ${user.phone}`);
    if (user.email) {
      const verification = await getLoginVerificationDecision(user.id, req);
      if (verification.required) {
        await sendOtp(user.email, 'login');
        res.status(202).json({
          requiresEmailOtp: true,
          verificationTarget: user.email,
          reason: verification.reason,
        });
        return;
      }
    }
    const access = issueAccessToken(user.id, user.userType);
    const refresh = await issueRefreshSession(user.id, req);
    respondWithSession(req, res, { access, refresh, user: sanitizeUser(user) as AuthUserPayload });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    console.error(`[AUTH] Login failed for identifier: ${identifier}, error: ${err.message}`);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  const source = refreshTokenSource(req);
  const token = readRefreshToken(req);
  // #region agent log
  fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '781e0c',
    },
    body: JSON.stringify({
      sessionId: '781e0c',
      runId: 'mobile-auth',
      hypothesisId: 'H1',
      location: 'auth.ts:refresh',
      message: 'Refresh token source resolved',
      data: {
        source,
        mobile: isMobileClient(req),
        hasToken: Boolean(token),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }
  try {
    const payload = await rotateRefreshSession(token, req);
    if (!payload) { res.status(401).json({ error: 'Invalid refresh token' }); return; }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }
    const access = issueAccessToken(user.id, user.userType);
    const refresh = await issueRefreshSession(user.id, req);
    // #region agent log
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '781e0c',
      },
      body: JSON.stringify({
        sessionId: '781e0c',
        runId: 'mobile-auth',
        hypothesisId: 'H2',
        location: 'auth.ts:refresh:success',
        message: 'Refresh rotated successfully',
        data: { source, mobile: isMobileClient(req) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    respondWithSession(req, res, { access, refresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ user: sanitizeUser(user) });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post('/logout', async (req: Request, res: Response) => {
  const source = refreshTokenSource(req);
  const token = readRefreshToken(req);
  // #region agent log
  fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '781e0c',
    },
    body: JSON.stringify({
      sessionId: '781e0c',
      runId: 'mobile-auth',
      hypothesisId: 'H4',
      location: 'auth.ts:logout',
      message: 'Logout refresh revoke attempt',
      data: { source, hasToken: Boolean(token), mobile: isMobileClient(req) },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (token) await revokeRefreshSessionByToken(token);
  res.clearCookie('refreshToken', refreshCookieOptions()).json({ message: 'Logged out' });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

router.post('/forgot-password', otpLimiter, async (req: Request, res: Response) => {
  const { target } = req.body as { target: string };
  if (!target) { res.status(400).json({ error: 'Email or phone required' }); return; }
  try {
    await sendOtp(target, 'forgot_password');
    // #region agent log
    try {
      const fs = await import('fs');
      fs.appendFileSync(
        'debug-7c9155.log',
        `${JSON.stringify({
          sessionId: '7c9155',
          runId: 'otp-email',
          hypothesisId: 'H5',
          location: 'auth.ts:forgot-password',
          message: 'forgot-password otp accepted',
          data: { isEmail: String(target).includes('@') },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion
    res.json({ message: 'Reset OTP sent.' });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    // #region agent log
    try {
      const fs = await import('fs');
      fs.appendFileSync(
        'debug-7c9155.log',
        `${JSON.stringify({
          sessionId: '7c9155',
          runId: 'otp-email',
          hypothesisId: 'H5',
          location: 'auth.ts:forgot-password-fail',
          message: 'forgot-password otp failed',
          data: { status: err.status || 500, err: err.message },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion
    res.status(err.status || 500).json({ error: err.message || 'Failed to send reset code' });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────

router.post('/reset-password', async (req: Request, res: Response) => {
  const { target, otp, newPassword } = req.body as { target: string; otp: string; newPassword: string };
  const ok = await verifyOtp(target, otp, 'forgot_password');
  if (!ok) { res.status(401).json({ error: 'Invalid or expired OTP' }); return; }
  try {
    await resetPassword(target, newPassword);
    res.json({ message: 'Password reset successfully.' });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── POST /api/auth/resend-verification ─────────────────────────────────────

router.post('/resend-verification', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    if (user.emailVerified) { res.json({ success: true, message: 'Email is already verified' }); return; }
    if (!user.email) { res.status(400).json({ error: 'No email on file' }); return; }
    await sendOtp(user.email, 'verify_email' as any);
    res.json({ success: true, message: 'Verification OTP resent' });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── PUT /api/auth/change-password ───────────────────────────────────────────

router.put('/change-password', requireAuth, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  try {
    await changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ message: 'Password changed. Notifications sent via email and SMS.' });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── POST /api/auth/firebase — verify Firebase ID token and issue JWT ────────

router.post('/firebase', async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken: string };
  if (!idToken) { res.status(400).json({ error: 'idToken required' }); return; }

  try {
    const fbUser = await verifyFirebaseToken(idToken);
    if (!fbUser) { res.status(401).json({ error: 'Invalid Firebase token' }); return; }

    let provider: 'google' | 'facebook' | 'phone';
    let user;

    if (fbUser.provider === 'phone') {
      if (!fbUser.phone) {
        res.status(401).json({ error: 'Firebase phone number is missing' });
        return;
      }
      provider = 'phone';
      user = await findOrCreateUserByPhone(fbUser.phone);
    } else {
      provider = fbUser.provider === 'facebook.com' ? 'facebook' : 'google';
      user = await upsertSocialUser({
        provider,
        providerId: fbUser.uid,
        name: fbUser.name || 'User',
        email: fbUser.email,
        accessToken: idToken,
      });
    }

    const access = issueAccessToken(user.id, user.userType);
    const refresh = await issueRefreshSession(user.id, req);

    console.log(`[AUTH] Firebase login for uid: ${fbUser.uid}, provider: ${provider}, user: ${user.id}`);

    respondWithSession(req, res, { access, refresh, user: sanitizeUser(user) as AuthUserPayload });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('[AUTH] Firebase auth error:', err.message);
    res.status(500).json({ error: 'Firebase authentication failed' });
  }
});

// ─── Social OAuth routes ──────────────────────────────────────────────────────

if (hasGoogle) {
  router.get('/social/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get(
    '/social/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/auth/login?error=social' }),
    socialCallback
  );
} else {
  // OAuth credentials not configured — do NOT mint demo users (that leaked into storefront login).
  router.get('/social/google', (_req: Request, res: Response) => {
    res.status(501).json({
      error: 'Google OAuth is not configured on the API. Use Firebase social login from the storefront.',
      code: 'SOCIAL_OAUTH_NOT_CONFIGURED',
    });
  });
}

if (hasFacebook) {
  router.get('/social/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));
  router.get(
    '/social/facebook/callback',
    passport.authenticate('facebook', { session: false, failureRedirect: '/auth/login?error=social' }),
    socialCallback
  );
} else {
  router.get('/social/facebook', (_req: Request, res: Response) => {
    res.status(501).json({
      error: 'Facebook OAuth is not configured on the API. Use Firebase social login from the storefront.',
      code: 'SOCIAL_OAUTH_NOT_CONFIGURED',
    });
  });
}

async function socialCallback(req: Request, res: Response) {
  const user = req.user as { id: string; userType: string } | undefined;
  if (!user) { res.redirect(`${process.env.CLIENT_URL}/auth/login?error=social`); return; }
  const access = issueAccessToken(user.id, user.userType);
  const refresh = await issueRefreshSession(user.id, req);
  res
    .cookie('refreshToken', refresh, refreshCookieOptions())
    .redirect(`${process.env.CLIENT_URL}/auth/callback?token=${access}`);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function sanitizeUser(user: { id: string; name: string; email: string | null; phone: string | null; userType: string; accountStatus: string; preferredLang: string; emailVerified: boolean; profileImage: string | null; lifetimeSpend: unknown }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    userType: user.userType,
    accountStatus: user.accountStatus,
    preferredLang: user.preferredLang,
    emailVerified: user.emailVerified,
    profileImage: user.profileImage,
    lifetimeSpend: Number(user.lifetimeSpend),
  };
}

export default router;
