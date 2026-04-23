import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function ensureCustomerForUser(userId: string): Promise<void> {
  await prisma.customer.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}
