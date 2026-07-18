/**
 * Unified customer notification helper.
 * Writes in-app notification, emits Socket.io, sends templated email + SMS.
 */
import { prisma } from '../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
import { emitToUser } from '../lib/adminEvents';
import { sendMail, renderEmailTemplate, emailWrapper } from './emailService';
import { sendSms } from './smsService';

export type NotifyEvent =
  | 'payment_verification'
  | 'payment_received'
  | 'order_processing'
  | 'delivery_update'
  | 'return_initiated'
  | 'return_received'
  | 'refund_eligible'
  | 'refund_payment_info_request'
  | 'refund_completed'
  | 'order_cancelled';

const DEFAULT_COPY: Record<NotifyEvent, { title: string; sms: (vars: Record<string, string>) => string; emailSubject: (vars: Record<string, string>) => string; emailBody: (vars: Record<string, string>) => string }> = {
  payment_verification: {
    title: 'Payment under verification',
    sms: (v) => `OceanBazar: Payment for order #${v.orderNumber} is under verification. We'll notify you once confirmed.`,
    emailSubject: (v) => `Payment under verification — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Payment under verification</h2><p>We've received payment for order <strong>#${v.orderNumber}</strong>. Our team is verifying it and will update you shortly.</p>`,
  },
  payment_received: {
    title: 'Payment confirmed',
    sms: (v) => `OceanBazar: Payment confirmed for order #${v.orderNumber}. Your order is now processing.`,
    emailSubject: (v) => `Payment confirmed — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Payment confirmed</h2><p>Payment for order <strong>#${v.orderNumber}</strong> has been received. Your order is now being processed.</p>`,
  },
  order_processing: {
    title: 'Order processing',
    sms: (v) => `OceanBazar: Order #${v.orderNumber} is being prepared.`,
    emailSubject: (v) => `Order processing — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Your order is being prepared</h2><p>Order <strong>#${v.orderNumber}</strong> is now in processing. We'll update you when it ships.</p>`,
  },
  delivery_update: {
    title: 'Delivery update',
    sms: (v) => `OceanBazar: Order #${v.orderNumber} — ${v.status}${v.trackingNumber ? `. Tracking: ${v.trackingNumber}` : ''}`,
    emailSubject: (v) => `Delivery update — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Delivery update</h2><p>Order <strong>#${v.orderNumber}</strong> status: <strong>${v.status}</strong>.</p>${v.trackingNumber ? `<p>Tracking: <code>${v.trackingNumber}</code>${v.carrier ? ` (${v.carrier})` : ''}</p>` : ''}`,
  },
  return_initiated: {
    title: 'Return request started',
    sms: (v) => `OceanBazar: Return for order #${v.orderNumber} has been initiated.${v.trackingNumber ? ` Tracking: ${v.trackingNumber}` : ''}`,
    emailSubject: (v) => `Return initiated — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Return request initiated</h2><p>We've started the return process for order <strong>#${v.orderNumber}</strong>.</p>${v.trackingNumber ? `<p>Return tracking: <code>${v.trackingNumber}</code></p>` : ''}`,
  },
  return_received: {
    title: 'Return received at warehouse',
    sms: (v) => `OceanBazar: Your return for order #${v.orderNumber} has been received and is under review.`,
    emailSubject: (v) => `Return received — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Return received</h2><p>We've received your return package for order <strong>#${v.orderNumber}</strong>. It is now under review.</p>`,
  },
  refund_eligible: {
    title: 'Refund eligible — provide payment info',
    sms: (v) => `OceanBazar: Your return for #${v.orderNumber} is eligible for refund. Please submit your payment receiving details in your Orders section.`,
    emailSubject: (v) => `Refund eligible — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Refund eligible</h2><p>Your return for order <strong>#${v.orderNumber}</strong> has been approved for refund. Please open your Orders section and submit how you'd like to receive the money.</p>`,
  },
  refund_payment_info_request: {
    title: 'Please submit refund account details',
    sms: (v) => `OceanBazar: Please submit your refund payment details for order #${v.orderNumber} in your account Orders section.`,
    emailSubject: (v) => `Submit refund details — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Submit refund payment details</h2><p>Please provide your preferred payment receiving account for the refund on order <strong>#${v.orderNumber}</strong>.</p>`,
  },
  refund_completed: {
    title: 'Refund completed',
    sms: (v) => `OceanBazar: Refund of ৳${v.amount || ''} for order #${v.orderNumber} has been processed.${v.reference ? ` Ref: ${v.reference}` : ''}`,
    emailSubject: (v) => `Refund completed — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Refund completed</h2><p>We've processed a refund of <strong>৳${v.amount || ''}</strong> for order <strong>#${v.orderNumber}</strong>.</p>${v.method ? `<p>Method: ${v.method}</p>` : ''}${v.reference ? `<p>Reference: ${v.reference}</p>` : ''}${v.notes ? `<p>${v.notes}</p>` : ''}`,
  },
  order_cancelled: {
    title: 'Order cancelled',
    sms: (v) => `OceanBazar: Order #${v.orderNumber} has been cancelled.`,
    emailSubject: (v) => `Order cancelled — #${v.orderNumber}`,
    emailBody: (v) => `<h2>Order cancelled</h2><p>Order <strong>#${v.orderNumber}</strong> has been cancelled.${v.notes ? ` ${v.notes}` : ''}</p>`,
  },
};

export interface NotifyOptions {
  userId: string;
  event: NotifyEvent;
  vars?: Record<string, string>;
  entityId?: string;
  kind?: string;
  skipEmail?: boolean;
  skipSms?: boolean;
  skipInApp?: boolean;
}

export async function notifyCustomer(opts: NotifyOptions): Promise<void> {
  const vars = opts.vars || {};
  const copy = DEFAULT_COPY[opts.event];
  if (!copy) return;

  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, email: true, phone: true, name: true },
  });
  if (!user) return;

  const title = copy.title;
  const message = copy.sms(vars);

  // In-app notification + socket
  if (!opts.skipInApp) {
    try {
      const notification = await prisma.notifications.create({
        data: {
          id: uuidv4(),
          title,
          message,
          audience: 'user',
          user_id: user.id,
          kind: opts.kind || opts.event,
          entity_id: opts.entityId || vars.orderId || vars.orderNumber || null,
        },
      });
      emitToUser(user.id, 'notification:new', notification);
      emitToUser(user.id, 'order_update', {
        event: opts.event,
        orderId: vars.orderId,
        orderNumber: vars.orderNumber,
        status: vars.status,
        trackingNumber: vars.trackingNumber,
      });
    } catch (err) {
      console.warn('[customerNotify] in-app failed:', (err as Error)?.message);
    }
  }

  // Email (DB template preferred, inline fallback)
  if (!opts.skipEmail && user.email) {
    try {
      const rendered = await renderEmailTemplate(opts.event, {
        name: user.name || 'Customer',
        ...vars,
      });
      if (rendered) {
        await sendMail(user.email, rendered.subject, rendered.html, opts.event);
      } else {
        await sendMail(
          user.email,
          copy.emailSubject(vars),
          emailWrapper(copy.emailBody(vars)),
          opts.event,
        );
      }
    } catch (err) {
      console.warn('[customerNotify] email failed:', (err as Error)?.message);
    }
  }

  // SMS
  if (!opts.skipSms && user.phone) {
    try {
      await sendSms(user.phone, copy.sms(vars), opts.event);
    } catch (err) {
      console.warn('[customerNotify] sms failed:', (err as Error)?.message);
    }
  }
}
