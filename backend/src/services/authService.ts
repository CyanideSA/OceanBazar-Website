import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

import { generateEntityId } from '../utils/hexId';
import { normalizePhoneTarget, isValidBdMobile } from '../utils/phoneNormalize';
import { validatePassword } from '../utils/passwordRules';
import { ensureCustomerForUser } from './customerService';
import { env } from '../config/env';
import { sendOtpEmail, sendPasswordChangedEmail } from './emailService';
import { sendOtpSms, sendPasswordChangedSms } from './smsService';


// ─── OTP ──────────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendOtp(target: string, type: 'login' | 'forgot_password' | 'verify_email'): Promise<string> {
  target = normalizePhoneTarget(target);
  // Emails are case-insensitive — always store/lookup lowercase so send vs verify never mismatch.
  if (target.includes('@')) target = target.toLowerCase();
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + (Number(process.env.OTP_EXPIRE_MINUTES) || 10) * 60_000);

  // Invalidate previous unused OTPs for same target + type
  await prisma.otpCode.updateMany({
    where: { target, type, used: false },
    data: { used: true },
  });

  await prisma.otpCode.create({
    data: { target, code: otp, type, expiresAt },
  });

  // Keep the terminal helper for development without leaking OTPs in production logs.
  if (process.env.NODE_ENV !== 'production' || process.env.OTP_TERMINAL_ONLY === 'true') {
    console.log(`\n╔══════════════════════════════════╗`);
    console.log(`║  OTP CODE [${type.toUpperCase().padEnd(15)}]    ║`);
    console.log(`║  Target : ${target.padEnd(22)}║`);
    console.log(`║  Code   : ${otp.padEnd(22)}  ║`);
    console.log(`╚══════════════════════════════════╝\n`);
  }

  // If not terminal-only, send real email/SMS
  let delivered = process.env.OTP_TERMINAL_ONLY === 'true';
  if (process.env.OTP_TERMINAL_ONLY !== 'true') {
    const isEmail = target.includes('@');
    const sent = isEmail
      ? await sendEmailOtp(target, otp, type)
      : await sendSmsOtp(target, otp, type);
    delivered = sent;

    if (!sent) {
      console.error(`[otp] Delivery failed for ${isEmail ? 'email' : 'phone'} target=${isEmail ? target.replace(/(.{2}).+(@.+)/, '$1***$2') : 'phone'} type=${type}`);
    }
  }

  // #region agent log
  try {
    const fs = await import('fs');
    fs.appendFileSync(
      'debug-7c9155.log',
      `${JSON.stringify({
        sessionId: '7c9155',
        runId: 'otp-email',
        hypothesisId: 'H5',
        location: 'authService.ts:sendOtp',
        message: 'otp send result',
        data: {
          type,
          isEmail: target.includes('@'),
          delivered,
          terminalOnly: process.env.OTP_TERMINAL_ONLY === 'true',
          nodeEnv: process.env.NODE_ENV || '',
        },
        timestamp: Date.now(),
      })}\n`,
    );
  } catch { /* ignore */ }
  // #endregion

  if (!delivered && process.env.OTP_TERMINAL_ONLY !== 'true') {
    const err = new Error('Failed to deliver verification code. Please try again shortly.') as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  return otp;
}

export async function verifyOtp(
  target: string,
  code: string,
  type: 'login' | 'forgot_password' | 'verify_email'
): Promise<boolean> {
  target = normalizePhoneTarget(target);
  if (target.includes('@')) target = target.toLowerCase();
  // Strip spaces and map Bengali/Arabic-Indic digits → ASCII (common on BD keyboards).
  const normalizedCode = String(code || '')
    .replace(/[০-৯]/g, (ch) => String('০১২৩৪৫৬৭৮৯'.indexOf(ch)))
    .replace(/[٠-٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
    .replace(/\s+/g, '')
    .trim();
  const record = await prisma.otpCode.findFirst({
    where: {
      target,
      type,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || record.code !== normalizedCode) return false;

  await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });
  return true;
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

export function issueAccessToken(userId: string, userType: string): string {
  return jwt.sign(
    { userId, user_id: userId, userType },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES || '15m' } as jwt.SignOptions
  );
}

export function issueRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES || '7d' } as jwt.SignOptions
  );
}

// ─── User upsert / login ──────────────────────────────────────────────────────

export async function findOrCreateUserByEmail(email: string) {
  email = String(email || '').trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { id: generateEntityId(), name: email.split('@')[0], email },
    });
    await ensureCustomerForUser(user.id);
  } else {
    await ensureCustomerForUser(user.id);
  }
  return user;
}

export async function findOrCreateUserByPhone(phone: string) {
  phone = normalizePhoneTarget(phone);
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: { id: generateEntityId(), name: phone, phone },
    });
    await ensureCustomerForUser(user.id);
  } else {
    await ensureCustomerForUser(user.id);
  }
  return user;
}

export async function registerUser(data: {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  userType?: 'retail' | 'wholesale';
}) {
  const pwCheck = validatePassword(data.password);
  if (!pwCheck.valid) {
    throw Object.assign(new Error('Weak password: ' + pwCheck.errors.join(', ')), { status: 400 });
  }

  if (!data.email && !data.phone) {
    throw Object.assign(new Error('Email or phone required'), { status: 400 });
  }

  if (data.email) {
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw Object.assign(new Error('Email already registered'), { status: 409 });
  }
  if (data.phone) {
    data.phone = normalizePhoneTarget(data.phone);
    if (!isValidBdMobile(data.phone)) {
      throw Object.assign(
        new Error('Enter a valid Bangladesh mobile number (11 digits, e.g. 017XXXXXXXX)'),
        { status: 400 },
      );
    }
    const exists = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (exists) throw Object.assign(new Error('Phone already registered'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: generateEntityId(),
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        userType: data.userType || 'retail',
        // Register page requires email OTP before submit
        emailVerified: Boolean(data.email),
      },
    });
    await tx.customer.create({ data: { userId: user.id } });
    return user;
  });
}

export async function loginWithPassword(identifier: string, password: string) {
  const isEmail = identifier.includes('@');
  const lookup = isEmail ? identifier : normalizePhoneTarget(identifier);
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: lookup } })
    : await prisma.user.findUnique({ where: { phone: lookup } });

  if (!user || !user.passwordHash) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  if (user.accountStatus === 'suspended') {
    throw Object.assign(new Error('Account suspended'), { status: 403 });
  }

  return user;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.passwordHash) {
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw Object.assign(new Error('Current password incorrect'), { status: 400 });
  }

  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) {
    throw Object.assign(new Error('Weak password: ' + pwCheck.errors.join(', ')), { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  // Notify user of password change
  if (user.email) await sendPasswordChangeNotification(user.email, 'email');
  if (user.phone) await sendPasswordChangeNotification(user.phone, 'sms');
}

export async function resetPassword(target: string, newPassword: string) {
  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) {
    throw Object.assign(new Error('Weak password: ' + pwCheck.errors.join(', ')), { status: 400 });
  }

  const isEmail = target.includes('@');
  const lookup = isEmail ? target : normalizePhoneTarget(target);
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: lookup } })
    : await prisma.user.findUnique({ where: { phone: lookup } });

  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  if (user.email) await sendPasswordChangeNotification(user.email, 'email');
  if (user.phone) await sendPasswordChangeNotification(user.phone, 'sms');

  return user;
}

// ─── Social auth ──────────────────────────────────────────────────────────────

export async function upsertSocialUser(profile: {
  provider: 'google' | 'facebook' | 'instagram';
  providerId: string;
  name: string;
  email?: string;
  accessToken: string;
}) {
  let socialAccount = await prisma.socialAccount.findUnique({
    where: { provider_providerId: { provider: profile.provider, providerId: profile.providerId } },
    include: { user: true },
  });

  if (socialAccount) {
    await prisma.socialAccount.update({
      where: { id: socialAccount.id },
      data: { accessToken: profile.accessToken },
    });
    await ensureCustomerForUser(socialAccount.user.id);
    return socialAccount.user;
  }

  // Try to link to existing user by email
  let user = profile.email
    ? await prisma.user.findUnique({ where: { email: profile.email } })
    : null;

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: generateEntityId(),
        name: profile.name,
        email: profile.email,
      },
    });
    await ensureCustomerForUser(user.id);
  } else {
    await ensureCustomerForUser(user.id);
  }

  await prisma.socialAccount.create({
    data: {
      userId: user.id,
      provider: profile.provider,
      providerId: profile.providerId,
      accessToken: profile.accessToken,
    },
  });

  return user;
}

async function sendEmailOtp(email: string, otp: string, type: string): Promise<boolean> {
  return sendOtpEmail(email, otp, type);
}

async function sendSmsOtp(phone: string, otp: string, type: string): Promise<boolean> {
  return sendOtpSms(phone, otp, type);
}

async function sendPasswordChangeNotification(target: string, channel: 'email' | 'sms') {
  if (channel === 'email') {
    await sendPasswordChangedEmail(target);
  } else {
    await sendPasswordChangedSms(target);
  }
}
