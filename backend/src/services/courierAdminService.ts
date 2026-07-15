import { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import * as courierService from './courierService';
import type { AssignCourierInput } from './courierService';
import { recordAdminAudit } from '../lib/adminAudit';

const prisma = new PrismaClient();

export async function assignCourierWithAudit(req: Request, payload: AssignCourierInput) {
  const result = await courierService.assignCourier(payload);
  if (!result.success) return result;
  await recordAdminAudit(req, {
    action: 'ASSIGN_COURIER',
    targetType: 'order',
    targetId: String(payload.orderId || ''),
    details: { courier: payload.courier, consignmentId: result.consignmentId ?? null },
  });
  return result;
}

export async function cancelCourierWithAudit(req: Request, orderId: string) {
  const result = await courierService.cancelShipment(orderId);
  if (result.success) {
    await recordAdminAudit(req, {
      action: 'CANCEL_COURIER_SHIPMENT',
      targetType: 'order',
      targetId: orderId,
      details: { message: result.message },
    });
  }
  return result;
}

export async function listCourierHealth() {
  const pending = await prisma.courier_shipments.count({ where: { internal_status: 'pending_pickup' } as any });
  const shipped = await prisma.courier_shipments.count({ where: { internal_status: 'in_transit' } as any });
  const delivered = await prisma.courier_shipments.count({ where: { internal_status: 'delivered' } as any });
  return { pending, shipped, delivered };
}

