'use client';

import type { User } from '@/types';

const ACCESS_TOKEN_KEY = 'ob_access_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/** True when a JWT is present and its exp claim is still in the future. */
export function isAccessTokenValid(token: string | null = getAccessToken()): boolean {
  if (!token) return false;
  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const decoded = JSON.parse(atob(payload)) as { exp?: number };
    if (!decoded.exp) return false;
    // 30s skew so we refresh slightly before hard expiry
    return decoded.exp * 1000 > Date.now() + 30_000;
  } catch {
    return false;
  }
}

export function isAuthenticated(): boolean {
  return isAccessTokenValid();
}

export function getUserFromToken(): Partial<User> | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}
