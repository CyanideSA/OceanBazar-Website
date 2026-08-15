import axios from 'axios';

export function isRecaptchaConfigured(): boolean {
  return Boolean(process.env.RECAPTCHA_PROJECT_ID && process.env.RECAPTCHA_API_KEY);
}

export async function verifyRecaptchaToken(
  token: string,
  expectedAction?: string,
): Promise<{ ok: boolean; score?: number; reason?: string; detail?: string }> {
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
    const siteKey = process.env.RECAPTCHA_SITE_KEY || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    const { data } = await axios.post(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${process.env.RECAPTCHA_PROJECT_ID}/assessments?key=${process.env.RECAPTCHA_API_KEY}`,
      {
        event: {
          token,
          siteKey,
          expectedAction: expectedAction || 'login',
        },
      },
      { timeout: 10_000 },
    );

    const valid = Boolean(data?.tokenProperties?.valid);
    const action = data?.tokenProperties?.action as string | undefined;
    const invalidReason = data?.tokenProperties?.invalidReason as string | undefined;
    const score = data?.riskAnalysis?.score as number | undefined;

    // #region agent log
    try {
      const fs = await import('fs');
      fs.appendFileSync(
        'debug-7c9155.log',
        `${JSON.stringify({
          sessionId: '7c9155',
          runId: 'recaptcha-fix',
          hypothesisId: 'H4',
          location: 'recaptchaService.ts:verify',
          message: 'assessment result',
          data: {
            valid,
            action,
            expectedAction,
            invalidReason,
            score,
            tokenLen: token.length,
            siteKeySuffix: String(siteKey || '').slice(-6),
          },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion

    if (!valid) {
      if (process.env.NODE_ENV !== 'production' && process.env.RECAPTCHA_ENFORCE !== 'true') {
        return { ok: true, score: 1, reason: 'skipped_invalid_token_dev' };
      }
      return { ok: false, reason: 'invalid_token', detail: invalidReason };
    }
    // Case-insensitive action match (Google samples often use LOGIN; we use login)
    if (expectedAction && action && action.toLowerCase() !== expectedAction.toLowerCase()) {
      return { ok: false, reason: 'action_mismatch', detail: `${action}!=${expectedAction}` };
    }
    if (score != null && score < 0.5) {
      return { ok: false, reason: 'low_score', score };
    }

    return { ok: true, score };
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: unknown }; message?: string };
    console.error('[recaptcha] verify failed:', ax?.message, ax?.response?.status, ax?.response?.data);
    // #region agent log
    try {
      const fs = await import('fs');
      fs.appendFileSync(
        'debug-7c9155.log',
        `${JSON.stringify({
          sessionId: '7c9155',
          runId: 'recaptcha-fix',
          hypothesisId: 'H4',
          location: 'recaptchaService.ts:error',
          message: 'assessment http error',
          data: {
            status: ax?.response?.status,
            msg: ax?.message,
            body: typeof ax?.response?.data === 'object' ? ax.response.data : String(ax?.response?.data || ''),
          },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion
    if (process.env.NODE_ENV !== 'production' && process.env.RECAPTCHA_ENFORCE !== 'true') {
      return { ok: true, score: 1, reason: 'skipped_verify_error_dev' };
    }
    return { ok: false, reason: 'verify_error', detail: ax?.message };
  }
}
