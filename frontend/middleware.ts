import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import {
  getMaintenanceBypassToken,
  isMaintenanceModeEnabled,
  maintenanceCookieDomainForRequest,
  maintenanceRetryAfterSeconds,
  MAINTENANCE_BYPASS_COOKIE,
} from '@/lib/maintenance';

const locales = ['en', 'bn'] as const;

function pickLocale(request: NextRequest, pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg && locales.includes(seg as (typeof locales)[number])) return seg;
  return request.cookies.get('NEXT_LOCALE')?.value || 'en';
}

function isMaintenancePagePath(pathname: string): boolean {
  return /^\/(en|bn)\/maintenance(\/.*)?$/.test(pathname);
}

function isStaticAsset(pathname: string): boolean {
  return /\.[a-z0-9]+$/i.test(pathname);
}

function hasValidBypass(request: NextRequest): boolean {
  const token = getMaintenanceBypassToken();
  if (!token) return false;
  const q = request.nextUrl.searchParams.get('bypass');
  if (q === token) return true;
  const h = request.headers.get('x-maintenance-bypass');
  if (h === token) return true;
  const cookie = request.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value;
  return cookie === token;
}

function applyMaintenanceHeaders(res: NextResponse): NextResponse {
  res.headers.set('Retry-After', maintenanceRetryAfterSeconds());
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.headers.set('X-Maintenance-Mode', '1');
  return res;
}

function setBypassCookie(response: NextResponse, token: string, host: string | null): void {
  const isProd = process.env.NODE_ENV === 'production';
  const domain = maintenanceCookieDomainForRequest(host);
  response.cookies.set(MAINTENANCE_BYPASS_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14, // 14 days
    ...(domain ? { domain } : {}),
  });
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const maintenanceOn = isMaintenanceModeEnabled();
  const bypassToken = getMaintenanceBypassToken();
  const bypassQuery = bypassToken && request.nextUrl.searchParams.get('bypass') === bypassToken;

  // Staff unlock: ?bypass=SECRET → secure cookie → redirect to clean URL
  if (maintenanceOn && bypassQuery && bypassToken) {
    const locale = pickLocale(request, pathname);
    const clean = request.nextUrl.clone();
    clean.searchParams.delete('bypass');
    if (!isMaintenancePagePath(pathname) && !pathname.startsWith(`/${locale}`)) {
      clean.pathname = `/${locale}`;
    }
    const res = NextResponse.redirect(clean);
    setBypassCookie(res, bypassToken, request.headers.get('host'));
    return res;
  }

  const adminCrmUrl =
    process.env.NEXT_PUBLIC_ADMIN_CRM_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5173';
  if (/^\/(en|bn)\/admin(\/.*)?$/.test(pathname)) {
    const dest = new URL(adminCrmUrl);
    const sub = pathname.replace(/^\/(en|bn)\/admin/, '') || '/';
    dest.pathname = sub.startsWith('/') ? sub : `/${sub}`;
    return NextResponse.redirect(dest);
  }

  if (maintenanceOn && !isStaticAsset(pathname)) {
    const allowedThrough = hasValidBypass(request);

    if (!allowedThrough && !isMaintenancePagePath(pathname)) {
      const locale = pickLocale(request, pathname);
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/maintenance`;
      url.search = '';
      return applyMaintenanceHeaders(NextResponse.rewrite(url, { status: 503 }));
    }

    if (isMaintenancePagePath(pathname)) {
      return applyMaintenanceHeaders(NextResponse.next({ status: 503 }));
    }
  }

  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  const defaultLocale =
    cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])
      ? cookieLocale
      : 'en';
  return createMiddleware({
    locales: [...locales],
    defaultLocale: defaultLocale as 'en' | 'bn',
    localePrefix: 'always',
    // Prefer English for first-time visitors; do not follow Accept-Language automatically.
    localeDetection: false,
  })(request);
}

export const config = {
  // Skip static files in /public (logos, banners, favicons) — otherwise i18n rewrites them to 404 HTML
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
