'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/lib/api';
import type { User } from '@/types';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = params.locale as string;
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const err = searchParams.get('error');

    if (err || !token) {
      setError('Social login failed. Please try again.');
      setTimeout(() => router.replace(`/${locale}/auth/login`), 3000);
      return;
    }

    setUser({ id: '', name: '', email: null, phone: null, userType: 'retail', accountStatus: 'active', preferredLang: 'en', profileImage: null, lifetimeSpend: 0 } as User, token);

    authApi.me().then((res) => {
      const u = (res.data as { user: User }).user;
      setUser(u, token);
      router.replace(`/${locale}`);
    }).catch(() => {
      router.replace(`/${locale}`);
    });
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-destructive font-medium">{error}</p>
          <p className="mt-1 text-sm text-muted-foreground">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
