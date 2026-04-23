'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { adminAuth } from '@/lib/adminApi';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export default function AdminLoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const setSession = useAdminAuthStore((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data } = await adminAuth.login(username, password);
      const d = data as { token: string; admin: { id: number; name: string; email: string; role: 'super_admin' | 'admin' | 'staff' } };
      setSession(d.token, d.admin);
      router.push(`/${locale}/admin`);
    } catch {
      setErr('Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-bold">Ocean Bazar Admin</h1>
        <p className="text-sm text-muted-foreground">Sign in with admin credentials</p>
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <label className="block text-sm">
          <span className="text-muted-foreground">Username</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
