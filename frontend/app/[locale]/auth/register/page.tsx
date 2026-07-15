'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi, referralApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { validatePassword, getPasswordStrength } from '@/lib/passwordRules';
import { signInWithGoogle, signInWithFacebook } from '@/lib/firebase';
import Logo from '@/components/shared/Logo';
import { loadRecaptchaScript, executeRecaptcha } from '@/lib/recaptcha';
import { CheckCircle2, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';
import { normalizePhoneTarget } from '@/lib/phoneNormalize';

/* ── rate-limit constants ───────────────────────────────────────── */
const RESEND_COOLDOWN = 30;   // seconds between resends
const MAX_RESENDS     = 10;   // max resends before lock
const LOCK_DURATION   = 60 * 60 * 1000; // 1 hour ms

/* ── localStorage lock helpers ──────────────────────────────────── */
function isLocked(key: string): boolean {
  if (typeof window === 'undefined') return false;
  const ts = localStorage.getItem(key);
  if (!ts) return false;
  return Date.now() - Number(ts) < LOCK_DURATION;
}
function setLock(key: string) {
  localStorage.setItem(key, String(Date.now()));
}

/* ── shared input class ─────────────────────────────────────────── */
const INPUT_CLS =
  'w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground';

function RegisterPageInner() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const { setUser } = useAuthStore();

  /* ── referral code from URL (?ref=CODE) ─────────────────────────── */
  const [referralCode, setReferralCode] = useState('');

  /* ── form state ────────────────────────────────────────────────── */
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [email, setEmail]                 = useState('');
  const [phone, setPhone]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPw, setConfirmPw]         = useState('');
  const [loading, setLoading]             = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [error, setError]                 = useState('');
  const [pwErrors, setPwErrors]           = useState<string[]>([]);

  /* ── email verification state ──────────────────────────────────── */
  const [emailOtpSent, setEmailOtpSent]       = useState(false);
  const [emailOtp, setEmailOtp]               = useState('');
  const [emailVerified, setEmailVerified]     = useState(false);
  const [emailVerifying, setEmailVerifying]   = useState(false);
  const [emailSending, setEmailSending]       = useState(false);
  const [emailCooldown, setEmailCooldown]     = useState(0);
  const [emailResendCount, setEmailResendCount] = useState(0);
  const [emailLocked, setEmailLocked]         = useState(false);
  const emailTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── phone verification state ──────────────────────────────────── */
  const [phoneOtpSent, setPhoneOtpSent]       = useState(false);
  const [phoneOtp, setPhoneOtp]               = useState('');
  const [phoneVerified, setPhoneVerified]     = useState(false);
  const [phoneVerifying, setPhoneVerifying]   = useState(false);
  const [phoneSending, setPhoneSending]       = useState(false);
  const [phoneCooldown, setPhoneCooldown]     = useState(0);
  const [phoneResendCount, setPhoneResendCount] = useState(0);
  const [phoneLocked, setPhoneLocked]         = useState(false);
  const phoneTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { loadRecaptchaScript(); }, []);

  // Check locks on mount
  useEffect(() => {
    if (isLocked('ob_email_lock')) setEmailLocked(true);
    if (isLocked('ob_phone_lock')) setPhoneLocked(true);
  }, []);

  // Cleanup timers
  useEffect(() => () => {
    if (emailTimerRef.current) clearInterval(emailTimerRef.current);
    if (phoneTimerRef.current) clearInterval(phoneTimerRef.current);
  }, []);

  // Read ?ref=CODE from URL and track click
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref.toUpperCase().slice(0, 10));
      // Track click non-blockingly
      referralApi.trackClick(ref).catch(() => {});
    }
  }, [searchParams]);

  /* ── cooldown ticker ───────────────────────────────────────────── */
  const startCooldown = useCallback((type: 'email' | 'phone') => {
    const setter = type === 'email' ? setEmailCooldown : setPhoneCooldown;
    const timerRef = type === 'email' ? emailTimerRef : phoneTimerRef;
    setter(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setter((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /* ── password helpers ──────────────────────────────────────────── */
  const strength = getPasswordStrength(password);
  const strengthColor = { weak: 'bg-red-400', fair: 'bg-yellow-400', strong: 'bg-green-500' }[strength];
  const pwMismatch = confirmPw.length > 0 && password !== confirmPw;

  function onPasswordChange(val: string) {
    setPassword(val);
    const { errors } = validatePassword(val);
    setPwErrors(errors);
  }

  /* ── send OTP (email or phone) ─────────────────────────────────── */
  async function handleSendOtp(type: 'email' | 'phone') {
    const target = type === 'email' ? email.trim() : normalizePhoneTarget(phone);
    if (!target) { setError(type === 'email' ? t('emailRequired') : t('phoneRequired')); return; }

    const lockKey = type === 'email' ? 'ob_email_lock' : 'ob_phone_lock';
    const resendCount = type === 'email' ? emailResendCount : phoneResendCount;

    if (isLocked(lockKey)) {
      type === 'email' ? setEmailLocked(true) : setPhoneLocked(true);
      setError(type === 'email' ? t('emailLocked') : t('phoneLocked'));
      return;
    }

    if (resendCount >= MAX_RESENDS) {
      setLock(lockKey);
      type === 'email' ? setEmailLocked(true) : setPhoneLocked(true);
      setError(type === 'email' ? t('emailLocked') : t('phoneLocked'));
      return;
    }

    const setSending = type === 'email' ? setEmailSending : setPhoneSending;
    setSending(true);
    setError('');

    try {
      await authApi.sendOtp(target, 'verify_email');
      if (type === 'email') {
        setEmailOtpSent(true);
        setEmailResendCount((c) => c + 1);
      } else {
        setPhoneOtpSent(true);
        setPhoneResendCount((c) => c + 1);
      }
      startCooldown(type);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.error || err.response?.data?.message || tc('error'));
    } finally {
      setSending(false);
    }
  }

  /* ── verify OTP (email or phone) ───────────────────────────────── */
  async function handleVerifyOtp(type: 'email' | 'phone') {
    const target = type === 'email' ? email.trim() : normalizePhoneTarget(phone);
    const code = type === 'email' ? emailOtp : phoneOtp;
    if (!code || code.length < 6) return;

    const setVerifying = type === 'email' ? setEmailVerifying : setPhoneVerifying;
    setVerifying(true);
    setError('');

    try {
      await authApi.verifyOtp(target, code, 'verify_email');
      if (type === 'email') setEmailVerified(true);
      else setPhoneVerified(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.error || err.response?.data?.message || tc('error'));
    } finally {
      setVerifying(false);
    }
  }

  /* ── form submit ───────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email || !phone) { setError(t('bothRequired')); return; }
    if (!emailVerified || !phoneVerified) { setError(t('verifyBothRequired')); return; }

    const { valid, errors } = validatePassword(password);
    if (!valid) { setPwErrors(errors); return; }
    if (password !== confirmPw) { setError(t('passwordMismatch')); return; }

    setLoading(true);
    try {
      const name = `${firstName} ${lastName}`.trim();
      const normalizedPhone = normalizePhoneTarget(phone);
      const recaptchaToken = await executeRecaptcha('register');
      const { data } = await authApi.register({ name, email, phone: normalizedPhone, password, userType: 'retail', recaptchaToken });
      const token = data.token || data.access;
      setUser(data.user as User, token);

      // Claim referral code if present — non-blocking, silently ignores errors
      if (referralCode) {
        referralApi.claim(referralCode).catch(() => {});
      }

      router.push(`/${locale}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? tc('error'));
    } finally { setLoading(false); }
  }

  /* ── social login ──────────────────────────────────────────────── */
  async function handleSocialLogin(provider: 'google' | 'facebook') {
    setSocialLoading(provider); setError('');
    try {
      const idToken = provider === 'google' ? await signInWithGoogle() : await signInWithFacebook();
      const { data } = await authApi.firebaseLogin(idToken);
      setUser(data.user as User, data.token || data.access);
      router.push(`/${locale}`);
    } catch (e: unknown) {
      const code = (e as any)?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setSocialLoading(null);
        return;
      }
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.error || err.response?.data?.message || tc('error'));
    } finally { setSocialLoading(null); }
  }

  /* ── can submit check ──────────────────────────────────────────── */
  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    emailVerified &&
    phoneVerified &&
    pwErrors.length === 0 &&
    password.length > 0 &&
    password === confirmPw &&
    !loading;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href={`/${locale}`} className="inline-flex items-center justify-center">
              <Logo width={182} height={76} priority interaction="brand" />
            </Link>
            <p className="text-muted-foreground mt-2">{t('register')}</p>
          </div>

          {/* Global error */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {error}
            </div>
          )}

          {/* Referral badge */}
          {referralCode && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <Gift className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400">
                Referral code <strong className="font-mono">{referralCode}</strong> applied — you'll earn bonus rewards!
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── First Name / Last Name ─────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder={t('firstName')}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className={INPUT_CLS}
              />
              <input
                type="text"
                placeholder={t('lastName')}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className={INPUT_CLS}
              />
            </div>

            {/* ── Email + Verify ─────────────────────────────── */}
            <div>
              <div className="relative">
                <input
                  type="email"
                  placeholder={t('email')}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailVerified(false); setEmailOtpSent(false); setEmailOtp(''); }}
                  required
                  disabled={emailVerified}
                  className={cn(INPUT_CLS, 'pr-24', emailVerified && 'border-emerald-500/50 bg-emerald-500/5')}
                />
                {emailVerified ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> {t('verified')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp('email')}
                    disabled={emailSending || emailCooldown > 0 || emailLocked || !email}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {emailSending ? (
                      <span className="animate-spin inline-block h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full" />
                    ) : emailCooldown > 0 ? (
                      t('resendIn', { seconds: emailCooldown })
                    ) : emailOtpSent ? (
                      t('resendOtp')
                    ) : (
                      t('verify')
                    )}
                  </button>
                )}
              </div>
              {emailLocked && (
                <p className="mt-1 text-xs text-destructive animate-in fade-in duration-200">{t('emailLocked')}</p>
              )}

              {/* Email OTP slide-down */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-300 ease-out',
                  emailOtpSent && !emailVerified ? 'max-h-32 opacity-100 mt-2' : 'max-h-0 opacity-0',
                )}
              >
                <p className="text-xs text-muted-foreground mb-1.5">{t('enterOtpEmail')}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('otpPlaceholder')}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
                    maxLength={6}
                    className={cn(INPUT_CLS, 'flex-1 text-center font-mono tracking-widest')}
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyOtp('email')}
                    disabled={emailVerifying || emailOtp.length < 6}
                    className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {emailVerifying ? t('verifying') : t('verifyOtp')}
                  </button>
                </div>
              </div>

              {/* Email verified badge */}
              {emailVerified && (
                <p className="mt-1 text-xs font-medium text-emerald-600 animate-in fade-in slide-in-from-top-1 duration-200">
                  {t('emailVerifiedShort')}
                </p>
              )}
            </div>

            {/* ── Phone + Verify ─────────────────────────────── */}
            <div>
              <div className="relative">
                <input
                  type="tel"
                  placeholder={t('phone')}
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneVerified(false); setPhoneOtpSent(false); setPhoneOtp(''); }}
                  required
                  disabled={phoneVerified}
                  className={cn(INPUT_CLS, 'pr-24', phoneVerified && 'border-emerald-500/50 bg-emerald-500/5')}
                />
                {phoneVerified ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> {t('verified')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendOtp('phone')}
                    disabled={phoneSending || phoneCooldown > 0 || phoneLocked || !phone}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {phoneSending ? (
                      <span className="animate-spin inline-block h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full" />
                    ) : phoneCooldown > 0 ? (
                      t('resendIn', { seconds: phoneCooldown })
                    ) : phoneOtpSent ? (
                      t('resendOtp')
                    ) : (
                      t('verify')
                    )}
                  </button>
                )}
              </div>
              {phoneLocked && (
                <p className="mt-1 text-xs text-destructive animate-in fade-in duration-200">{t('phoneLocked')}</p>
              )}

              {/* Phone OTP slide-down */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-300 ease-out',
                  phoneOtpSent && !phoneVerified ? 'max-h-32 opacity-100 mt-2' : 'max-h-0 opacity-0',
                )}
              >
                <p className="text-xs text-muted-foreground mb-1.5">{t('enterOtpPhone')}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('otpPlaceholder')}
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
                    maxLength={6}
                    className={cn(INPUT_CLS, 'flex-1 text-center font-mono tracking-widest')}
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyOtp('phone')}
                    disabled={phoneVerifying || phoneOtp.length < 6}
                    className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {phoneVerifying ? t('verifying') : t('verifyOtp')}
                  </button>
                </div>
              </div>

              {/* Phone verified badge */}
              {phoneVerified && (
                <p className="mt-1 text-xs font-medium text-emerald-600 animate-in fade-in slide-in-from-top-1 duration-200">
                  {t('phoneVerifiedShort')}
                </p>
              )}
            </div>

            {/* ── Password ───────────────────────────────────── */}
            <div>
              <input
                type="password"
                placeholder={t('password')}
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                required
                className={INPUT_CLS}
              />
              {password && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex gap-1 mb-1">
                    {['weak', 'fair', 'strong'].map((s, i) => (
                      <div
                        key={s}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-colors duration-300',
                          i < ['weak', 'fair', 'strong'].indexOf(strength) + 1 ? strengthColor : 'bg-muted',
                        )}
                      />
                    ))}
                  </div>
                  {pwErrors.length > 0 && (
                    <ul className="text-xs text-destructive space-y-0.5 mt-1">
                      {pwErrors.map((err) => <li key={err}>• {err}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* ── Confirm Password ────────────────────────────── */}
            <div
              className={cn(
                'overflow-hidden transition-all duration-300 ease-out',
                password.length > 0 ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0',
              )}
            >
              <input
                type="password"
                placeholder={t('confirmPassword')}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className={cn(INPUT_CLS, pwMismatch && 'border-destructive/50 focus:ring-destructive/40')}
              />
              {pwMismatch && (
                <p className="mt-1 text-xs text-destructive animate-in fade-in duration-200">
                  {t('passwordMismatch')}
                </p>
              )}
            </div>

            {/* ── Submit ─────────────────────────────────────── */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loading ? tc('loading') : t('register')}
            </button>
          </form>

          {/* ── Social login divider ─────────────────────────── */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative text-center text-xs text-muted-foreground bg-card px-3 w-fit mx-auto">{t('orContinueWith')}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => handleSocialLogin('google')}
              disabled={!!socialLoading}
              className="flex items-center justify-center gap-1.5 border border-border rounded-xl py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              {socialLoading === 'google' ? (
                <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              )}
              Google
            </button>
            <button
              onClick={() => handleSocialLogin('facebook')}
              disabled={!!socialLoading}
              className="flex items-center justify-center gap-1.5 border border-border rounded-xl py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              {socialLoading === 'facebook' ? (
                <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              )}
              Facebook
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t('alreadyHaveAccount')}{' '}
            <Link href={`/${locale}/auth/login`} className="text-primary font-medium hover:underline">{t('login')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
