import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function logSms(to: string, messageType: string, status: string, error?: string) {
  try {
    await prisma.sms_logs.create({
      data: { id: uuidv4(), to_phone: to, message_type: messageType, status, error },
    });
  } catch { /* non-fatal */ }
}

async function sendSmsViaTwilio(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber || accountSid.startsWith('AC') === false) {
    return false; // Twilio not configured
  }

  try {
    const { default: axios } = await import('axios');
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({ To: to, From: fromNumber, Body: body }),
      { auth: { username: accountSid, password: authToken } }
    );
    return true;
  } catch (err: any) {
    console.error('[sms] Twilio error:', err.response?.data || err.message);
    return false;
  }
}

async function sendSms(to: string, body: string, messageType: string): Promise<boolean> {
  if (process.env.OTP_TERMINAL_ONLY === 'true') {
    console.log(`[sms] (DEV) To: ${to}, Type: ${messageType}, Body: ${body}`);
    await logSms(to, messageType, 'dev_logged');
    return true;
  }

  const sent = await sendSmsViaTwilio(to, body);
  await logSms(to, messageType, sent ? 'sent' : 'failed', sent ? undefined : 'provider_error');
  return sent;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function sendOtpSms(phone: string, otp: string, type: string): Promise<boolean> {
  return sendSms(phone, `Your Oceanbazar ${type} code: ${otp}. Valid for ${process.env.OTP_EXPIRE_MINUTES || 10} min.`, 'otp');
}

export async function sendOrderConfirmationSms(phone: string, orderNumber: string): Promise<boolean> {
  return sendSms(phone, `Oceanbazar: Order #${orderNumber} confirmed! Track at oceanbazar.com/orders`, 'order_confirmation');
}

export async function sendShippingUpdateSms(
  phone: string,
  orderNumber: string,
  status: string,
  trackingNumber?: string
): Promise<boolean> {
  const statusText: Record<string, string> = {
    processing: 'is being processed',
    shipped: 'has been shipped',
    in_transit: 'is in transit',
    out_for_delivery: 'is out for delivery',
    delivered: 'has been delivered',
  };
  const msg = `Oceanbazar: Order #${orderNumber} ${statusText[status] || `status: ${status}`}.${trackingNumber ? ` Track: ${trackingNumber}` : ''}`;
  return sendSms(phone, msg, 'shipping_update');
}
