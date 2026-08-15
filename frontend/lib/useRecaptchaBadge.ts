'use client';

import { useEffect } from 'react';
import { hideRecaptchaBadge, showRecaptchaBadge } from '@/lib/recaptcha';

/** Show Google's reCAPTCHA badge for the lifetime of the mounting page/section. */
export function useRecaptchaBadge(surface: string): void {
  useEffect(() => {
    void showRecaptchaBadge(surface);
    return () => hideRecaptchaBadge(surface);
  }, [surface]);
}
