'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  X, Mail, Phone, Lock, ArrowRight, Loader2, ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type Step = 'method' | 'otp';
type Method = 'email' | 'phone' | 'password';

const METHOD_ICONS = { email: Mail, phone: Phone, password: Lock } as const;

export default function LoginDialog() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const { setUser } = useAuthStore();
  const { loginDialogOpen, setLoginDialogOpen } = useUIStore();

  const [method, setMethod] = useState<Method>('email');
  const [step, setStep] = useState<Step>('method');
  const [target, setTarget] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (loginDialogOpen) {
      setMethod('email');
      setStep('method');
      setTarget('');
      setOtp('');
      setPassword('');
      setError('');
    }
  }, [loginDialogOpen]);

  // Lock body scroll
  useEffect(() => {
    if (loginDialogOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [loginDialogOpen]);

  function extractError(e: unknown) {
    const err = e as { response?: { data?: { error?: { message?: string }; message?: string; detail?: string } } };
    return err.response?.data?.error?.message
      ?? err.response?.data?.detail
      ?? err.response?.data?.message
      ?? (err.response?.data as any)?.error
      ?? tc('error');
  }

  function onSuccess(data: { user: User; token?: string; access?: string }) {
    const token = data.token || data.access || '';
    setUser(data.user, token);
    setLoginDialogOpen(false);
    if (data.user && !(data.user as any).emailVerified) {
      router.push(`/${locale}/auth/verify-email`);
    }
  }

  async function handleSendOtp() {
    setLoading(true); setError('');
    try {
      await authApi.sendOtp(target, 'login');
      setStep('otp');
    } catch (e) { setError(extractError(e)); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    setLoading(true); setError('');
    try {
      const { data } = await authApi.verifyOtp(target, otp);
      onSuccess(data);
    } catch (e) { setError(extractError(e)); }
    finally { setLoading(false); }
  }

  async function handlePasswordLogin() {
    setLoading(true); setError('');
    try {
      const { data } = await authApi.login(target, password);
      onSuccess(data);
    } catch (e) { setError(extractError(e)); }
    finally { setLoading(false); }
  }

  if (!loginDialogOpen) return null;

  return (
    <AnimatePresence>
      {loginDialogOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            onClick={() => setLoginDialogOpen(false)}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setLoginDialogOpen(false)}
              className="absolute right-3 top-3 z-20 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header with gradient accent */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary/90 to-primary px-6 pb-6 pt-8 text-center text-primary-foreground">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-white/5 blur-xl" />
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-bold tracking-tight">
                  <span className="opacity-90">Ocean</span>Bazar
                </h2>
                <p className="mt-1 text-xs font-medium opacity-75">{t('login')}</p>
              </motion.div>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Error */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {step === 'method' && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  {/* Method tabs */}
                  <div className="flex overflow-hidden rounded-xl border border-border">
                    {(['email', 'phone', 'password'] as Method[]).map((m) => {
                      const Icon = METHOD_ICONS[m];
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMethod(m)}
                          className={cn(
                            'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all',
                            method === m
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {m === 'email' ? t('email').split(' ')[0] : m === 'phone' ? t('phone').split(' ')[0] : t('password')}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type={method === 'email' ? 'email' : method === 'phone' ? 'tel' : 'text'}
                    placeholder={method === 'password' ? `${t('email')} / ${t('phone')}` : method === 'email' ? t('email') : t('phone')}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />

                  {method === 'password' && (
                    <motion.input
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      type="password"
                      placeholder={t('password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  )}

                  <button
                    type="button"
                    onClick={method === 'password' ? handlePasswordLogin : handleSendOtp}
                    disabled={loading || !target}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:brightness-110 disabled:opacity-50 active:scale-[0.98]"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {loading ? tc('loading') : method === 'password' ? t('login') : t('sendOtp')}
                  </button>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                    <div className="relative mx-auto w-fit bg-card px-3 text-[11px] font-medium text-muted-foreground">{t('orContinueWith')}</div>
                  </div>

                  {/* Social login */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <a
                      href={`${BACKEND_URL}/api/auth/social/google`}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Google
                    </a>
                    <a
                      href={`${BACKEND_URL}/api/auth/social/facebook`}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      Facebook
                    </a>
                  </div>

                  {/* Register link */}
                  <p className="text-center text-xs text-muted-foreground">
                    {t('dontHaveAccount')}{' '}
                    <Link
                      href={`/${locale}/auth/register`}
                      onClick={() => setLoginDialogOpen(false)}
                      className="font-semibold text-primary hover:underline"
                    >
                      {t('register')}
                    </Link>
                  </p>
                </motion.div>
              )}

              {step === 'otp' && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <p className="text-center text-sm text-muted-foreground">{t('otpSent')}</p>
                  <input
                    type="text"
                    placeholder={t('otpPlaceholder')}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-2xl font-mono tracking-widest text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length !== 6}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-soft transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? tc('loading') : t('verifyOtp')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('method')}
                    className="w-full text-center text-sm text-muted-foreground hover:underline"
                  >
                    {tc('back')}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
