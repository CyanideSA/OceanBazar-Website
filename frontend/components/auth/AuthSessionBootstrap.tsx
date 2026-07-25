'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { authApi, resolvePublicApiBase } from '@/lib/api';
import { getAccessToken, setAccessToken, isAccessTokenValid } from '@/lib/auth';
import type { User } from '@/types';

function mapMeUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    email: raw.email != null ? String(raw.email) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    userType: raw.userType === 'wholesale' ? 'wholesale' : 'retail',
    accountStatus: (raw.accountStatus as User['accountStatus']) ?? 'active',
    preferredLang: raw.preferredLang === 'bn' ? 'bn' : 'en',
    emailVerified: Boolean(raw.emailVerified),
    profileImage: raw.profileImage != null ? String(raw.profileImage) : null,
    lifetimeSpend: Number(raw.lifetimeSpend ?? 0),
  };
}

/**
 * Reconciles persisted "logged in" UI state with a real API session.
 * Without this, an expired/missing access token leaves customers looking logged
 * in while /account silently fails until they log out and back in.
 */
export default function AuthSessionBootstrap() {
  // Start false so SSR/prerender never touches zustand persist APIs.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useAuthStore.persist;
    if (!persistApi?.hasHydrated || !persistApi?.onFinishHydration) {
      setHydrated(true);
      return;
    }
    setHydrated(persistApi.hasHydrated());
    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const { isAuthenticated, logout, setUser, user } = useAuthStore.getState();
    if (!isAuthenticated) return;

    let cancelled = false;

    const restore = async () => {
      const token = getAccessToken();
      const tokenValid = isAccessTokenValid(token);

      try {
        if (!tokenValid) {
          const { data } = await axios.post(
            `${resolvePublicApiBase()}/api/auth/refresh`,
            {},
            { withCredentials: true },
          );
          if (!data?.access) throw new Error('refresh_missing_access');
          setAccessToken(data.access);
        }

        const me = await authApi.me();
        if (cancelled) return;
        const raw = (me.data as { user?: Record<string, unknown> }).user;
        const access = getAccessToken();
        if (raw && access) {
          setUser(mapMeUser(raw), access);
        }
      } catch (err) {
        if (cancelled) return;
        logout();
        await authApi.logout().catch(() => {});
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  return null;
}
