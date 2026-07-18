import axios from 'axios';

export function isRecaptchaConfigured(): boolean {
  return Boolean(process.env.RECAPTCHA_PROJECT_ID && process.env.RECAPTCHA_API_KEY);
}

export async function verifyRecaptchaToken(
  token: string,
  expectedAction?: string,
): Promise<{ ok: boolean; score?: number; reason?: string }> {
  // Check configuration first — missing browser tokens must not block local/dev
  // when Enterprise keys are absent.
  if (!isRecaptchaConfigured()) {
    if (process.env.NODE_ENV === 'production' || process.env.RECAPTCHA_ENFORCE === 'true') {
      return { ok: false, reason: 'not_configured' };
    }
    return { ok: true, score: 1, reason: 'skipped_unconfigured' };
  }

  if (!token) {
    if (process.env.NODE_ENV === 'production' || process.env.RECAPTCHA_ENFORCE === 'true') {
      return { ok: false, reason: 'missing_token' };
    }
    return { ok: true, score: 1, reason: 'skipped_missing_token_dev' };
  }

  try {
    const { data } = await axios.post(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${process.env.RECAPTCHA_PROJECT_ID}/assessments?key=${process.env.RECAPTCHA_API_KEY}`,
      {
        event: {
          token,
          siteKey: process.env.RECAPTCHA_SITE_KEY || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
          expectedAction: expectedAction || 'login',
        },
      },
      { timeout: 10_000 },
    );

    const valid = Boolean(data?.tokenProperties?.valid);
    const action = data?.tokenProperties?.action;
    const score = data?.riskAnalysis?.score as number | undefined;

    if (!valid) {
      if (process.env.NODE_ENV !== 'production' && process.env.RECAPTCHA_ENFORCE !== 'true') {
        return { ok: true, score: 1, reason: 'skipped_invalid_token_dev' };
      }
      return { ok: false, reason: 'invalid_token' };
    }
    if (expectedAction && action && action !== expectedAction) {
      return { ok: false, reason: 'action_mismatch' };
    }
    if (score != null && score < 0.5) {
      return { ok: false, reason: 'low_score', score };
    }

    return { ok: true, score };
  } catch (err: unknown) {
    console.error('[recaptcha] verify failed:', (err as Error)?.message);
    if (process.env.NODE_ENV !== 'production' && process.env.RECAPTCHA_ENFORCE !== 'true') {
      return { ok: true, score: 1, reason: 'skipped_verify_error_dev' };
    }
    return { ok: false, reason: 'verify_error' };
  }
}
