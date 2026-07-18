import { prisma } from '../lib/prisma';

import type { GoogleIdTokenClaims } from './googleSsoService';
import type { MicrosoftIdTokenClaims } from './microsoftSsoService';


type AdminRow = {
  id: number;
  role: string;
  email: string;
  active: boolean;
};

export async function findAdminForMicrosoftClaims(
  claims: MicrosoftIdTokenClaims,
): Promise<AdminRow | null> {
  const email = (claims.email || claims.preferred_username || claims.upn || '').toLowerCase();

  let admin = await prisma.adminUser.findFirst({
    where: { microsoftOid: claims.oid, active: true },
    select: { id: true, role: true, email: true, active: true },
  });
  if (admin) return admin;

  if (email) {
    admin = await prisma.adminUser.findFirst({
      where: { email, active: true },
      select: { id: true, role: true, email: true, active: true },
    });
    if (admin) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { microsoftOid: claims.oid, authProvider: 'microsoft' },
      });
      return admin;
    }
  }

  return null;
}

export async function findAdminForGoogleClaims(
  claims: GoogleIdTokenClaims,
): Promise<AdminRow | null> {
  const email = (claims.email || '').toLowerCase();

  let admin = await prisma.adminUser.findFirst({
    where: { googleSub: claims.sub, active: true },
    select: { id: true, role: true, email: true, active: true },
  });
  if (admin) return admin;

  if (email) {
    admin = await prisma.adminUser.findFirst({
      where: { email, active: true },
      select: { id: true, role: true, email: true, active: true },
    });
    if (admin) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { googleSub: claims.sub, authProvider: 'google' },
      });
      return admin;
    }
  }

  return null;
}
