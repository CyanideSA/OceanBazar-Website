import { PrismaClient } from '@prisma/client';

/**
 * Process-wide Prisma singleton.
 * Instantiating PrismaClient in every route/service file opens a separate
 * connection pool each — under storefront + admin load that exhausts
 * Postgres (P2037: too many clients already).
 */
const globalForPrisma = globalThis as unknown as { __obPrisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.__obPrisma ?? createClient();

if (!globalForPrisma.__obPrisma) {
  globalForPrisma.__obPrisma = prisma;
}

export default prisma;
