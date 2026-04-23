import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || 'Oceanbazar <noreply@oceanbazar.com>';

async function logEmail(to: string, subject: string, template: string, status: string, error?: string) {
  try {
    await prisma.email_logs.create({
      data: { id: uuidv4(), to_address: to, subject, template, status, error },
    });
  } catch { /* non-fatal */ }
}

async function sendMail(to: string, subject: string, html: string, template: string): Promise<boolean> {
  if (process.env.OTP_TERMINAL_ONLY === 'true' || !process.env.SMTP_USER) {
    console.log(`[email] (DEV) To: ${to}, Subject: ${subject}`);
    await logEmail(to, subject, template, 'dev_logged');
    return true;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    await logEmail(to, subject, template, 'sent');
    return true;
  } catch (err: any) {
    console.error('[email] Send failed:', err.message);
    await logEmail(to, subject, template, 'failed', err.message);
    return false;
  }
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function sendOtpEmail(to: string, otp: string, type: string): Promise<boolean> {
  const subject = `Your Oceanbazar OTP Code: ${otp}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#0D7377;">Oceanbazar</h2>
      <p>Your verification code for <strong>${type}</strong> is:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f3f4f6;border-radius:8px;margin:16px 0;">${otp}</div>
      <p style="color:#6b7280;font-size:13px;">This code expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes. Do not share it with anyone.</p>
    </div>
  `;
  return sendMail(to, subject, html, 'otp');
}

export async function sendOrderConfirmation(
  to: string,
  order: { orderNumber: string; total: number; items: { productTitle: string; quantity: number; unitPrice: number }[] }
): Promise<boolean> {
  const itemRows = order.items.map(i =>
    `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${i.productTitle}</td>
     <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${i.quantity}</td>
     <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">৳${Number(i.unitPrice).toFixed(2)}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#0D7377;">Order Confirmed!</h2>
      <p>Thank you for your order <strong>#${order.orderNumber}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:8px;text-align:left;">Item</th>
          <th style="padding:8px;text-align:center;">Qty</th>
          <th style="padding:8px;text-align:right;">Price</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="text-align:right;font-size:18px;font-weight:bold;">Total: ৳${Number(order.total).toFixed(2)}</p>
      <p style="color:#6b7280;font-size:13px;">You can track your order at oceanbazar.com</p>
    </div>
  `;
  return sendMail(to, `Order Confirmed - #${order.orderNumber}`, html, 'order_confirmation');
}

export async function sendShippingUpdate(
  to: string,
  orderNumber: string,
  status: string,
  trackingNumber?: string,
  carrier?: string
): Promise<boolean> {
  const statusLabel: Record<string, string> = {
    processing: 'Being Processed',
    shipped: 'Shipped',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    returned: 'Returned',
  };
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#0D7377;">Shipping Update</h2>
      <p>Your order <strong>#${orderNumber}</strong> is now: <strong>${statusLabel[status] || status}</strong></p>
      ${trackingNumber ? `<p>Tracking: <code>${trackingNumber}</code> via ${carrier || 'courier'}</p>` : ''}
      <p style="color:#6b7280;font-size:13px;">Track your delivery at oceanbazar.com/orders</p>
    </div>
  `;
  return sendMail(to, `Order #${orderNumber} - ${statusLabel[status] || status}`, html, 'shipping_update');
}

export async function sendCartAbandonmentReminder(
  to: string,
  userName: string,
  itemCount: number
): Promise<boolean> {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#0D7377;">You left something behind!</h2>
      <p>Hi ${userName}, you have <strong>${itemCount} item${itemCount > 1 ? 's' : ''}</strong> waiting in your cart.</p>
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/cart" 
         style="display:inline-block;margin:16px 0;padding:12px 24px;background:#0D7377;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
        Complete Your Order
      </a>
      <p style="color:#6b7280;font-size:13px;">Don't miss out on great deals!</p>
    </div>
  `;
  return sendMail(to, 'Your cart is waiting!', html, 'cart_abandonment');
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="color:#0D7377;">Reset Your Password</h2>
      <p>Click below to reset your Oceanbazar password:</p>
      <a href="${resetLink}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#0D7377;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
        Reset Password
      </a>
      <p style="color:#6b7280;font-size:13px;">This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
    </div>
  `;
  return sendMail(to, 'Reset Your Oceanbazar Password', html, 'password_reset');
}
