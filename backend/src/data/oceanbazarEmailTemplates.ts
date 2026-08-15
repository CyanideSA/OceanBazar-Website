/**
 * Default OceanBazar transactional email bodies (inner HTML only).
 * The chrome (logo header + footer) is added by emailWrapper() at send time.
 * Placeholders use {{var}} syntax for admin EmailBuilder / renderEmailTemplate.
 */

export type OceanBazarEmailTemplateSeed = {
  category: string;
  name: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
};

const PRIMARY = '#2E7CF6';
const ACCENT = '#F06414';

export const OCEANBAZAR_EMAIL_TEMPLATES: OceanBazarEmailTemplateSeed[] = [
  {
    category: 'otp',
    name: 'OTP Verification',
    subject: 'OceanBazar verification code',
    variables: ['otp', 'purpose', 'expireMinutes'],
    bodyHtml: `
<h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Verification code</h2>
<p style="color:#6b7280;margin:0 0 24px;font-size:15px;line-height:1.55;">Use this code to complete your OceanBazar <strong style="color:#111827;">{{purpose}}</strong>.</p>
<div style="background:#f0f6ff;border:1px solid #c5dbfc;border-radius:12px;padding:22px 20px;text-align:center;margin:0 0 24px;">
  <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:${PRIMARY};font-family:'Courier New',Courier,monospace;">{{otp}}</span>
</div>
<p style="background:#fff8f3;border:1px solid #f5c9a8;border-radius:8px;padding:12px 16px;color:#9a4a0f;font-size:13px;margin:0 0 12px;line-height:1.5;">
  Expires in <strong>{{expireMinutes}} minutes</strong>. Never share this code with anyone.
</p>
<p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.5;">If you did not request this, you can ignore this email. Check your spam folder if you were expecting a code.</p>`.trim(),
  },
  {
    category: 'order_confirmation',
    name: 'Order Confirmation',
    subject: 'Order confirmed — #{{orderNumber}}',
    variables: ['orderNumber', 'total', 'itemRows', 'trackUrl'],
    bodyHtml: `
<h2 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Order confirmed</h2>
<p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Order <strong style="color:#111827;">#{{orderNumber}}</strong></p>
<p style="color:#374151;font-size:15px;margin:0 0 20px;line-height:1.55;">Thank you for shopping with OceanBazar. We have received your order and are preparing it with care.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:0 0 20px;">
  <thead><tr style="background:${PRIMARY};">
    <th style="padding:10px 14px;text-align:left;color:#fff;font-size:13px;font-weight:600;">Item</th>
    <th style="padding:10px 14px;text-align:center;color:#fff;font-size:13px;font-weight:600;">Qty</th>
    <th style="padding:10px 14px;text-align:right;color:#fff;font-size:13px;font-weight:600;">Price</th>
  </tr></thead>
  <tbody>{{itemRows}}</tbody>
  <tfoot><tr style="background:#f0f6ff;">
    <td colspan="2" style="padding:12px 14px;font-weight:700;color:#111827;">Total</td>
    <td style="padding:12px 14px;text-align:right;font-weight:800;color:${PRIMARY};font-size:18px;">৳{{total}}</td>
  </tr></tfoot>
</table>
<div style="text-align:center;margin:8px 0 0;">
  <a href="{{trackUrl}}" style="display:inline-block;padding:14px 28px;background:${PRIMARY};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Track your order</a>
</div>
<p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">Questions? Contact contact@oceanbazar.com.bd</p>`.trim(),
  },
  {
    category: 'payment_invoice',
    name: 'Payment Invoice',
    subject: 'Invoice for OceanBazar order #{{orderNumber}}',
    variables: [
      'orderNumber',
      'paymentMethod',
      'itemRows',
      'subtotal',
      'discount',
      'obDiscount',
      'shippingFee',
      'gst',
      'serviceFee',
      'total',
      'invoiceUrl',
    ],
    bodyHtml: `
<h2 style="margin:0 0 6px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Payment received</h2>
<p style="margin:0 0 22px;color:#6b7280;font-size:14px;">Invoice for order <strong style="color:#111827;">#{{orderNumber}}</strong></p>
<div style="margin-bottom:20px;padding:14px 16px;border:1px solid #c5dbfc;border-radius:10px;background:#f0f6ff;color:#1a5fd4;font-size:14px;line-height:1.5;">
  Your payment via <strong>{{paymentMethod}}</strong> was received and is under verification.
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
  <thead><tr style="background:${PRIMARY};">
    <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Product</th>
    <th style="padding:10px 12px;text-align:center;color:#fff;font-size:12px;">Qty</th>
    <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;">Unit price</th>
    <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;">Total</th>
  </tr></thead>
  <tbody>{{itemRows}}</tbody>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:13px;">
  <tr><td style="padding:4px 0;color:#6b7280;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#374151;">৳{{subtotal}}</td></tr>
  <tr><td style="padding:4px 0;color:#6b7280;">Discount</td><td style="padding:4px 0;text-align:right;color:#047857;">−৳{{discount}}</td></tr>
  <tr><td style="padding:4px 0;color:#6b7280;">OB Points</td><td style="padding:4px 0;text-align:right;color:#047857;">−৳{{obDiscount}}</td></tr>
  <tr><td style="padding:4px 0;color:#6b7280;">Shipping</td><td style="padding:4px 0;text-align:right;color:#374151;">৳{{shippingFee}}</td></tr>
  <tr><td style="padding:4px 0;color:#6b7280;">VAT</td><td style="padding:4px 0;text-align:right;color:#374151;">৳{{gst}}</td></tr>
  <tr><td style="padding:4px 0;color:#6b7280;">Service fee</td><td style="padding:4px 0;text-align:right;color:#374151;">৳{{serviceFee}}</td></tr>
  <tr><td style="padding:10px 0 0;border-top:1px solid #e5e7eb;font-weight:800;color:#111827;">Amount paid</td><td style="padding:10px 0 0;border-top:1px solid #e5e7eb;text-align:right;font-size:18px;font-weight:800;color:${PRIMARY};">৳{{total}}</td></tr>
</table>
<div style="text-align:center;margin:20px 0 0;">
  <a href="{{invoiceUrl}}" style="display:inline-block;padding:14px 28px;background:${PRIMARY};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">View or print invoice</a>
</div>
<p style="margin:10px 0 0;text-align:center;color:#9ca3af;font-size:11px;">This is a system-generated invoice and does not require a signature.</p>`.trim(),
  },
  {
    category: 'shipping_update',
    name: 'Shipping Update',
    subject: 'Order #{{orderNumber}} — {{statusLabel}}',
    variables: ['orderNumber', 'status', 'statusLabel', 'trackingNumber', 'carrier', 'trackUrl'],
    bodyHtml: `
<h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Shipping update</h2>
<div style="background:#f0f6ff;border:1px solid #c5dbfc;border-radius:12px;padding:22px 20px;text-align:center;margin:20px 0;">
  <div style="font-size:18px;font-weight:800;color:${PRIMARY};letter-spacing:-0.2px;">{{statusLabel}}</div>
  <div style="font-size:14px;color:#6b7280;margin-top:6px;">Order #{{orderNumber}}</div>
</div>
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin:16px 0;">
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Tracking · {{carrier}}</p>
  <code style="font-size:16px;font-weight:700;color:#111827;letter-spacing:1px;">{{trackingNumber}}</code>
</div>
<div style="text-align:center;">
  <a href="{{trackUrl}}" style="display:inline-block;padding:14px 28px;background:${PRIMARY};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">View order details</a>
</div>`.trim(),
  },
  {
    category: 'cart_abandonment',
    name: 'Cart Abandonment',
    subject: 'Your cart is waiting — OceanBazar',
    variables: ['userName', 'itemCount', 'cartUrl'],
    bodyHtml: `
<h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Your cart is waiting</h2>
<p style="color:#6b7280;margin:0 0 20px;font-size:15px;line-height:1.55;">Hi <strong style="color:#111827;">{{userName}}</strong>, you left <strong style="color:#111827;">{{itemCount}}</strong> item(s) in your cart. Authentic products, ready when you are.</p>
<div style="background:#fff8f3;border:1px solid #f5c9a8;border-radius:8px;padding:14px 16px;margin:0 0 24px;">
  <p style="margin:0;color:#9a4a0f;font-size:14px;line-height:1.5;">Popular items move quickly — complete your order while stock remains.</p>
</div>
<div style="text-align:center;">
  <a href="{{cartUrl}}" style="display:inline-block;padding:14px 28px;background:${ACCENT};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Return to cart</a>
</div>`.trim(),
  },
  {
    category: 'password_reset',
    name: 'Password Reset',
    subject: 'Reset your OceanBazar password',
    variables: ['resetLink'],
    bodyHtml: `
<h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Reset your password</h2>
<p style="color:#6b7280;margin:0 0 20px;font-size:15px;line-height:1.55;">We received a request to reset your OceanBazar password. Use the button below to choose a new one.</p>
<div style="text-align:center;">
  <a href="{{resetLink}}" style="display:inline-block;padding:14px 28px;background:${PRIMARY};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Reset password</a>
</div>
<p style="background:#fff8f3;border:1px solid #f5c9a8;border-radius:8px;padding:12px 16px;color:#9a4a0f;font-size:13px;margin:20px 0 0;line-height:1.5;">
  This link expires in <strong>30 minutes</strong>. If you did not request this, you can safely ignore this email.
</p>`.trim(),
  },
  {
    category: 'password_changed',
    name: 'Password Changed',
    subject: 'Your OceanBazar password was changed',
    variables: [],
    bodyHtml: `
<h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Password updated</h2>
<p style="color:#6b7280;margin:0 0 20px;font-size:15px;line-height:1.55;">Your OceanBazar account password was changed successfully.</p>
<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;color:#991b1b;font-size:13px;margin:0;line-height:1.5;">
  If you did not make this change, contact <a href="mailto:contact@oceanbazar.com.bd" style="color:${PRIMARY};text-decoration:none;">contact@oceanbazar.com.bd</a> immediately.
</p>`.trim(),
  },
  {
    category: 'welcome',
    name: 'Welcome',
    subject: 'Welcome to OceanBazar',
    variables: ['userName', 'shopUrl'],
    bodyHtml: `
<h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Welcome to OceanBazar</h2>
<p style="color:#6b7280;margin:0 0 20px;font-size:15px;line-height:1.55;">Hi <strong style="color:#111827;">{{userName}}</strong>, thank you for joining us. Discover genuine international beauty, health, and lifestyle products — sold only by OceanBazar.</p>
<div style="background:#f0f6ff;border:1px solid #c5dbfc;border-radius:10px;padding:16px 18px;margin:0 0 24px;">
  <p style="margin:0;color:#1a5fd4;font-size:14px;line-height:1.55;">Every product is sourced through verified channels. Authentic, sealed, and delivered across Bangladesh.</p>
</div>
<div style="text-align:center;">
  <a href="{{shopUrl}}" style="display:inline-block;padding:14px 28px;background:${PRIMARY};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Start shopping</a>
</div>
<p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">Need help? Write to contact@oceanbazar.com.bd</p>`.trim(),
  },
  {
    category: 'support_reply',
    name: 'Support Reply',
    subject: 'Re: {{ticketSubject}} — Ticket #{{ticketId}}',
    variables: ['ticketSubject', 'ticketId', 'replyMessage', 'ticketsUrl'],
    bodyHtml: `
<h2 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Reply from OceanBazar Support</h2>
<p style="color:#6b7280;margin:0 0 4px;font-size:14px;">Regarding ticket <strong style="color:#111827;">#{{ticketId}}</strong></p>
<p style="color:#6b7280;margin:0 0 20px;font-size:14px;">{{ticketSubject}}</p>
<div style="background:#f9fafb;border-left:4px solid ${PRIMARY};border-radius:0 8px 8px 0;padding:16px 18px;margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
  {{replyMessage}}
</div>
<div style="text-align:center;">
  <a href="{{ticketsUrl}}" style="display:inline-block;padding:14px 28px;background:${PRIMARY};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">View conversation</a>
</div>
<p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">Reply to this email or open your support center to continue.</p>`.trim(),
  },
];
