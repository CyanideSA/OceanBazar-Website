'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api';
import { validatePassword } from '@/lib/passwordRules';

type Step = 'request' | 'verify' | 'success';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const params = useParams();
  const locale = params.locale as string;

  const [step, setStep] = useState<Step>('request');
  const [target, setTarget] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    setLoading(true); setError('');
    try {
      await authApi.forgotPassword(target);
      setStep('verify');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? tc('error'));
    } finally { setLoading(false); }
  }

  async function handleReset() {
    const { valid, errors } = validatePassword(newPassword);
    if (!valid) { setError(errors.join('. ')); return; }
    setLoading(true); setError('');
    try {
      await authApi.resetPassword(target, otp, newPassword);
      setStep('success');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? tc('error'));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground">{t('forgotPassword')}</h2>
          </div>

          {error && <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

          {step === 'request' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('forgotPasswordDesc')}</p>
              <input type="text" placeholder={`${t('email')} / ${t('phone')}`} value={target} onChange={(e) => setTarget(e.target.value)}
                className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground" />
              <button onClick={handleSend} disabled={loading || !target}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all">
                {loading ? tc('loading') : t('sendOtp')}
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">{t('otpSent')}</p>
              <input type="text" placeholder={t('otpPlaceholder')} value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6}
                className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <input type="password" placeholder={t('newPassword')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t('passwordRules')}</p>
              <button onClick={handleReset} disabled={loading || otp.length !== 6 || !newPassword}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all">
                {loading ? tc('loading') : t('resetPassword')}
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">✅</div>
              <h3 className="text-xl font-bold text-foreground">{t('passwordResetSuccess')}</h3>
              <p className="text-muted-foreground text-sm">{t('passwordResetSuccessDesc')}</p>
              <Link href={`/${locale}/auth/login`} className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:brightness-110 transition-all">
                {t('login')}
              </Link>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link href={`/${locale}/auth/login`} className="text-primary hover:underline">{tc('back')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
