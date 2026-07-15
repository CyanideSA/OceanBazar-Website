import { useEffect, useRef, useCallback } from "react";
import { getAdminRealtimeToken, clearAdminRealtimeTokenCache } from "../lib/realtimeAuth";

const REFRESH_BEFORE_EXPIRY_MS = 60_000; // refresh 60 s before token expires
const MIN_CHECK_INTERVAL_MS    = 5_000;

function getJwtExpMs(token) {
  try {
    const part = token?.split(".")[1];
    if (!part) return 0;
    let normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4) normalized += "=";
    const payload = JSON.parse(atob(normalized));
    const exp = Number(payload?.exp || 0);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Proactively refreshes the admin realtime token before it expires.
 * Fires `onRefreshed(newToken)` after each successful refresh.
 * Fires `onExpired()` if the token is already past its expiry.
 *
 * @param {{
 *   enabled?: boolean,
 *   onRefreshed?: (token: string) => void,
 *   onExpired?: () => void,
 * }} opts
 */
export default function useTokenAutoRefresh({ enabled = true, onRefreshed, onExpired } = {}) {
  const timerRef      = useRef(null);
  const mountedRef    = useRef(true);
  const callbacksRef  = useRef({ onRefreshed, onExpired });

  useEffect(() => {
    callbacksRef.current = { onRefreshed, onExpired };
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(async () => {
    clearTimer();
    if (!mountedRef.current) return;

    let token;
    try {
      token = await getAdminRealtimeToken();
    } catch {
      // If we can't even get a token, retry after a short delay
      timerRef.current = setTimeout(() => scheduleRefresh(), 30_000);
      return;
    }

    if (!token) return;

    const expMs = getJwtExpMs(token);
    if (!expMs) {
      // No exp claim → refresh every 12 min as a safe default
      timerRef.current = setTimeout(() => scheduleRefresh(), 12 * 60_000);
      return;
    }

    const msUntilExpiry = expMs - Date.now();

    if (msUntilExpiry <= 0) {
      // Already expired
      clearAdminRealtimeTokenCache();
      callbacksRef.current.onExpired?.();
      return;
    }

    const refreshIn = Math.max(MIN_CHECK_INTERVAL_MS, msUntilExpiry - REFRESH_BEFORE_EXPIRY_MS);

    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      clearAdminRealtimeTokenCache();
      try {
        const fresh = await getAdminRealtimeToken(true);
        if (!mountedRef.current) return;
        if (fresh) {
          callbacksRef.current.onRefreshed?.(fresh);
        } else {
          callbacksRef.current.onExpired?.();
        }
      } catch {
        callbacksRef.current.onExpired?.();
      }
      // Schedule the next check based on the new token
      scheduleRefresh();
    }, refreshIn);
  }, [clearTimer]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return undefined;
    void scheduleRefresh();
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [enabled, scheduleRefresh, clearTimer]);
}
