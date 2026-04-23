import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { generateEntityId } from '../utils/hexId';
import { validatePassword } from '../utils/passwordRules';
import { ensureCustomerForUser } from './customerService';

const prisma = new PrismaClient();

// ─── OTP ──────────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendOtp(target: string, type: 'login' | 'forgot_password' | 'verify_email'): Promise<string> {
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

  // Always print OTP to terminal for development / testing
  console.log(`\n╔══════════════════════════════════╗`);
  console.log(`║  OTP CODE [${type.toUpperCase().padEnd(15)}]    ║`);
  console.log(`║  Target : ${target.padEnd(22)}║`);
  console.log(`║  Code   : ${otp.padEnd(22)}  ║`);
  console.log(`╚══════════════════════════════════╝\n`);

  // If not terminal-only, send real email/SMS
  if (process.env.OTP_TERMINAL_ONLY !== 'true') {
    const isEmail = target.includes('@');
    if (isEmail) {
      await sendEmailOtp(target, otp, type);
    } else {
      await sendSmsOtp(target, otp);
    }
  }

  return otp;
}

export async function verifyOtp(
  target: string,
  code: string,
  type: 'login' | 'forgot_password' | 'verify_email'
): Promise<boolean> {
  const record = await prisma.otpCode.findFirst({
    where: {
      target,
      type,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || record.code !== code) return false;

  await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });
  return true;
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

export function issueAccessToken(userId: string, userType: string): string {
  return jwt.sign(
    { userId, userType },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' } as jwt.SignOptions
  );
}

export function issueRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' } as jwt.SignOptions
  );
}

// ─── User upsert / login ──────────────────────────────────────────────────────

export async function findOrCreateUserByEmail(email: string) {
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
      },
    });
    await tx.customer.create({ data: { userId: user.id } });
    return user;
  });
}

export async function loginWithPassword(identifier: string, password: string) {
  const isEmail = identifier.includes('@');
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: identifier } })
    : await prisma.user.findUnique({ where: { phone: identifier } });

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
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: target } })
    : await prisma.user.findUnique({ where: { phone: target } });

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

// ─── Notification stubs (extend with real provider) ───────────────────────────

async function sendEmailOtp(email: string, otp: string, type: string) {
  // TODO: replace with real nodemailer call
  console.log(`[EMAIL] Sending ${type} OTP ${otp} to ${email}`);
}

async function sendSmsOtp(phone: string, otp: string) {
  // TODO: replace with real Twilio / BD SMS provider call
  console.log(`[SMS] Sending OTP ${otp} to ${phone}`);
}

async function sendPasswordChangeNotification(target: string, channel: 'email' | 'sms') {
  console.log(`[${channel.toUpperCase()}] Password changed notification sent to ${target}`);
}
