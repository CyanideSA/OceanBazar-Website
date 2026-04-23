import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { sendCartAbandonmentReminder } from './emailService';

const prisma = new PrismaClient();

const ABANDONMENT_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // Don't re-send within 24h

/**
 * Checks for carts updated more than 30 min ago that haven't converted to orders.
 * Sends a reminder email for each.
 */
export async function checkAbandonedCarts(): Promise<number> {
  const cutoff = new Date(Date.now() - ABANDONMENT_THRESHOLD_MS);
  let sentCount = 0;

  try {
    const carts = await prisma.cart.findMany({
      where: {
        updatedAt: { lte: cutoff },
        items: { some: {} }, // has at least one item
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });

    for (const cart of carts) {
      if (!cart.user.email) continue;

      // Check if we already sent a reminder recently
      const recentReminder = await prisma.cart_abandonment_reminders.findFirst({
        where: {
          user_id: cart.userId,
          cart_id: cart.id,
          sent_at: { gte: new Date(Date.now() - REMINDER_COOLDOWN_MS) },
        },
      });
      if (recentReminder) continue;

      // Check if user placed an order after cart update
      const recentOrder = await prisma.order.findFirst({
        where: {
          userId: cart.userId,
          createdAt: { gte: cart.updatedAt },
        },
      });
      if (recentOrder) continue;

      // Send reminder
      const sent = await sendCartAbandonmentReminder(
        cart.user.email,
        cart.user.name,
        cart.items.length
      );

      if (sent) {
        await prisma.cart_abandonment_reminders.create({
          data: {
            id: uuidv4(),
            user_id: cart.userId,
            cart_id: cart.id,
            reminder_type: 'email_30min',
          },
        });
        sentCount++;
      }
    }
  } catch (err: any) {
    console.error('[cart-abandonment] Error checking carts:', err.message);
  }

  if (sentCount > 0) {
    console.log(`[cart-abandonment] Sent ${sentCount} reminder(s)`);
  }
  return sentCount;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startCartAbandonmentCron(intervalMs = 5 * 60 * 1000): void {
  if (intervalId) return;
  console.log(`[cart-abandonment] Cron started (every ${intervalMs / 1000}s)`);
  intervalId = setInterval(() => {
    checkAbandonedCarts().catch(console.error);
  }, intervalMs);
}

export function stopCartAbandonmentCron(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
