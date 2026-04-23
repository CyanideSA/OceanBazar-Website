'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { validatePassword, getPasswordStrength } from '@/lib/passwordRules';
import { signInWithGoogle, signInWithFacebook } from '@/lib/firebase';
import Logo from '@/components/shared/Logo';
import { loadRecaptchaScript, executeRecaptcha } from '@/lib/recaptcha';
import type { User } from '@/types';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { setUser } = useAuthStore();

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [error, setError] = useState('');
  const [pwErrors, setPwErrors] = useState<string[]>([]);

  useEffect(() => { loadRecaptchaScript(); }, []);

  const strength = getPasswordStrength(form.password);
  const strengthColor = { weak: 'bg-red-400', fair: 'bg-yellow-400', strong: 'bg-green-500' }[strength];

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (name === 'password') {
      const { errors } = validatePassword(value);
      setPwErrors(errors);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { valid, errors } = validatePassword(form.password);
    if (!valid) { setPwErrors(errors); return; }
    setLoading(true); setError('');
    try {
      const { data } = await authApi.register({ ...form, userType: 'retail' });
      const token = data.token || data.access;
      setUser(data.user as User, token);
      if (form.email && !data.user?.emailVerified) {
        router.push(`/${locale}/auth/verify-email`);
      } else {
        router.push(`/${locale}`);
      }
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? tc('error'));
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          <div className="text-center mb-8">
            <Link href={`/${locale}`} className="inline-flex items-center justify-center">
              <Logo width={180} height={54} />
            </Link>
            <p className="text-muted-foreground mt-2">{t('register')}</p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input name="name" type="text" placeholder={t('name')} value={form.name} onChange={handleChange} required
              className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground" />
            <input name="email" type="email" placeholder={t('email')} value={form.email} onChange={handleChange}
              className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground" />
            <input name="phone" type="tel" placeholder={t('phone')} value={form.phone} onChange={handleChange}
              className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground" />

            <div>
              <input name="password" type="password" placeholder={t('password')} value={form.password} onChange={handleChange} required
                className="w-full border border-border bg-background text-foreground rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground" />
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {['weak','fair','strong'].map((s, i) => (
                      <div key={s} className={`h-1.5 flex-1 rounded-full ${i < ['weak','fair','strong'].indexOf(strength) + 1 ? strengthColor : 'bg-muted'}`} />
                    ))}
                  </div>
                  {pwErrors.length > 0 && (
                    <ul className="text-xs text-destructive space-y-0.5 mt-1">
                      {pwErrors.map((e) => <li key={e}>• {e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading || pwErrors.length > 0}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all">
              {loading ? tc('loading') : t('register')}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative text-center text-xs text-muted-foreground bg-card px-3 w-fit mx-auto">{t('orContinueWith')}</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={async () => {
                setSocialLoading('google'); setError('');
                try {
                  const idToken = await signInWithGoogle();
                  const { data } = await authApi.firebaseLogin(idToken);
                  setUser(data.user as User, data.token || data.access);
                  router.push(`/${locale}`);
                } catch (e: any) {
                  if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
                    setError(e.response?.data?.error || e.response?.data?.message || tc('error'));
                  }
                } finally { setSocialLoading(null); }
              }}
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
              onClick={async () => {
                setSocialLoading('facebook'); setError('');
                try {
                  const idToken = await signInWithFacebook();
                  const { data } = await authApi.firebaseLogin(idToken);
                  setUser(data.user as User, data.token || data.access);
                  router.push(`/${locale}`);
                } catch (e: any) {
                  if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
                    setError(e.response?.data?.error || e.response?.data?.message || tc('error'));
                  }
                } finally { setSocialLoading(null); }
              }}
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
