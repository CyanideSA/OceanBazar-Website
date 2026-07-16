import axios from 'axios';

const GRAPH = 'https://graph.facebook.com/v19.0';

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    (process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN),
  );
}

function accessToken(): string | undefined {
  return process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
}

function phoneNumberId(): string | undefined {
  return process.env.WHATSAPP_PHONE_NUMBER_ID;
}

/**
 * WhatsApp Cloud API expects digits only (country code + national number).
 * Preserve real international numbers; only default to BD (+880) when no country code is present.
 */
export function toWhatsAppRecipient(to: string): string {
  const trimmed = to.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  if (hasPlus) return digits;

  // Already looks like BD international without +: 8801XXXXXXXXX
  if (digits.startsWith('880') && digits.length >= 13) return digits;

  // Other common country codes already present (e.g. AU 61…, US/CA 1…, IN 91…)
  if (/^(61|91|1|44|971|966|65|60|62|66)\d{8,}$/.test(digits)) return digits;

  // Local BD mobile: 01XXXXXXXXX → 8801XXXXXXXXX
  if (digits.startsWith('0')) return `880${digits.slice(1)}`;

  // Bare national BD mobile without leading 0
  if (digits.length === 10 || digits.length === 11) return `880${digits.replace(/^0/, '')}`;

  return digits;
}

function dbg(hypothesisId: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch(process.env.DEBUG_INGEST_URL || 'http://host.docker.internal:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'a8d503' },
    body: JSON.stringify({
      sessionId: 'a8d503',
      runId: process.env.DEBUG_RUN_ID || 'pre-fix',
      hypothesisId,
      location: 'whatsappClient.ts',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

export async function sendWhatsAppText(to: string, text: string): Promise<boolean> {
  const token = accessToken();
  const pnId = phoneNumberId();
  if (!token || !pnId) {
    dbg('A', 'whatsapp_skip_unconfigured', { hasToken: !!token, hasPhoneId: !!pnId });
    return false;
  }

  const toWa = toWhatsAppRecipient(to);
  dbg('B', 'whatsapp_recipient_normalized', {
    inputLen: to.length,
    inputHasPlus: to.trim().startsWith('+'),
    toWaPrefix: toWa.slice(0, 4),
    toWaLen: toWa.length,
  });

  try {
    await axios.post(
      `${GRAPH}/${pnId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toWa,
        type: 'text',
        text: { preview_url: false, body: text.slice(0, 4096) },
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
    );
    dbg('A', 'whatsapp_text_ok', { toWaPrefix: toWa.slice(0, 4) });
    return true;
  } catch (err: unknown) {
    const data = (err as { response?: { data?: { error?: { code?: number; message?: string; error_subcode?: number; type?: string } } } })?.response?.data;
    const code = data?.error?.code;
    const sub = data?.error?.error_subcode;
    const msg = data?.error?.message || (err as Error)?.message;
    console.error('[whatsapp] send text failed:', {
      code,
      subcode: sub,
      type: data?.error?.type,
      message: msg,
      hint:
        code === 190
          ? 'WHATSAPP_ACCESS_TOKEN is invalid/expired — generate a new token in Meta Developer Console'
          : code === 131047
            ? 'Outside 24h window — use an approved WhatsApp template for OTPs'
            : undefined,
    });
    dbg('A', 'whatsapp_text_failed', { code, sub, message: String(msg || '').slice(0, 120) });
    return false;
  }
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode = 'en',
  components?: unknown[],
): Promise<boolean> {
  const token = accessToken();
  const pnId = phoneNumberId();
  if (!token || !pnId || !templateName) return false;

  const toWa = toWhatsAppRecipient(to);

  try {
    await axios.post(
      `${GRAPH}/${pnId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: toWa,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: components || [],
        },
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
    );
    return true;
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: unknown }; message?: string })?.response?.data || (err as Error)?.message;
    console.error('[whatsapp] send template failed:', msg);
    dbg('C', 'whatsapp_template_failed', { templateName });
    return false;
  }
}

/** Prefer authentication/utility OTP template when configured; else free-form text. */
export async function sendWhatsAppOtp(phone: string, otp: string, type: string): Promise<boolean> {
  const template = process.env.WHATSAPP_TEMPLATE_OTP;
  const lang = process.env.WHATSAPP_TEMPLATE_OTP_LANG || 'en';
  if (template) {
    const sent = await sendWhatsAppTemplate(phone, template, lang, [
      {
        type: 'body',
        parameters: [{ type: 'text', text: otp }],
      },
    ]);
    if (sent) return true;
    // Fall through to text if template fails (e.g. misconfigured components)
  }
  const body = `Your OceanBazar ${type.replace(/_/g, ' ')} code is ${otp}. It expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes. Never share this code.`;
  return sendWhatsAppText(phone, body);
}

export async function sendOrderConfirmationWhatsApp(
  phone: string,
  orderNumber: string,
  total: number,
): Promise<boolean> {
  const template = process.env.WHATSAPP_TEMPLATE_ORDER;
  if (template) {
    return sendWhatsAppTemplate(phone, template, 'en', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: orderNumber },
          { type: 'text', text: `৳${Number(total).toLocaleString()}` },
        ],
      },
    ]);
  }
  return sendWhatsAppText(
    phone,
    `🛍️ OceanBazar: Order #${orderNumber} confirmed! Total: ৳${Number(total).toLocaleString()}. Track at oceanbazar.com/orders`,
  );
}

export async function sendShippingUpdateWhatsApp(
  phone: string,
  orderNumber: string,
  status: string,
  trackingNumber?: string,
): Promise<boolean> {
  const template = process.env.WHATSAPP_TEMPLATE_SHIPPING;
  if (template) {
    return sendWhatsAppTemplate(phone, template, 'en', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: orderNumber },
          { type: 'text', text: status },
          { type: 'text', text: trackingNumber || 'N/A' },
        ],
      },
    ]);
  }
  const trackingLine = trackingNumber ? ` Tracking: ${trackingNumber}` : '';
  return sendWhatsAppText(phone, `📦 OceanBazar: Order #${orderNumber} — ${status}.${trackingLine}`);
}
