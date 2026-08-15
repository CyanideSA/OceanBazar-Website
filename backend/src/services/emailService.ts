import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
import { isConfigured as graphConfigured, sendGraphMail, defaultSender } from './microsoftGraphService';
import { logCommunication, resolveCustomerIdByEmail } from './communicationLogService';
import {
  MAIL_BRAND_LOGO_CID,
  MAIL_BRAND_LOGO_FILE,
  MAIL_BUSINESS,
  MAIL_CONTACT,
  MAIL_FROM_DEFAULT,
  MAIL_IDENTITIES,
  MAIL_NO_REPLY,
  formatMailFrom,
  resolveMailIdentity,
  type MailIdentity,
} from '../config/mailAddresses';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || MAIL_FROM_DEFAULT;

function resolveBrandLogoPath(): string | null {
  const candidates = [
    process.env.EMAIL_LOGO_PATH,
    path.join(__dirname, `../../assets/${MAIL_BRAND_LOGO_FILE}`),
    path.join(process.cwd(), `assets/${MAIL_BRAND_LOGO_FILE}`),
    path.join(process.cwd(), `../frontend/public/${MAIL_BRAND_LOGO_FILE}`),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* ignore */ }
  }
  return null;
}

function loadBrandLogoAttachment():
  | { filename: string; contentType: string; content: Buffer; cid: string; contentId: string }
  | null {
  const logoPath = resolveBrandLogoPath();
  if (!logoPath) return null;
  try {
    const content = fs.readFileSync(logoPath);
    return {
      filename: MAIL_BRAND_LOGO_FILE,
      contentType: 'image/png',
      content,
      cid: MAIL_BRAND_LOGO_CID,
      contentId: MAIL_BRAND_LOGO_CID,
    };
  } catch {
    return null;
  }
}

/** Keep brand logo CID; only swap mailbox display name / tagline for this From identity. */
function applyMailIdentityChrome(html: string, identity: MailIdentity): string {
  let out = html;
  // Force header image to brand logo (never OB theme icons in email body).
  out = out.replace(/cid:ob-mail-(system|care|business)/gi, `cid:${MAIL_BRAND_LOGO_CID}`);
  out = out.replace(/src="[^"]*ob-mail-(system|care|business)\.png[^"]*"/gi, `src="cid:${MAIL_BRAND_LOGO_CID}"`);
  out = out.replace(/cid:ob-brand-logo/gi, `cid:${MAIL_BRAND_LOGO_CID}`);
  out = out.replace(
    /data-ob-mail-tagline="1"[^>]*>[\s\S]*?<\/p>/i,
    `data-ob-mail-tagline="1" style="margin:12px 0 0;color:rgba(255,255,255,0.95);font-size:14px;font-weight:700;letter-spacing:0.2px;">${identity.displayName}</p>`,
  );
  out = out.replace(
    /data-ob-mail-subtag="1"[^>]*>[\s\S]*?<\/p>/i,
    `data-ob-mail-subtag="1" style="margin:4px 0 0;color:rgba(255,255,255,0.88);font-size:12px;letter-spacing:0.15px;">${identity.tagline}</p>`,
  );
  return out;
}

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
  const identity = resolveMailIdentity(options?.from || (graphOk ? defaultSender() : FROM));
  const fromHeader = formatMailFrom(identity);
  const brandedHtml = applyMailIdentityChrome(html, identity);
  const logo = loadBrandLogoAttachment();

  // #region agent log
  try {
    const supportMatches = Array.from(brandedHtml.matchAll(/support@oceanbazar\.[a-z.]+/gi)).map((m) => m[0]);
    const helpMatches = Array.from(brandedHtml.matchAll(/help@oceanbazar\.[a-z.]+/gi)).map((m) => m[0]);
    const wrongNoreply = Array.from(brandedHtml.matchAll(/noreply@oceanbazar\.com(?!\.bd)/gi)).map((m) => m[0]);
    const contactMatches = Array.from(brandedHtml.matchAll(/contact@oceanbazar\.com\.bd/gi)).map((m) => m[0]);
    const logoMatches = Array.from(brandedHtml.matchAll(/src=["']([^"']+)["']/gi)).map((m) => m[1]).slice(0, 5);
    const hasCid = /cid:/i.test(brandedHtml);
    const hasObThemeIcon = /ob-mail-(system|care|business)/i.test(brandedHtml);
    const hasBrandLogoCid = new RegExp(`cid:${MAIL_BRAND_LOGO_CID}`, 'i').test(brandedHtml);
    const logPath = path.resolve(__dirname, '../../../debug-1eb282.log');
    fs.appendFileSync(
      logPath,
      `${JSON.stringify({
        sessionId: '1eb282',
        runId: 'post-fix',
        hypothesisId: 'H8',
        location: 'emailService.ts:sendMail',
        message: 'outbound email brand logo header snapshot',
        data: {
          template,
          graphOk,
          smtpAvailable,
          fromOpt: options?.from || null,
          identityKey: identity.key,
          identityAddress: identity.address,
          displayName: identity.displayName,
          logoCid: MAIL_BRAND_LOGO_CID,
          logoFile: MAIL_BRAND_LOGO_FILE,
          hasLogoFile: Boolean(logo),
          hasBrandLogoCid,
          hasObThemeIcon,
          fromHeader,
          defaultFrom: FROM,
          expectedFrom: MAIL_FROM_DEFAULT,
          expectedContact: MAIL_CONTACT,
          graphDefaultSender: graphOk ? defaultSender() : null,
          supportMatches,
          helpMatches,
          wrongNoreply,
          contactMatches,
          logoMatches,
          hasCid,
          htmlLen: brandedHtml.length,
        },
        timestamp: Date.now(),
      })}\n`,
    );
  } catch { /* ignore */ }
  // #endregion

  if (devOnly || (!graphOk && !smtpAvailable)) {
    console.log(`[email] (DEV) From: ${fromHeader} To: ${to}, Subject: ${subject}`);
    await logEmail(to, subject, template, 'dev_logged', 'dev');
    return true;
  }

  // 1) Microsoft 365 Graph
  if (graphOk) {
    const result = await sendGraphMail({
      to,
      subject,
      html: brandedHtml,
      from: identity.address,
      fromName: identity.displayName,
      inlineAttachments: logo
        ? [{
            name: logo.filename,
            contentType: logo.contentType,
            contentBytes: logo.content.toString('base64'),
            contentId: logo.contentId,
          }]
        : undefined,
    });
    // #region agent log
    try {
      fs.appendFileSync(
        path.resolve(__dirname, '../../../debug-1eb282.log'),
        `${JSON.stringify({
          sessionId: '1eb282',
          runId: 'post-fix',
          hypothesisId: 'H6',
          location: 'emailService.ts:graphResult',
          message: 'graph send result with identity',
          data: {
            template,
            ok: result.ok,
            sender: result.sender,
            error: result.error || null,
            hasInlineLogo: Boolean(logo),
            fromHeader,
            identityKey: identity.key,
            contact: MAIL_CONTACT,
          },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion
    if (result.ok) {
      await logEmail(to, subject, template, 'sent', 'microsoft_graph');
      return true;
    }
    console.warn('[email] Graph send failed, falling back to SMTP:', result.error);
  }

  // 2) SMTP fallback
  if (smtpAvailable) {
    try {
      await transporter.sendMail({
        from: fromHeader,
        to,
        subject,
        html: brandedHtml,
        attachments: logo
          ? [{
              filename: logo.filename,
              content: logo.content,
              contentType: logo.contentType,
              cid: logo.cid,
            }]
          : undefined,
      });
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

const CLIENT = (process.env.CLIENT_URL || 'https://oceanbazar.com.bd').replace(/\/$/, '');
const PRIMARY = '#0B63F3';
const DARK = '#0847b0';
const ACCENT = '#F06414';
/** 50% orange left → windy mid blend → 50% blue right */
const HEADER_GRADIENT = `linear-gradient(100deg, ${ACCENT} 0%, ${ACCENT} 38%, #ff8a3d 46%, #5b9cf5 54%, ${PRIMARY} 62%, ${PRIMARY} 100%)`;

export function emailWrapper(body: string, fromOrIdentity?: string | MailIdentity): string {
  const identity =
    typeof fromOrIdentity === 'object' && fromOrIdentity
      ? fromOrIdentity
      : resolveMailIdentity(fromOrIdentity || FROM);
  const logoSrc = `cid:${MAIL_BRAND_LOGO_CID}`;
  const logoFallback = `${CLIENT}/${MAIL_BRAND_LOGO_FILE}`;
  // #region agent log
  try {
    fs.appendFileSync(
      path.resolve(__dirname, '../../../debug-1eb282.log'),
      `${JSON.stringify({
        sessionId: '1eb282',
        runId: 'post-fix',
        hypothesisId: 'H8',
        location: 'emailService.ts:emailWrapper',
        message: 'email wrapper brand logo header',
        data: {
          identityKey: identity.key,
          displayName: identity.displayName,
          logoSrc,
          logoFallback,
          usesBrandLogo: true,
          primary: PRIMARY,
          accent: ACCENT,
          headerGradient: HEADER_GRADIENT,
          footerContact: MAIL_CONTACT,
          fromDefault: FROM,
          noReply: MAIL_NO_REPLY,
          client: CLIENT,
          hasLogoFile: Boolean(resolveBrandLogoPath()),
        },
        timestamp: Date.now(),
      })}\n`,
    );
  } catch { /* ignore */ }
  // #endregion
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${identity.displayName}</title></head>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f3f6fb;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,95,212,0.08);">
      <!-- Header: orange ↔ blue windy transition + OceanBazar brand logo -->
      <tr><td style="background-color:${PRIMARY};background-image:${HEADER_GRADIENT};padding:28px 32px;text-align:center;">
        <a href="${CLIENT}" style="text-decoration:none;display:inline-block;">
          <img src="${logoSrc}" alt="OceanBazar" width="160" style="display:block;margin:0 auto;max-width:160px;height:auto;border:0;" />
        </a>
        <p data-ob-mail-tagline="1" style="margin:12px 0 0;color:rgba(255,255,255,0.95);font-size:14px;font-weight:700;letter-spacing:0.2px;">${identity.displayName}</p>
        <p data-ob-mail-subtag="1" style="margin:4px 0 0;color:rgba(255,255,255,0.88);font-size:12px;letter-spacing:0.15px;">${identity.tagline}</p>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:36px 40px;">${body}</td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafc;border-top:1px solid #e8ecef;padding:20px 40px;text-align:center;">
        <p style="margin:0;color:#6b7280;font-size:12px;">© ${new Date().getFullYear()} OceanBazar. All rights reserved.</p>
        <p style="margin:6px 0 0;color:#6b7280;font-size:12px;">
          <a href="${CLIENT}" style="color:${PRIMARY};text-decoration:none;">oceanbazar.com.bd</a> ·
          <a href="mailto:${MAIL_CONTACT}" style="color:${PRIMARY};text-decoration:none;">${MAIL_CONTACT}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function btn(href: string, label: string, accent = false): string {
  const bg = accent ? ACCENT : PRIMARY;
  return `<a href="${href}" style="display:inline-block;padding:14px 28px;background:${bg};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:16px 0;">${label}</a>`;
}

function stat(value: string, label: string): string {
  return `<td style="text-align:center;padding:12px 16px;background:#f0f6ff;border-radius:8px;">
    <div style="font-size:20px;font-weight:800;color:${PRIMARY};">${value}</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px;">${label}</div>
  </td>`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function sendOtpEmail(to: string, otp: string, type: string): Promise<boolean> {
  const isReset = type === 'forgot_password';
  const subject = isReset
    ? 'OceanBazar password reset verification code'
    : type === 'verify_email'
      ? 'OceanBazar email verification code'
      : 'OceanBazar verification code';
  const purpose = isReset
    ? 'password reset'
    : type === 'verify_email'
      ? 'email verification'
      : 'sign-in';
  const expireMinutes = process.env.OTP_EXPIRE_MINUTES || '10';
  const rendered = await renderEmailTemplate('otp', { otp, purpose, expireMinutes: String(expireMinutes) });
  if (rendered) return sendMail(to, rendered.subject || subject, rendered.html, 'otp');

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Verification code</h2>
    <p style="color:#6b7280;margin:0 0 24px;font-size:15px;line-height:1.55;">Use this code to complete your OceanBazar <strong style="color:#111827;">${purpose}</strong>.</p>
    <div style="background:#f0f6ff;border:1px solid #c5dbfc;border-radius:12px;padding:22px 20px;text-align:center;margin:0 0 24px;">
      <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:${PRIMARY};font-family:'Courier New',Courier,monospace;">${otp}</span>
    </div>
    <p style="background:#fff8f3;border:1px solid #f5c9a8;border-radius:8px;padding:12px 16px;color:#9a4a0f;font-size:13px;margin:0 0 12px;line-height:1.5;">
      Expires in <strong>${expireMinutes} minutes</strong>. Never share this code with anyone.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.5;">If you did not request this, you can ignore this email. Check your spam folder if you were expecting a code.</p>`;
  return sendMail(to, subject, emailWrapper(body), 'otp');
}

export async function sendOrderConfirmation(
  to: string,
  order: { orderNumber: string; total: number; items: { productTitle: string; quantity: number; unitPrice: number }[] }
): Promise<boolean> {
  const itemRows = order.items.map((i, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#111827;font-size:14px;">${i.productTitle}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;font-size:14px;">${i.quantity}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#111827;font-size:14px;">৳${Number(i.unitPrice).toLocaleString()}</td>
    </tr>`).join('');

  const rendered = await renderEmailTemplate('order_confirmation', {
    orderNumber: order.orderNumber,
    total: Number(order.total).toLocaleString(),
    itemRows,
    trackUrl: `${CLIENT}/en/orders`,
  });
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'order_confirmation');

  const body = `
    <h2 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Order confirmed</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Order <strong style="color:#111827;">#${order.orderNumber}</strong></p>
    <p style="color:#374151;font-size:15px;margin:0 0 20px;line-height:1.55;">Thank you for shopping with OceanBazar. We have received your order and are preparing it with care.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:0 0 20px;">
      <thead><tr style="background:${PRIMARY};">
        <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px;font-weight:600;">Item</th>
        <th style="padding:10px 14px;text-align:center;color:#fff;font-size:13px;font-weight:600;">Qty</th>
        <th style="padding:10px 14px;text-align:right;color:#fff;font-size:13px;font-weight:600;">Price</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr style="background:#f0f6ff;">
        <td colspan="2" style="padding:12px 14px;font-weight:700;color:#111827;">Total</td>
        <td style="padding:12px 14px;text-align:right;font-weight:800;color:${PRIMARY};font-size:18px;">৳${Number(order.total).toLocaleString()}</td>
      </tr></tfoot>
    </table>
    <div style="text-align:center;">${btn(`${CLIENT}/en/orders`, 'Track your order')}</div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">Questions? Contact ${MAIL_CONTACT}</p>`;
  return sendMail(to, `Order confirmed — #${order.orderNumber}`, emailWrapper(body), 'order_confirmation');
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
  const moneyPlain = (value: number) => Number(value).toLocaleString('en-BD');
  const itemRows = order.items.map((item, index) => `
    <tr style="background:${index % 2 === 0 ? '#f8fafc' : '#ffffff'};">
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:13px;">${item.productTitle}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:13px;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:13px;">${money(item.unitPrice)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#111827;font-size:13px;">${money(item.lineTotal)}</td>
    </tr>`).join('');

  const rendered = await renderEmailTemplate('payment_invoice', {
    orderNumber: order.orderNumber,
    paymentMethod: order.paymentMethod.replace(/_/g, ' '),
    itemRows,
    subtotal: moneyPlain(order.subtotal),
    discount: moneyPlain(order.discount),
    obDiscount: moneyPlain(order.obDiscount),
    shippingFee: moneyPlain(order.shippingFee),
    gst: moneyPlain(order.gst),
    serviceFee: moneyPlain(order.serviceFee),
    total: moneyPlain(order.total),
    invoiceUrl: `${CLIENT}/en/account/orders/${order.id}/invoice`,
  });
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'payment_invoice');

  const adjustment = (label: string, value: number, subtract = false) => value > 0
    ? `<tr><td style="padding:4px 0;color:#6b7280;">${label}</td><td style="padding:4px 0;text-align:right;color:${subtract ? '#047857' : '#374151'};">${subtract ? '−' : ''}${money(value)}</td></tr>`
    : '';

  const body = `
    <h2 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Payment received</h2>
    <p style="margin:0 0 22px;color:#6b7280;font-size:14px;">Invoice for order <strong style="color:#111827;">#${order.orderNumber}</strong></p>
    <div style="margin-bottom:20px;padding:14px 16px;border:1px solid #c5dbfc;border-radius:10px;background:#f0f6ff;color:${DARK};font-size:14px;line-height:1.5;">
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
  const LABELS: Record<string, { label: string; color: string }> = {
    processing:       { label: 'Being processed', color: DARK },
    shipped:          { label: 'Shipped', color: PRIMARY },
    in_transit:       { label: 'In transit', color: PRIMARY },
    out_for_delivery: { label: 'Out for delivery', color: ACCENT },
    delivered:        { label: 'Delivered', color: '#047857' },
    returned:         { label: 'Returned', color: '#dc2626' },
  };
  const s = LABELS[status] ?? { label: status.replace(/_/g, ' '), color: PRIMARY };

  const rendered = await renderEmailTemplate('shipping_update', {
    orderNumber,
    status,
    statusLabel: s.label,
    trackingNumber: trackingNumber || '—',
    carrier: carrier || 'Courier',
    trackUrl: `${CLIENT}/en/orders`,
  });
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'shipping_update');

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Shipping update</h2>
    <div style="background:#f0f6ff;border:1px solid #c5dbfc;border-radius:12px;padding:22px 20px;text-align:center;margin:20px 0;">
      <div style="font-size:18px;font-weight:800;color:${s.color};letter-spacing:-0.2px;">${s.label}</div>
      <div style="font-size:14px;color:#6b7280;margin-top:6px;">Order #${orderNumber}</div>
    </div>
    ${trackingNumber ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin:16px 0;">
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Tracking · ${carrier || 'Courier'}</p>
      <code style="font-size:16px;font-weight:700;color:#111827;letter-spacing:1px;">${trackingNumber}</code>
    </div>` : ''}
    <div style="text-align:center;">${btn(`${CLIENT}/en/orders`, 'View order details')}</div>`;
  return sendMail(to, `Order #${orderNumber} — ${s.label}`, emailWrapper(body), 'shipping_update');
}

export async function sendReviewRequestEmail(
  to: string,
  orderNumber: string,
  orderId: string,
  productTitles: string[] = [],
): Promise<boolean> {
  const reviewUrl = `${CLIENT}/en/account/orders/${orderId}?survey=1`;
  const liteUrl = `${CLIENT}/lite/en/account/orders/${orderId}?survey=1`;
  const titles = productTitles.filter(Boolean).slice(0, 4);
  const rendered = await renderEmailTemplate('review_request', {
    orderNumber,
    reviewUrl,
    liteUrl,
    productList: titles.join(', '),
  });
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'review_request');

  const listHtml = titles.length
    ? `<ul style="margin:12px 0 20px;padding-left:18px;color:#374151;font-size:14px;line-height:1.6;">${titles.map((t) => `<li>${t}</li>`).join('')}</ul>`
    : '';
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">How was your order?</h2>
    <p style="color:#6b7280;margin:0 0 12px;font-size:15px;line-height:1.55;">Order <strong style="color:#111827;">#${orderNumber}</strong> is delivered. Share a short experience survey and review your products.</p>
    ${listHtml}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
      <p style="margin:0;color:#166534;font-size:14px;line-height:1.5;">Complete the survey, then leave a product review to earn <strong>5 OB Points</strong>.</p>
    </div>
    <div style="text-align:center;">${btn(reviewUrl, 'Share feedback & review', true)}</div>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center;">On a low-end phone? Use Lite: <a href="${liteUrl}" style="color:#0f766e;">${liteUrl}</a></p>`;
  return sendMail(to, `Order #${orderNumber} — review & earn 5 OB Points`, emailWrapper(body), 'review_request');
}

export async function sendCartAbandonmentReminder(to: string, userName: string, itemCount: number): Promise<boolean> {
  const rendered = await renderEmailTemplate('cart_abandonment', {
    userName,
    itemCount: String(itemCount),
    cartUrl: `${CLIENT}/en/cart`,
  });
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'cart_abandonment');

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Your cart is waiting</h2>
    <p style="color:#6b7280;margin:0 0 20px;font-size:15px;line-height:1.55;">Hi <strong style="color:#111827;">${userName}</strong>, you left <strong style="color:#111827;">${itemCount} item${itemCount > 1 ? 's' : ''}</strong> in your cart. Authentic products, ready when you are.</p>
    <div style="background:#fff8f3;border:1px solid #f5c9a8;border-radius:8px;padding:14px 16px;margin:0 0 24px;">
      <p style="margin:0;color:#9a4a0f;font-size:14px;line-height:1.5;">Popular items move quickly — complete your order while stock remains.</p>
    </div>
    <div style="text-align:center;">${btn(`${CLIENT}/en/cart`, 'Return to cart', true)}</div>`;
  return sendMail(to, 'Your cart is waiting — OceanBazar', emailWrapper(body), 'cart_abandonment');
}

export async function sendSupportReply(
  to: string,
  ticketSubject: string,
  ticketId: string,
  replyMessage: string
): Promise<boolean> {
  const rendered = await renderEmailTemplate('support_reply', {
    ticketSubject,
    ticketId,
    replyMessage,
    ticketsUrl: `${CLIENT}/en/tickets`,
  });
  const careFrom = process.env.MS_SUPPORT_SENDER || MAIL_CONTACT;
  if (rendered) {
    return sendMail(to, rendered.subject, rendered.html, 'support_reply', {
      from: careFrom,
    });
  }

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Reply from OceanBazar Customer Care</h2>
    <p style="color:#6b7280;margin:0 0 4px;font-size:14px;">Regarding ticket <strong style="color:#111827;">#${ticketId}</strong></p>
    <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">${ticketSubject}</p>
    <div style="background:#f9fafb;border-left:4px solid ${PRIMARY};border-radius:0 8px 8px 0;padding:16px 18px;margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
      ${replyMessage}
    </div>
    <div style="text-align:center;">${btn(`${CLIENT}/en/tickets`, 'View conversation')}</div>
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">Reply to this email or open your support center to continue.</p>`;
  return sendMail(
    to,
    `Re: ${ticketSubject} — Ticket #${ticketId}`,
    emailWrapper(body, MAIL_IDENTITIES.care),
    'support_reply',
    { from: careFrom }
  );
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  const rendered = await renderEmailTemplate('password_reset', { resetLink });
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'password_reset');

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Reset your password</h2>
    <p style="color:#6b7280;margin:0 0 20px;font-size:15px;line-height:1.55;">We received a request to reset your OceanBazar password. Use the button below to choose a new one.</p>
    <div style="text-align:center;">${btn(resetLink, 'Reset password')}</div>
    <p style="background:#fff8f3;border:1px solid #f5c9a8;border-radius:8px;padding:12px 16px;color:#9a4a0f;font-size:13px;margin:20px 0 0;line-height:1.5;">
      This link expires in <strong>30 minutes</strong>. If you did not request this, you can safely ignore this email.
    </p>`;
  return sendMail(to, 'Reset your OceanBazar password', emailWrapper(body), 'password_reset');
}

export async function sendPasswordChangedEmail(to: string): Promise<boolean> {
  const rendered = await renderEmailTemplate('password_changed', {});
  if (rendered) return sendMail(to, rendered.subject, rendered.html, 'password_changed');

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Password updated</h2>
    <p style="color:#6b7280;margin:0 0 20px;font-size:15px;line-height:1.55;">Your OceanBazar account password was changed successfully.</p>
    <p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;color:#991b1b;font-size:13px;margin:0;line-height:1.5;">
      If you did not make this change, contact <a href="mailto:${MAIL_CONTACT}" style="color:${PRIMARY};text-decoration:none;">${MAIL_CONTACT}</a> immediately.
    </p>`;
  return sendMail(to, 'Your OceanBazar password was changed', emailWrapper(body), 'password_changed');
}

/** First-account welcome with a curated product catalog snapshot. */
export async function sendWelcomeCatalogEmail(to: string, userName: string): Promise<boolean> {
  if (!to?.includes('@')) return false;
  const name = (userName || 'there').trim() || 'there';
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    orderBy: [{ isFeatured: 'desc' }, { isBestSeller: 'desc' }, { popularityRank: 'asc' }, { createdAt: 'desc' }],
    take: 8,
    select: {
      id: true,
      titleEn: true,
      pricing: { where: { customerType: 'retail' as any }, take: 1, select: { price: true } },
      productAssets: {
        where: { assetType: 'image' },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
        select: { url: true },
      },
    },
  });

  const cards = products
    .map((p) => {
      const img = p.productAssets[0]?.url || `${CLIENT}/ob-brand-logo.png`;
      const price = p.pricing[0]?.price != null ? `৳${Number(p.pricing[0].price).toLocaleString('en-BD')}` : '';
      const href = `${CLIENT}/en/product/${p.id}`;
      return `
        <td style="width:50%;padding:8px;vertical-align:top;">
          <a href="${href}" style="display:block;text-decoration:none;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;">
            <img src="${img}" alt="" width="240" style="display:block;width:100%;height:140px;object-fit:cover;background:#f3f4f6;" />
            <div style="padding:10px 12px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#111827;line-height:1.35;">${String(p.titleEn).slice(0, 64)}</p>
              <p style="margin:0;font-size:13px;font-weight:700;color:${PRIMARY};">${price}</p>
            </div>
          </a>
        </td>`;
    })
    .reduce((rows: string[], cell, i) => {
      if (i % 2 === 0) rows.push('<tr>' + cell);
      else rows[rows.length - 1] += cell + '</tr>';
      if (i === products.length - 1 && i % 2 === 0) rows[rows.length - 1] += '<td style="width:50%;padding:8px;"></td></tr>';
      return rows;
    }, [])
    .join('');

  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">Welcome to OceanBazar, ${name}</h2>
    <p style="color:#6b7280;margin:0 0 18px;font-size:15px;line-height:1.55;">
      Thank you for creating your account. Explore authentic international beauty, health, and lifestyle products — curated for Bangladesh.
    </p>
    <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;">Featured from our catalog</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${cards || ''}</table>
    <div style="text-align:center;margin:22px 0 8px;">
      <a href="${CLIENT}/en" style="display:inline-block;background:${PRIMARY};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">Shop OceanBazar</a>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;line-height:1.5;">Need help? Reply to this email or chat with us on the website.</p>`;

  return sendMail(to, 'Welcome to OceanBazar — start exploring', emailWrapper(body), 'welcome_catalog');
}

export async function sendNewsletterWelcomeEmail(to: string): Promise<boolean> {
  if (!to?.includes('@')) return false;
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">You&apos;re on the list</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:15px;line-height:1.55;">
      Welcome to the OceanBazar newsletter. Expect curated drops, flash sales, and authentic new arrivals — never spam.
    </p>
    <div style="text-align:center;margin:20px 0;">
      <a href="${CLIENT}/en" style="display:inline-block;background:${PRIMARY};color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">Browse the store</a>
    </div>
    <p style="margin:0;font-size:12px;color:#9ca3af;">To unsubscribe, reply with UNSUBSCRIBE.</p>`;
  return sendMail(to, 'Welcome to the OceanBazar newsletter', emailWrapper(body), 'newsletter_welcome');
}

export async function sendBusinessInquiryAlert(
  to: string,
  data: {
    fullName: string;
    email: string;
    phone?: string | null;
    businessName?: string | null;
    businessType?: string | null;
    country?: string | null;
    message: string;
    inquiryId: string;
  },
): Promise<boolean> {
  const notify = (to || MAIL_BUSINESS).trim() || MAIL_BUSINESS;
  const subject = `Business inquiry — ${data.fullName}${data.businessName ? ` (${data.businessName})` : ''}`;
  const esc = (v: string) =>
    String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const body = `
    <h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;">New business inquiry</h2>
    <p style="color:#6b7280;margin:0 0 16px;font-size:14px;">ID: ${esc(data.inquiryId)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
      <tr><td style="padding:6px 0;width:140px;color:#6b7280;">Name</td><td style="padding:6px 0;font-weight:600;">${esc(data.fullName)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;"><a href="mailto:${esc(data.email)}">${esc(data.email)}</a></td></tr>
      ${data.phone ? `<tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;">${esc(data.phone)}</td></tr>` : ''}
      ${data.businessName ? `<tr><td style="padding:6px 0;color:#6b7280;">Company</td><td style="padding:6px 0;">${esc(data.businessName)}</td></tr>` : ''}
      ${data.businessType ? `<tr><td style="padding:6px 0;color:#6b7280;">Type</td><td style="padding:6px 0;">${esc(data.businessType)}</td></tr>` : ''}
      ${data.country ? `<tr><td style="padding:6px 0;color:#6b7280;">Country</td><td style="padding:6px 0;">${esc(data.country)}</td></tr>` : ''}
    </table>
    <div style="margin-top:16px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap;line-height:1.55;">${esc(data.message)}</div>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Reply directly to the customer email above.</p>`;
  return sendMail(notify, subject, emailWrapper(body), 'business_inquiry', {
    from: formatMailFrom(MAIL_IDENTITIES.business),
  });
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
  // Seed / admin templates are body-only — wrap with branded chrome unless already a full document.
  if (!/<\s*html[\s>]/i.test(html)) {
    html = emailWrapper(html);
  }
  return { subject, html };
}

