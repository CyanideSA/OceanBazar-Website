import { prisma } from '../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
import { logCommunication } from './communicationLogService';
import {
  sendOrderConfirmationWhatsApp as sendWaOrderConfirm,
  sendShippingUpdateWhatsApp as sendWaShipping,
  sendWhatsAppText,
  sendWhatsAppOtp,
  isWhatsAppConfigured,
} from './meta/whatsappClient';

function isTwilioConfigured(channel: 'sms' | 'whatsapp' = 'sms'): boolean {
  const fromNumber = channel === 'whatsapp'
    ? (process.env.TWILIO_WHATSAPP_FROM || process.env.TWILIO_FROM_NUMBER)
    : process.env.TWILIO_FROM_NUMBER;

  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') &&
    process.env.TWILIO_AUTH_TOKEN &&
    fromNumber,
  );
}

async function logSms(to: string, messageType: string, status: string, channel = 'sms', error?: string) {
  try {
    await prisma.sms_logs.create({
      data: { id: uuidv4(), to_phone: to, message_type: messageType, channel, status, error },
    });
  } catch { /* non-fatal */ }

  try {
    await logCommunication({
      channel: channel === 'whatsapp' ? 'whatsapp' : 'sms',
      direction: 'outbound',
      toAddress: to,
      body: messageType,
      status,
      provider: channel === 'whatsapp' ? 'meta_whatsapp' : 'twilio',
      metadata: error ? { error } : undefined,
    });
  } catch { /* non-fatal */ }
}

async function sendViaTwilio(to: string, body: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = channel === 'whatsapp'
    ? (process.env.TWILIO_WHATSAPP_FROM || `whatsapp:${process.env.TWILIO_FROM_NUMBER}`)
    : process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber || !accountSid.startsWith('AC')) {
    return false;
  }

  const toFormatted = channel === 'whatsapp' ? `whatsapp:${to}` : to;

  try {
    const { default: axios } = await import('axios');
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({ To: toFormatted, From: fromNumber, Body: body }),
      { auth: { username: accountSid, password: authToken } },
    );
    return true;
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: unknown }; message?: string })?.response?.data || (err as Error)?.message;
    console.error(`[${channel}] Twilio error:`, msg);
    return false;
  }
}

async function sendMessage(
  to: string,
  body: string,
  messageType: string,
  channel: 'sms' | 'whatsapp' = 'sms',
): Promise<boolean> {
  if (process.env.OTP_TERMINAL_ONLY === 'true') {
    console.log(`[${channel}] (DEV) To: ${to}, Type: ${messageType}, Body: ${body}`);
    await logSms(to, messageType, 'dev_logged', channel);
    return true;
  }

  if (channel === 'whatsapp' && isWhatsAppConfigured()) {
    const { sendWhatsAppText } = await import('./meta/whatsappClient');
    const sent = await sendWhatsAppText(to, body);
    await logSms(to, messageType, sent ? 'sent' : 'failed', 'whatsapp', sent ? undefined : 'meta_whatsapp_error');
    if (sent) return true;
  }

  const sent = await sendViaTwilio(to, body, channel);
  await logSms(to, messageType, sent ? 'sent' : 'failed', channel, sent ? undefined : 'provider_error');
  return sent;
}

/** Generic SMS helper used by customerNotify and other lifecycle events. */
export async function sendSms(phone: string, body: string, messageType = 'notification'): Promise<boolean> {
  return sendMessage(phone, body, messageType, 'sms');
}

export async function sendOtpSms(phone: string, otp: string, type: string): Promise<boolean> {
  const body = `Your OceanBazar ${type.replace(/_/g, ' ')} code is ${otp}. It expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes. Never share this code.`;

  if (process.env.OTP_TERMINAL_ONLY === 'true') {
    return sendMessage(phone, body, 'otp', 'sms');
  }

  // Prefer Twilio SMS when configured (reliable). Meta WhatsApp is secondary.
  if (isTwilioConfigured('sms')) {
    const sent = await sendMessage(phone, body, 'otp', 'sms');
    if (sent) return true;
  }

  if (isWhatsAppConfigured()) {
    const sent = await sendWhatsAppOtp(phone, otp, type);
    await logSms(
      phone,
      'otp',
      sent ? 'sent' : 'failed',
      'whatsapp',
      sent ? undefined : 'meta_whatsapp_error',
    );
    if (sent) return true;

    // Meta token often returns 190 — fall back to Twilio WhatsApp/SMS if available.
    if (isTwilioConfigured('whatsapp') || isTwilioConfigured('sms')) {
      const viaTwilio = await sendViaTwilio(phone, body, isTwilioConfigured('sms') ? 'sms' : 'whatsapp');
      await logSms(phone, 'otp', viaTwilio ? 'sent' : 'failed', 'sms', viaTwilio ? undefined : 'twilio_fallback_failed');
      if (viaTwilio) return true;
    }
  }

  // Dev: OTP already printed to BFF console in authService — don't hard-fail UX.
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[otp] Phone delivery failed for ${phone}; OTP is available in BFF terminal logs`);
    await logSms(phone, 'otp', 'dev_terminal_fallback', 'sms', 'provider_failed_dev_ok');
    return true;
  }

  console.error('[otp] No SMS or WhatsApp provider is configured');
  await logSms(phone, 'otp', 'failed', 'sms', 'provider_not_configured');
  return false;
}

export async function sendPasswordChangedSms(phone: string): Promise<boolean> {
  return sendMessage(
    phone,
    'Oceanbazar: Your account password was changed. If this was not you, contact support immediately.',
    'password_changed',
    'sms',
  );
}

export async function sendOrderConfirmationSms(phone: string, orderNumber: string): Promise<boolean> {
  return sendMessage(phone, `Oceanbazar: Order #${orderNumber} confirmed! Track at oceanbazar.com/orders`, 'order_confirmation', 'sms');
}

export async function sendOrderConfirmationWhatsApp(
  phone: string,
  orderNumber: string,
  total: number,
  _items: { productTitle: string; quantity: number }[] = [],
): Promise<boolean> {
  if (process.env.OTP_TERMINAL_ONLY === 'true') {
    console.log(`[whatsapp] (DEV) Order confirm ${orderNumber} to ${phone}`);
    await logSms(phone, 'order_confirmation_wa', 'dev_logged', 'whatsapp');
    return true;
  }
  if (isWhatsAppConfigured()) {
    const sent = await sendWaOrderConfirm(phone, orderNumber, total);
    await logSms(phone, 'order_confirmation_wa', sent ? 'sent' : 'failed', 'whatsapp');
    return sent;
  }
  const itemLines = _items.slice(0, 3).map((i) => `  • ${i.productTitle} × ${i.quantity}`).join('\n');
  const body = `🛍️ *OceanBazar Order Confirmed!*\n\nOrder #${orderNumber}\n${itemLines}\n\n💰 Total: ৳${Number(total).toLocaleString()}\n\nTrack: oceanbazar.com/orders`;
  return sendMessage(phone, body, 'order_confirmation_wa', 'whatsapp');
}

export async function sendShippingUpdateWhatsApp(
  phone: string,
  orderNumber: string,
  status: string,
  trackingNumber?: string,
): Promise<boolean> {
  if (process.env.OTP_TERMINAL_ONLY === 'true') {
    await logSms(phone, 'shipping_update_wa', 'dev_logged', 'whatsapp');
    return true;
  }
  if (isWhatsAppConfigured()) {
    const sent = await sendWaShipping(phone, orderNumber, status, trackingNumber);
    await logSms(phone, 'shipping_update_wa', sent ? 'sent' : 'failed', 'whatsapp');
    return sent;
  }
  const body = `📦 OceanBazar: Order #${orderNumber} — ${status}.${trackingNumber ? ` Tracking: ${trackingNumber}` : ''}`;
  return sendMessage(phone, body, 'shipping_update_wa', 'whatsapp');
}

export async function sendShippingUpdateSms(
  phone: string,
  orderNumber: string,
  status: string,
  trackingNumber?: string,
): Promise<boolean> {
  const statusText: Record<string, string> = {
    processing: 'is being processed',
    shipped: 'has been shipped',
    in_transit: 'is in transit',
    out_for_delivery: 'is out for delivery',
    delivered: 'has been delivered',
  };
  const msg = `Oceanbazar: Order #${orderNumber} ${statusText[status] || `status: ${status}`}.${trackingNumber ? ` Track: ${trackingNumber}` : ''}`;
  return sendMessage(phone, msg, 'shipping_update', 'sms');
}
