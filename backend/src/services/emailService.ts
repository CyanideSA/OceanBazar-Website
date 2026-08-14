import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
import { isConfigured as graphConfigured, sendGraphMail, defaultSender } from './microsoftGraphService';
import { logCommunication, resolveCustomerIdByEmail } from './communicationLogService';

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

async function logEmail(
  to: string,
  subject: string,
  template: string,
  status: string,
  provider: string,
  error?: string
) {
  // Legacy per-channel log (kept for backward compatibility / existing dashboards).
  try {
    await prisma.email_logs.create({
      data: { id: uuidv4(), to_address: to, subject, template, status, error, metadata: { provider } },
    });
  } catch { /* non-fatal */ }

  // Unified communication log (new CRM intelligence layer).
  const customerId = await resolveCustomerIdByEmail(to);
  await logCommunication({
    customerId,
    channel: 'email',
    direction: 'outbound',
    subject,
    toAddress: to,
    status,
    provider,
    refType: 'email_template',
    refId: template,
    metadata: error ? { error } : undefined,
  });
}

/**
 * Sends a transactional email.
 *
 * Delivery preference:
 *   1. Microsoft 365 Graph (enterprise) when configured
 *   2. SMTP via nodemailer
 *   3. Dev terminal log (no provider configured / OTP_TERMINAL_ONLY)
 *
 * Every attempt is recorded in both `email_logs` and the unified `communication_logs`.
 */
export async function sendMail(
  to: string,
  subject: string,
  html: string,
  template: string,
  options?: { from?: string }
): Promise<boolean> {
  const devOnly = process.env.OTP_TERMINAL_ONLY === 'true';
  const smtpAvailable = Boolean(process.env.SMTP_USER?.trim());
  const graphOk = graphConfigured();

  if (devOnly || (!graphOk && !smtpAvailable)) {
    console.log(`[email] (DEV) To: ${to}, Subject: ${subject}`);
    await logEmail(to, subject, template, 'dev_logged', 'dev');
    return true;
  }

  // 1) Microsoft 365 Graph
  if (graphOk) {
    const result = await sendGraphMail({
      to,
      subject,
      html,
      from: options?.from || defaultSender(),
    });
    if (result.ok) {
      await logEmail(to, subject, template, 'sent', 'microsoft_graph');
      return true;
    }
    console.warn('[email] Graph send failed, falling back to SMTP:', result.error);
  }

  // 2) SMTP fallback
  if (smtpAvailable) {
    try {
      await transporter.sendMail({ from: options?.from || FROM, to, subject, html });
      await logEmail(to, subject, template, 'sent', 'smtp');
      return true;
    } catch (err: any) {
      console.error('[email] SMTP send failed:', err.message);
      await logEmail(to, subject, template, 'failed', 'smtp', err.message);
      return false;
    }
  }

  await logEmail(to, subject, template, 'failed', 'none', 'no_provider_available');
  return false;
}

// ─── Shared layout helpers ──────────────────────────────────────────────────

const CLIENT = process.env.CLIENT_URL || 'https://oceanbazar.com';
const PRIMARY = '#0D7377';
const DARK = '#0a5d61';

export function emailWrapper(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>OceanBazar</title></head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f9;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,${PRIMARY} 0%,${DARK} 100%);padding:28px 32px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">🌊 OceanBazar</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Bangladesh's Smart Shopping Platform</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:36px 40px;">${body}</td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafb;border-top:1px solid #e8ecef;padding:20px 40px;text-align:center;">
        <p style="margin:0;color:#6b7280;font-size:12px;">© ${new Date().getFullYear()} OceanBazar. All rights reserved.</p>
        <p style="margin:6px 0 0;color:#6b7280;font-size:12px;">
          <a href="${CLIENT}" style="color:${PRIMARY};text-decoration:none;">oceanbazar.com</a> ·
          <a href="mailto:support@oceanbazar.com" style="color:${PRIMARY};text-decoration:none;">support@oceanbazar.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:14px 28px;background:${PRIMARY};color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:16px 0;">${label}</a>`;
}

function stat(value: string, label: string): string {
  return `<td style="text-align:center;padding:12px 16px;background:#f0fafa;border-radius:8px;">
    <div style="font-size:20px;font-weight:800;color:${PRIMARY};">${value}</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px;">${label}</div>
  </td>`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function sendOtpEmail(to: string, otp: string, type: string): Promise<boolean> {
  const subject = `Your OceanBazar OTP: ${otp}`;
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Verification Code</h2>
    <p style="color:#6b7280;margin:0 0 24px;">Your ${type} code for OceanBazar:</p>
    <div style="background:linear-gradient(135deg,#f0fafa,#e8f7f7);border:2px dashed ${PRIMARY};border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
      <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:${PRIMARY};font-family:monospace;">${otp}</span>
    </div>
    <p style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;color:#92400e;font-size:13px;margin:0;">
      ⏱️ Expires in <strong>${process.env.OTP_EXPIRE_MINUTES || 10} minutes</strong>. Never share this code with anyone.
    </p>`;
  return sendMail(to, subject, emailWrapper(body), 'otp');
}

export async function sendOrderConfirmation(
  to: string,
  order: { orderNumber: string; total: number; items: { productTitle: string; quantity: number; unitPrice: number }[] }
): Promise<boolean> {
  const rendered = await renderEmailTemplate('order_confirmation', {
    orderNumber: order.orderNumber,
    total: String(order.total),
  });
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'order_confirmation');

  const itemRows = order.items.map((i, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#111827;font-size:14px;">${i.productTitle}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;font-size:14px;">${i.quantity}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#111827;font-size:14px;">৳${Number(i.unitPrice).toLocaleString()}</td>
    </tr>`).join('');

  const body = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
      <div style="width:48px;height:48px;background:#d1fae5;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;">✅</div>
      <div>
        <h2 style="margin:0;color:#111827;font-size:22px;">Order Confirmed!</h2>
        <p style="margin:2px 0 0;color:#6b7280;font-size:14px;">Order #${order.orderNumber}</p>
      </div>
    </div>
    <p style="color:#374151;font-size:15px;margin:0 0 20px;">Thank you for shopping with OceanBazar! We've received your order and it's being processed.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:0 0 20px;">
      <thead><tr style="background:${PRIMARY};">
        <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px;font-weight:600;">Item</th>
        <th style="padding:10px 14px;text-align:center;color:#fff;font-size:13px;font-weight:600;">Qty</th>
        <th style="padding:10px 14px;text-align:right;color:#fff;font-size:13px;font-weight:600;">Price</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr style="background:#f0fafa;">
        <td colspan="2" style="padding:12px 14px;font-weight:700;color:#111827;">Total</td>
        <td style="padding:12px 14px;text-align:right;font-weight:800;color:${PRIMARY};font-size:18px;">৳${Number(order.total).toLocaleString()}</td>
      </tr></tfoot>
    </table>
    <div style="text-align:center;">${btn(`${CLIENT}/en/orders`, '📦 Track Your Order')}</div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">Questions? Reply to this email or visit our support center.</p>`;
  return sendMail(to, `✅ Order Confirmed — #${order.orderNumber}`, emailWrapper(body), 'order_confirmation');
}

export async function sendPaymentInvoice(
  to: string,
  order: {
    id: string;
    orderNumber: string;
    subtotal: number;
    discount: number;
    gst: number;
    shippingFee: number;
    serviceFee: number;
    obDiscount: number;
    total: number;
    paymentMethod: string;
    items: { productTitle: string; quantity: number; unitPrice: number; lineTotal: number }[];
  },
): Promise<boolean> {
  const money = (value: number) => `৳${Number(value).toLocaleString('en-BD')}`;
  const itemRows = order.items.map((item, index) => `
    <tr style="background:${index % 2 === 0 ? '#f8fafc' : '#ffffff'};">
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;">${item.productTitle}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:13px;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:13px;">${money(item.unitPrice)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;font-size:13px;">${money(item.lineTotal)}</td>
    </tr>`).join('');
  const adjustment = (label: string, value: number, subtract = false) => value > 0
    ? `<tr><td style="padding:4px 0;color:#6b7280;">${label}</td><td style="padding:4px 0;text-align:right;color:${subtract ? '#047857' : '#374151'};">${subtract ? '−' : ''}${money(value)}</td></tr>`
    : '';

  const body = `
    <h2 style="margin:0 0 6px;color:#111827;font-size:22px;">Payment received</h2>
    <p style="margin:0 0 22px;color:#6b7280;font-size:14px;">Invoice for order <strong style="color:#111827;">#${order.orderNumber}</strong></p>
    <div style="margin-bottom:20px;padding:14px 16px;border:1px solid #a7f3d0;border-radius:10px;background:#ecfdf5;color:#065f46;font-size:14px;">
      Your payment via <strong>${order.paymentMethod.replace(/_/g, ' ')}</strong> was received and is under verification.
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <thead><tr style="background:${PRIMARY};">
        <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Product</th>
        <th style="padding:10px 12px;text-align:center;color:#fff;font-size:12px;">Qty</th>
        <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;">Unit price</th>
        <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:13px;">
      <tr><td style="padding:4px 0;color:#6b7280;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#374151;">${money(order.subtotal)}</td></tr>
      ${adjustment('Discount', order.discount, true)}
      ${adjustment('OB Points', order.obDiscount, true)}
      ${adjustment('Shipping', order.shippingFee)}
      ${adjustment('VAT', order.gst)}
      ${adjustment('Service fee', order.serviceFee)}
      <tr><td style="padding:10px 0 0;border-top:1px solid #e5e7eb;font-weight:800;color:#111827;">Amount paid</td><td style="padding:10px 0 0;border-top:1px solid #e5e7eb;text-align:right;font-size:18px;font-weight:800;color:${PRIMARY};">${money(order.total)}</td></tr>
    </table>
    <div style="text-align:center;">${btn(`${CLIENT}/en/account/orders/${order.id}/invoice`, 'View or print invoice')}</div>
    <p style="margin:10px 0 0;text-align:center;color:#9ca3af;font-size:11px;">This is a system-generated invoice and does not require a signature.</p>`;

  return sendMail(to, `Invoice for OceanBazar order #${order.orderNumber}`, emailWrapper(body), 'payment_invoice');
}

export async function sendShippingUpdate(
  to: string,
  orderNumber: string,
  status: string,
  trackingNumber?: string,
  carrier?: string
): Promise<boolean> {
  const rendered = await renderEmailTemplate('shipping_update', {
    orderNumber,
    status,
    trackingNumber: trackingNumber || '',
    carrier: carrier || '',
  });
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'shipping_update');

  const LABELS: Record<string, { label: string; emoji: string; color: string }> = {
    processing:       { label: 'Being Processed',   emoji: '⚙️',  color: '#7c3aed' },
    shipped:          { label: 'Shipped',            emoji: '🚚',  color: '#2563eb' },
    in_transit:       { label: 'In Transit',         emoji: '🗺️',  color: '#0891b2' },
    out_for_delivery: { label: 'Out for Delivery',   emoji: '🛵',  color: '#d97706' },
    delivered:        { label: 'Delivered',          emoji: '🎉',  color: '#059669' },
    returned:         { label: 'Returned',           emoji: '↩️',  color: '#dc2626' },
  };
  const s = LABELS[status] ?? { label: status, emoji: '📦', color: PRIMARY };

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Shipping Update</h2>
    <div style="background:${s.color}1a;border:2px solid ${s.color}40;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
      <div style="font-size:36px;margin-bottom:8px;">${s.emoji}</div>
      <div style="font-size:20px;font-weight:800;color:${s.color};">${s.label}</div>
      <div style="font-size:14px;color:#6b7280;margin-top:4px;">Order #${orderNumber}</div>
    </div>
    ${trackingNumber ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Tracking Number · ${carrier || 'Courier'}</p>
      <code style="font-size:16px;font-weight:700;color:#111827;letter-spacing:1px;">${trackingNumber}</code>
    </div>` : ''}
    <div style="text-align:center;">${btn(`${CLIENT}/en/orders`, 'View Order Details')}</div>`;
  return sendMail(to, `${s.emoji} Order #${orderNumber} — ${s.label}`, emailWrapper(body), 'shipping_update');
}

export async function sendReviewRequestEmail(
  to: string,
  orderNumber: string,
  orderId: string,
  productTitles: string[] = []
): Promise<boolean> {
  const rendered = await renderEmailTemplate('review_request', {
    orderNumber,
    orderId,
    products: productTitles.join(', '),
  });
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'review_request');

  const items = productTitles.filter(Boolean).slice(0, 6);
  const itemsHtml = items.length
    ? `<ul style="margin:8px 0 0;padding-left:18px;color:#374151;font-size:14px;">${items
        .map((title) => `<li style="margin:2px 0;">${title}</li>`)
        .join('')}</ul>`
    : '';

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">How was your order?</h2>
    <div style="background:${PRIMARY}1a;border:2px solid ${PRIMARY}40;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
      <div style="font-size:36px;margin-bottom:8px;">⭐</div>
      <div style="font-size:18px;font-weight:800;color:${PRIMARY};">Your order was delivered</div>
      <div style="font-size:14px;color:#6b7280;margin-top:4px;">Order #${orderNumber}</div>
    </div>
    <p style="margin:0 0 8px;color:#374151;font-size:15px;">
      We'd love to hear what you think. Your review helps other shoppers and helps us improve.
    </p>
    ${itemsHtml}
    <div style="text-align:center;margin-top:20px;">${btn(`${CLIENT}/en/orders/${orderId}`, 'Rate your order')}</div>`;
  return sendMail(to, `⭐ How was your order #${orderNumber}?`, emailWrapper(body), 'review_request');
}

export async function sendCartAbandonmentReminder(to: string, userName: string, itemCount: number): Promise<boolean> {
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Your cart misses you! 🛒</h2>
    <p style="color:#6b7280;margin:0 0 20px;">Hi <strong>${userName}</strong>, you left <strong>${itemCount} item${itemCount > 1 ? 's' : ''}</strong> in your cart. They're waiting for you!</p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;margin:0 0 24px;">
      <p style="margin:0;color:#92400e;font-size:14px;">⚡ Items may sell out — complete your order now before they're gone.</p>
    </div>
    <div style="text-align:center;">${btn(`${CLIENT}/en/cart`, '🛒 Return to My Cart')}</div>`;
  return sendMail(to, '🛒 Your cart is waiting — OceanBazar', emailWrapper(body), 'cart_abandonment');
}

export async function sendSupportReply(
  to: string,
  ticketSubject: string,
  ticketId: string,
  replyMessage: string
): Promise<boolean> {
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Reply from OceanBazar Support 💬</h2>
    <p style="color:#6b7280;margin:0 0 4px;">Regarding ticket <strong>#${ticketId}</strong></p>
    <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">${ticketSubject}</p>
    <div style="background:#f9fafb;border-left:4px solid ${PRIMARY};border-radius:8px;padding:16px 18px;margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
      ${replyMessage}
    </div>
    <div style="text-align:center;">${btn(`${CLIENT}/en/tickets`, '💬 View Conversation')}</div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">Reply to this email or open your support center to continue the conversation.</p>`;
  return sendMail(
    to,
    `💬 Re: ${ticketSubject} — Ticket #${ticketId}`,
    emailWrapper(body),
    'support_reply',
    { from: process.env.MS_SUPPORT_SENDER || undefined }
  );
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Reset Your Password 🔒</h2>
    <p style="color:#6b7280;margin:0 0 20px;">We received a request to reset your OceanBazar password. Click the button below to create a new one.</p>
    <div style="text-align:center;">${btn(resetLink, '🔒 Reset My Password')}</div>
    <p style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;color:#92400e;font-size:13px;margin:20px 0 0;">
      ⏱️ This link expires in <strong>30 minutes</strong>. If you didn't request this, you can safely ignore this email.
    </p>`;
  return sendMail(to, '🔒 Reset Your OceanBazar Password', emailWrapper(body), 'password_reset');
}

export async function sendPasswordChangedEmail(to: string): Promise<boolean> {
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Password Updated 🔒</h2>
    <p style="color:#6b7280;margin:0 0 20px;">Your OceanBazar account password was changed successfully.</p>
    <p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;color:#991b1b;font-size:13px;margin:0;">
      If you did not make this change, contact <a href="mailto:support@oceanbazar.com" style="color:${PRIMARY};">support@oceanbazar.com</a> immediately.
    </p>`;
  return sendMail(to, '🔒 Your OceanBazar password was changed', emailWrapper(body), 'password_changed');
}

/** Render a DB email template with {{var}} substitution. */
export async function renderEmailTemplate(
  templateIdOrCategory: string,
  vars: Record<string, string> = {},
): Promise<{ subject: string; html: string } | null> {
  let template = await prisma.emailTemplate.findUnique({ where: { id: templateIdOrCategory } });
  if (!template) {
    template = await prisma.emailTemplate.findFirst({
      where: { category: templateIdOrCategory },
      orderBy: { updatedAt: 'desc' },
    });
  }
  if (!template) return null;
  let subject = template.subject;
  let html = template.bodyHtml;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
    subject = subject.replace(re, v);
    html = html.replace(re, v);
  }
  return { subject, html: emailWrapper(html) };
}

