import { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function trackAdminSession(adminId: number, req: Request): Promise<void> {
  const ua = req.headers['user-agent']?.slice(0, 512);
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || undefined;
  const deviceId = crypto
    .createHash('sha256')
    .update(`${ua ?? ''}|${ip ?? ''}`)
    .digest('hex')
    .slice(0, 32);

  await prisma.adminSession.upsert({
    where: { adminId_deviceId: { adminId, deviceId } },
    create: { adminId, deviceId, userAgent: ua, ipAddress: ip },
    update: { lastSeenAt: new Date(), userAgent: ua, ipAddress: ip },
  });
}

export async function revokeAdminDevice(adminId: number, deviceId: string): Promise<void> {
  await prisma.adminSession.updateMany({
    where: { adminId, deviceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
