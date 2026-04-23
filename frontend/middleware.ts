import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  const defaultLocale = request.cookies.get('NEXT_LOCALE')?.value || 'bn'; // Read from cookie or default to 'bn'
  return createMiddleware({
    locales: ['en', 'bn'],
    defaultLocale: defaultLocale as 'en' | 'bn',
    localePrefix: 'always',
  })(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
