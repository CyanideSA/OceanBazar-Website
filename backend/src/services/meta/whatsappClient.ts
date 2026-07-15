import axios from 'axios';

const GRAPH = 'https://graph.facebook.com/v19.0';

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_ACCESS_TOKEN) &&
    (process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN),
  );
}

function accessToken(): string | undefined {
  return process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
}

function phoneNumberId(): string | undefined {
  return process.env.WHATSAPP_PHONE_NUMBER_ID;
}

export async function sendWhatsAppText(to: string, text: string): Promise<boolean> {
  const token = accessToken();
  const pnId = phoneNumberId();
  if (!token || !pnId) return false;

  const normalized = to.replace(/\D/g, '');
  const toWa = normalized.startsWith('880') ? normalized : `880${normalized.replace(/^0/, '')}`;

  try {
    await axios.post(
      `${GRAPH}/${pnId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toWa,
        type: 'text',
        text: { preview_url: true, body: text.slice(0, 4096) },
      },
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15_000 },
    );
    return true;
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: unknown }; message?: string })?.response?.data || (err as Error)?.message;
    console.error('[whatsapp] send text failed:', msg);
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

  const normalized = to.replace(/\D/g, '');
  const toWa = normalized.startsWith('880') ? normalized : `880${normalized.replace(/^0/, '')}`;

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
    return false;
  }
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
