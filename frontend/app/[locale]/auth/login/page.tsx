'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { validatePassword } from '@/lib/passwordRules';
import { signInWithGoogle, signInWithFacebook } from '@/lib/firebase';
import Logo from '@/components/shared/Logo';
import { loadRecaptchaScript, executeRecaptcha } from '@/lib/recaptcha';
import type { User } from '@/types';

type Step = 'method' | 'otp' | 'password';
type Method = 'email' | 'phone' | 'password';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { setUser } = useAuthStore();

  const [method, setMethod] = useState<Method>('email');
  const [step, setStep] = useState<Step>('method');
  const [target, setTarget] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { loadRecaptchaScript(); }, []);

  async function handleSendOtp() {
    setLoading(true); setError('');
    try {
      await authApi.sendOtp(target, 'login');
      setStep('otp');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string; detail?: string } } };
      const msg = err.response?.data?.error?.message 
        ?? err.response?.data?.detail 
        ?? err.response?.data?.message 
        ?? (err.response?.data as any)?.error 
        ?? tc('error');
      setError(msg);
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    setLoading(true); setError('');
    try {
      const { data } = await authApi.verifyOtp(target, otp);
      const token = data.token || data.access;
      setUser(data.user as User, token);
      if (data.user && !data.user.emailVerified) {
        router.push(`/${locale}/auth/verify-email`);
      } else {
        router.push(`/${locale}`);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string; detail?: string } } };
      const msg = err.response?.data?.error?.message 
        ?? err.response?.data?.detail 
        ?? err.response?.data?.message 
        ?? (err.response?.data as any)?.error 
        ?? tc('error');
      setError(msg);
    } finally { setLoading(false); }
  }

  async function handlePasswordLogin() {
    setLoading(true); setError('');
    try {
      const recaptchaToken = await executeRecaptcha('login');
      const { data } = await authApi.login(target, password, recaptchaToken);
      const token = data.token || data.access;
      setUser(data.user as User, token);
      if (data.user && !data.user.emailVerified) {
        router.push(`/${locale}/auth/verify-email`);
      } else {
        router.push(`/${locale}`);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string; detail?: string } } };
      const msg = err.response?.data?.error?.message 
        ?? err.response?.data?.detail 
        ?? err.response?.data?.message 
        ?? (err.response?.data as any)?.error 
        ?? tc('error');
      setError(msg);
    } finally { setLoading(false); }
  }

  async function handleSocialLogin(provider: 'google' | 'facebook') {
    setSocialLoading(provider); setError('');
    try {
      const idToken = provider === 'google' ? await signInWithGoogle() : await signInWithFacebook();
      const { data } = await authApi.firebaseLogin(idToken);
      const token = data.token || data.access;
      setUser(data.user as User, token);
      router.push(`/${locale}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string; detail?: string } } };
      // Firebase popup closed by user is not a real error
      const code = (e as any)?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setSocialLoading(null);
        return;
      }
      const msg = err.response?.data?.error?.message
        ?? err.response?.data?.detail
        ?? err.response?.data?.message
        ?? (err.response?.data as any)?.error
        ?? tc('error');
      setError(msg);
    } finally { setSocialLoading(null); }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href={`/${locale}`} className="inline-flex items-center justify-center">
              <Logo width={180} height={54} />
            </Link>
            <p className="text-muted-foreground mt-2">{t('login')}</p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {step === 'method' && (
            <div className="space-y-4">
              {/* Method tabs */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['email', 'phone', 'password'] as Method[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      method === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {m === 'email' ? t('email').split(' ')[0] : m === 'phone' ? t('phone').split(' ')[0] : t('password')}
                  </button>
                ))}
              </div>

              <input
                type={method === 'email' ? 'email' : method === 'phone' ? 'tel' : 'text'}
                placeholder={method === 'password' ? `${t('email')} / ${t('phone')}` : method === 'email' ? t('email') : t('phone')}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
              />

              {method === 'password' && (
                <input
                  type="password"
                  placeholder={t('password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                />
              )}

              <button
                onClick={method === 'password' ? handlePasswordLogin : handleSendOtp}
                disabled={loading || !target}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {loading ? tc('loading') : method === 'password' ? t('login') : t('sendOtp')}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative text-center text-xs text-muted-foreground bg-card px-3 w-fit mx-auto">{t('orContinueWith')}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              <p className="text-center text-sm text-muted-foreground mt-4">
                {t('dontHaveAccount')}{' '}
                <Link href={`/${locale}/auth/register`} className="text-primary font-medium hover:underline">{t('register')}</Link>
              </p>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">{t('otpSent')}</p>
              <input
                type="text"
                placeholder={t('otpPlaceholder')}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {loading ? tc('loading') : t('verifyOtp')}
              </button>
              <button onClick={() => setStep('method')} className="w-full text-muted-foreground text-sm hover:underline">
                {tc('back')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
