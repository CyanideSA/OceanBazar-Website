'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function VerifyEmailPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();

  const { user, setUser } = useAuthStore();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify() {
    if (!user?.email) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await authApi.verifyOtp(user.email, otp);
      const token = data.token || data.access;
      const u = data.user;
      if (u && token) {
        setUser(u, token);
      }
      setSuccess(true);
      setTimeout(() => router.push(`/${locale}`), 2000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string; message?: string } } }).response?.data?.error
        ?? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? tc('error');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    try {
      await authApi.resendVerification();
      setCooldown(60);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? tc('error');
      setError(msg);
    } finally {
      setResending(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <p className="text-muted-foreground mb-4">{t('loginRequired')}</p>
          <Link href={`/${locale}/auth/login`} className="text-primary hover:underline">{t('login')}</Link>
        </div>
      </div>
    );
  }

  if (user.emailVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h3 className="text-xl font-bold text-foreground">{t('emailAlreadyVerified')}</h3>
          <Link href={`/${locale}`} className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:brightness-110 transition-all">
            {tc('back')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-2xl font-bold text-foreground">{t('verifyEmail')}</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t('verifyEmailDesc', { email: user.email ?? '' })}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">✅</div>
              <h3 className="text-xl font-bold text-foreground">{t('emailVerified')}</h3>
              <p className="text-muted-foreground text-sm">{t('emailVerifiedDesc')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                type="text"
                placeholder={t('otpPlaceholder')}
                value={otp}
                onChange={(e) => setOtp(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={handleVerify}
                disabled={loading || otp.length !== 6}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {loading ? tc('loading') : t('verifyOtp')}
              </button>

              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                  className="text-sm text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {cooldown > 0
                    ? `${t('resendOtp')} (${cooldown}s)`
                    : resending
                    ? tc('loading')
                    : t('resendOtp')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
