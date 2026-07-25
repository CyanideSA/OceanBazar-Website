'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api';
import { validatePassword, getPasswordStrength } from '@/lib/passwordRules';
import Logo from '@/components/shared/Logo';
import { CheckCircle2, Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRecaptchaBadge } from '@/lib/useRecaptchaBadge';
import RecaptchaLegalNotice from '@/components/auth/RecaptchaLegalNotice';

type Step = 'choose' | 'target' | 'otp' | 'newpw' | 'success';
type Method = 'email' | 'phone';

const INPUT_CLS =
  'w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  useRecaptchaBadge('forgot-password');

  const [step, setStep] = useState<Step>('choose');
  const [method, setMethod] = useState<Method>('email');
  const [target, setTarget] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pwErrors, setPwErrors] = useState<string[]>([]);

  const strength = getPasswordStrength(newPassword);
  const strengthColor = { weak: 'bg-red-400', fair: 'bg-yellow-400', strong: 'bg-green-500' }[strength];
  const pwMismatch = confirmPw.length > 0 && newPassword !== confirmPw;

  // Auto-redirect after success
  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => router.push(`/${locale}/auth/login`), 3000);
      return () => clearTimeout(timer);
    }
  }, [step, locale, router]);

  async function handleSend() {
    if (!target) { setError(method === 'email' ? t('emailRequired') : t('phoneRequired')); return; }
    setLoading(true); setError('');
    try {
      await authApi.forgotPassword(target);
      setStep('otp');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.error || err.response?.data?.message || tc('error'));
    } finally { setLoading(false); }
  }

  async function handleVerifyAndProceed() {
    if (otp.length < 6) return;
    setStep('newpw');
  }

  async function handleReset() {
    const { valid, errors } = validatePassword(newPassword);
    if (!valid) { setPwErrors(errors); return; }
    if (newPassword !== confirmPw) { setError(t('passwordMismatch')); return; }

    setLoading(true); setError('');
    try {
      await authApi.resetPassword(target, otp, newPassword);
      setStep('success');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } } };
      setError(err.response?.data?.error || err.response?.data?.message || tc('error'));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <Link href={`/${locale}`} className="inline-flex items-center justify-center">
              <Logo width={182} height={76} priority interaction="brand" />
            </Link>
            <h2 className="text-xl font-bold text-foreground mt-4">{t('forgotPasswordTitle')}</h2>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {error}
            </div>
          )}

          {/* Step 1: Choose method */}
          {step === 'choose' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-sm text-muted-foreground text-center">{t('forgotPasswordChoose')}</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setMethod('email'); setStep('target'); setError(''); }}
                  className="flex flex-col items-center gap-2 border border-border rounded-xl py-5 text-sm font-medium text-foreground hover:bg-accent hover:border-primary/30 transition-all"
                >
                  <Mail className="h-6 w-6 text-primary" />
                  {t('viaEmail')}
                </button>
                <button
                  onClick={() => { setMethod('phone'); setStep('target'); setError(''); }}
                  className="flex flex-col items-center gap-2 border border-border rounded-xl py-5 text-sm font-medium text-foreground hover:bg-accent hover:border-primary/30 transition-all"
                >
                  <Phone className="h-6 w-6 text-primary" />
                  {t('viaPhone')}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Enter target */}
          {step === 'target' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-sm text-muted-foreground">{t('forgotPasswordDesc')}</p>
              <input
                type={method === 'email' ? 'email' : 'tel'}
                placeholder={method === 'email' ? t('email') : t('phone')}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                autoFocus
                className={INPUT_CLS}
              />
              <button
                onClick={handleSend}
                disabled={loading || !target}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {loading ? tc('loading') : t('sendOtp')}
              </button>
              <RecaptchaLegalNotice />
              <button
                onClick={() => { setStep('choose'); setTarget(''); setError(''); }}
                className="w-full text-muted-foreground text-sm hover:underline"
              >
                {tc('back')}
              </button>
            </div>
          )}

          {/* Step 3: Enter OTP */}
          {step === 'otp' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-sm text-muted-foreground text-center">
                {method === 'email' ? t('enterOtpEmail') : t('enterOtpPhone')}
              </p>
              <input
                type="text"
                placeholder={t('otpPlaceholder')}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
                maxLength={6}
                autoFocus
                className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={handleVerifyAndProceed}
                disabled={otp.length < 6}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {t('verifyOtp')}
              </button>
              <button
                onClick={() => { setStep('target'); setOtp(''); setError(''); }}
                className="w-full text-muted-foreground text-sm hover:underline"
              >
                {tc('back')}
              </button>
            </div>
          )}

          {/* Step 4: New password */}
          {step === 'newpw' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-sm text-muted-foreground">{t('enterNewPassword')}</p>

              <div>
                <input
                  type="password"
                  placeholder={t('newPassword')}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    const { errors } = validatePassword(e.target.value);
                    setPwErrors(errors);
                  }}
                  autoFocus
                  className={INPUT_CLS}
                />
                {newPassword && (
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

              {/* Confirm password slide-in */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-300 ease-out',
                  newPassword.length > 0 ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0',
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

              <button
                onClick={handleReset}
                disabled={loading || pwErrors.length > 0 || !newPassword || newPassword !== confirmPw}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {loading ? tc('loading') : t('resetPassword')}
              </button>
              <RecaptchaLegalNotice />
              <button
                onClick={() => { setStep('otp'); setNewPassword(''); setConfirmPw(''); setPwErrors([]); setError(''); }}
                className="w-full text-muted-foreground text-sm hover:underline"
              >
                {tc('back')}
              </button>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground">{t('passwordResetSuccess')}</h3>
              <p className="text-muted-foreground text-sm">{t('resetSuccess')}</p>
              <Link
                href={`/${locale}/auth/login`}
                className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:brightness-110 transition-all"
              >
                {t('login')}
              </Link>
            </div>
          )}

          {/* Back to login — only on 'choose' step (other steps have their own Back button) */}
          {step === 'choose' && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              <Link href={`/${locale}/auth/login`} className="text-primary hover:underline">{tc('back')}</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
