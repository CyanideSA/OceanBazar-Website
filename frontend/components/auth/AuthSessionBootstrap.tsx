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
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    setHydrated(useAuthStore.persist.hasHydrated());
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const { isAuthenticated, logout, setUser, user } = useAuthStore.getState();
    if (!isAuthenticated) return;

    let cancelled = false;

    const restore = async () => {
      const token = getAccessToken();
      const tokenValid = isAccessTokenValid(token);
      // #region agent log
      fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'session-fix',hypothesisId:'S1',location:'AuthSessionBootstrap.tsx:restore-start',message:'Reconciling persisted auth session',data:{hasToken:Boolean(token),tokenValid,hasUser:Boolean(user)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      try {
        if (!tokenValid) {
          const { data } = await axios.post(
            `${resolvePublicApiBase()}/api/auth/refresh`,
            {},
            { withCredentials: true },
          );
          if (!data?.access) throw new Error('refresh_missing_access');
          setAccessToken(data.access);
          // #region agent log
          fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'session-fix',hypothesisId:'S1',location:'AuthSessionBootstrap.tsx:refresh-ok',message:'Silent refresh restored access token',data:{},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
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
        // #region agent log
        fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'session-fix',hypothesisId:'S1,S2',location:'AuthSessionBootstrap.tsx:restore-fail',message:'Session restore failed — clearing zombie auth',data:{status:(err as {response?:{status?:number}})?.response?.status??null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
