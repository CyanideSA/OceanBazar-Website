'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { getVisitorId } from '@/lib/visitorId';

/**
 * On login, move any active guest chat onto the authenticated account once.
 */
export default function ChatVisitorClaim() {
  const { isAuthenticated, user } = useAuthStore();
  const claimedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (typeof window !== 'undefined' && !localStorage.getItem('ob_access_token')) return;
    if (claimedFor.current === user.id) return;
    claimedFor.current = user.id;

    const visitorId = getVisitorId();
    if (!visitorId) return;
    api.post('/chat/claim-visitor', { visitorId }).catch(() => {
      /* non-fatal — widget/page can retry later */
    });
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) claimedFor.current = null;
  }, [isAuthenticated]);

  return null;
}
