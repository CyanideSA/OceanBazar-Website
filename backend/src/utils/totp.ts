import speakeasy from 'speakeasy';

const STEP_SEC = 30;

export function normalizeTotpSecret(secret: string): string {
  return String(secret || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
}

/** 20 bytes → 32-char Base32 (Google Authenticator standard). */
export function generateBase32Secret(): string {
  return normalizeTotpSecret(speakeasy.generateSecret({ length: 20 }).base32);
}

/** Google Key URI via speakeasy (max compatibility with Google Authenticator). */
export function buildOtpAuthUrl(issuer: string, accountLabel: string, secret: string): string {
  const normalized = normalizeTotpSecret(secret);
  return speakeasy.otpauthURL({
    secret: normalized,
    label: accountLabel,
    issuer,
    encoding: 'base32',
  }) as string;
}

export function formatManualEntryKey(secret: string): string {
  const n = normalizeTotpSecret(secret);
  return n.replace(/(.{4})/g, '$1 ').trim();
}

export function totpSecretHint(secret: string): string {
  const n = normalizeTotpSecret(secret);
  return n.length >= 4 ? n.slice(-4) : '';
}

export type TotpVerifyResult = { valid: boolean; periodCounter?: number };

function speakeasyVerify(
  secret: string,
  token: string,
  window: number,
): boolean {
  return speakeasy.totp.verify({
    secret: normalizeTotpSecret(secret),
    encoding: 'base32',
    token: String(token).replace(/\D+/g, ''),
    window,
  });
}

/** Enrollment: wide clock window; GA must match this secret (scan QR or paste manual key). */
export function verifySetupTotp(secret: string, token: string): TotpVerifyResult {
  const normalizedSecret = normalizeTotpSecret(secret);
  const normalizedToken = String(token ?? '').replace(/\D+/g, '');
  if (!normalizedSecret || normalizedSecret.length < 10 || !/^\d{6}$/.test(normalizedToken)) {
    return { valid: false };
  }
  const valid = speakeasyVerify(normalizedSecret, normalizedToken, 10);
  if (!valid) {
    return { valid: false };
  }
  return { valid: true, periodCounter: Math.floor(Date.now() / 1000 / STEP_SEC) };
}

/** Login: current + slight future window only (reject clearly expired codes). */
export function verifyAdminTotp(secret: string, token: string): TotpVerifyResult {
  const normalizedSecret = normalizeTotpSecret(secret);
  const normalizedToken = String(token ?? '').replace(/\D+/g, '');
  if (!normalizedSecret || normalizedSecret.length < 10 || !/^\d{6}$/.test(normalizedToken)) {
    return { valid: false };
  }
  const epochMs = Date.now();
  const baseCounter = Math.floor(epochMs / 1000 / STEP_SEC);
  let matchedDelta: number | null = null;
  for (let delta = 0; delta <= 2; delta += 1) {
    const counter = baseCounter + delta;
    const expected = speakeasy.totp({
      secret: normalizedSecret,
      encoding: 'base32',
      time: counter * STEP_SEC,
    });
    if (expected === normalizedToken) {
      matchedDelta = delta;
      break;
    }
  }
  if (matchedDelta === null) {
    return { valid: false };
  }
  return { valid: true, periodCounter: baseCounter + matchedDelta };
}

export function verifyTotp(secret: string, token: string): boolean {
  return verifyAdminTotp(secret, token).valid;
}

export function currentTotpPeriodCounter(): number {
  return Math.floor(Date.now() / 1000 / STEP_SEC);
}
