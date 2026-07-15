import axios from 'axios';

export function isTeamsWebhookConfigured(): boolean {
  return Boolean(process.env.TEAMS_WEBHOOK_URL);
}

interface TeamsAlertOpts {
  title: string;
  text: string;
  facts?: Array<{ name: string; value: string }>;
  actionUrl?: string;
}

export async function postTeamsAlert(opts: TeamsAlertOpts): Promise<boolean> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: opts.title, weight: 'Bolder', size: 'Medium' },
            { type: 'TextBlock', text: opts.text, wrap: true },
            ...(opts.facts?.length
              ? [{
                  type: 'FactSet',
                  facts: opts.facts.map((f) => ({ title: f.name, value: f.value })),
                }]
              : []),
          ],
          actions: opts.actionUrl
            ? [{ type: 'Action.OpenUrl', title: 'Open in CRM', url: opts.actionUrl }]
            : [],
        },
      },
    ],
  };

  try {
    await axios.post(webhookUrl, card, { timeout: 10_000 });
    return true;
  } catch (err: unknown) {
    console.error('[teams] webhook failed:', (err as Error)?.message);
    return false;
  }
}

export async function alertNewOrder(orderNumber: string, total: number, customerName?: string): Promise<void> {
  const adminUrl = process.env.ADMIN_URL || 'http://localhost:5173';
  await postTeamsAlert({
    title: '🛒 New Order',
    text: `Order #${orderNumber} received`,
    facts: [
      { name: 'Customer', value: customerName || 'Guest' },
      { name: 'Total', value: `৳${Number(total).toLocaleString()}` },
    ],
    actionUrl: `${adminUrl}/?module=orders`,
  });
}

export async function alertNewTicket(ticketId: string, subject: string, priority?: string): Promise<void> {
  const adminUrl = process.env.ADMIN_URL || 'http://localhost:5173';
  await postTeamsAlert({
    title: '🎫 New Support Ticket',
    text: subject,
    facts: [
      { name: 'Ticket ID', value: ticketId },
      { name: 'Priority', value: priority || 'normal' },
    ],
    actionUrl: `${adminUrl}/?module=tickets`,
  });
}

export async function alertRefundRequest(orderNumber: string, reason?: string): Promise<void> {
  const adminUrl = process.env.ADMIN_URL || 'http://localhost:5173';
  await postTeamsAlert({
    title: '↩️ Refund / Return Request',
    text: `Return request for order #${orderNumber}`,
    facts: reason ? [{ name: 'Reason', value: reason }] : [],
    actionUrl: `${adminUrl}/?module=returns`,
  });
}

export async function alertLowStock(productTitle: string, stock: number): Promise<void> {
  const adminUrl = process.env.ADMIN_URL || 'http://localhost:5173';
  await postTeamsAlert({
    title: '⚠️ Low Stock Alert',
    text: `${productTitle} is running low`,
    facts: [{ name: 'Stock remaining', value: String(stock) }],
    actionUrl: `${adminUrl}/?module=inventory`,
  });
}
