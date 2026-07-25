'use client';

/**
 * Google-required reCAPTCHA branding when the floating badge may be
 * easy to miss. Shown on register / password-reset / account password UIs.
 * https://developers.google.com/recaptcha/docs/faq
 */
export default function RecaptchaLegalNotice({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-relaxed text-muted-foreground ${className}`.trim()}>
      This site is protected by reCAPTCHA and the Google{' '}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Privacy Policy
      </a>{' '}
      and{' '}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Terms of Service
      </a>{' '}
      apply.
    </p>
  );
}
