import { prisma } from '../lib/prisma';



export async function ensureCustomerForUser(userId: string): Promise<void> {
  await prisma.customer.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}
