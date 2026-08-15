import { prisma } from '../lib/prisma';

import { v4 as uuidv4 } from 'uuid';
import * as paperflyService from './paperflyService';
import * as pathaoService from './pathaoService';
import * as steadfastService from './steadfastService';
import * as redxService from './redxService';

export type CourierProvider = 'paperfly' | 'pathao' | 'steadfast' | 'redx';

export interface AssignCourierInput {
  orderId: string;
  courier: CourierProvider;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity?: string;
  recipientZone?: string;
  recipientArea?: string;
  codAmount: number;
  weight?: number;
  note?: string;
  // Pathao-specific
  pathaoStoreId?: number;
  pathaoCityId?: number;
  pathaoZoneId?: number;
  pathaoAreaId?: number;
  pathaoDeliveryType?: number;
  pathaoItemType?: number;
  // Paperfly-specific
  pickMerchantName?: string;
  pickMerchantAddress?: string;
  pickMerchantThana?: string;
  pickMerchantDistrict?: string;
  pickphnNumber?: string;
  customerThana?: string;
  customerDistrict?: string;
  // RedX-specific
  redxDeliveryAreaId?: number;
  redxDeliveryArea?: string;
  redxPickupStoreId?: number;
  redxParcelValue?: number;
}

export interface AssignCourierResult {
  success: boolean;
  courierShipmentId?: string;
  consignmentId?: string;
  trackingCode?: string;
  deliveryFee?: number;
  message?: string;
}

export async function assignCourier(input: AssignCourierInput): Promise<AssignCourierResult> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: true, user: true },
  });
  if (!order) return { success: false, message: 'Order not found' };

  const shipmentId = uuidv4();
  let consignmentId: string | undefined;
  let trackingCode: string | undefined;
  let deliveryFee: number | undefined;
  let courierResponse: any;

  try {
    switch (input.courier) {
      case 'paperfly': {
        const result = await paperflyService.createOrder({
          merchantOrderReference: order.orderNumber,
          storeName: input.pickMerchantName || process.env.STORE_NAME || 'Oceanbazar',
          productBrief: order.items.map(i => i.productTitle).join(', ').slice(0, 200),
          packagePrice: String(input.codAmount),
          max_weight: input.weight ? String(input.weight) : '0.5',
          customerName: input.recipientName,
          customerAddress: input.recipientAddress,
          customerPhone: input.recipientPhone,
        });
        if (!result.success) return { success: false, message: result.message };
        consignmentId = result.trackingNumber;
        trackingCode = result.trackingBarcode || result.trackingNumber;
        courierResponse = result.raw;
        break;
      }

      case 'pathao': {
        // #region agent log
        const _dbgIn = { sessionId: '7c9155', runId: 'pathao-book', hypothesisId: 'B', location: 'courierService.ts:pathao-branch', message: 'pathao assign input', data: { orderId: input.orderId, store: input.pathaoStoreId || null, city: input.pathaoCityId || null, zone: input.pathaoZoneId || null, area: input.pathaoAreaId || null, envStore: Number(process.env.PATHAO_STORE_ID) || 0 }, timestamp: Date.now() };
        console.log('DBG7c9155', JSON.stringify(_dbgIn));
        fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7c9155' }, body: JSON.stringify(_dbgIn) }).catch(() => {});
        // #endregion
        if (!input.pathaoCityId || !input.pathaoZoneId) {
          return {
            success: false,
            message: 'Pathao requires recipient City and Zone. Select them in the booking form.',
          };
        }
        let storeId = input.pathaoStoreId || Number(process.env.PATHAO_STORE_ID) || 0;
        if (!storeId) {
          try {
            storeId = await pathaoService.getDefaultStoreId();
          } catch (e: any) {
            return { success: false, message: e?.message || 'Pathao store is not configured' };
          }
        }
        const result = await pathaoService.createOrder({
          store_id: storeId,
          merchant_order_id: order.orderNumber,
          recipient_name: input.recipientName,
          recipient_phone: input.recipientPhone,
          recipient_address: input.recipientAddress,
          recipient_city: input.pathaoCityId,
          recipient_zone: input.pathaoZoneId,
          recipient_area: input.pathaoAreaId,
          delivery_type: input.pathaoDeliveryType || 48,
          item_type: input.pathaoItemType || 2,
          special_instruction: input.note,
          item_quantity: order.items.reduce((s, i) => s + i.quantity, 0),
          item_weight: input.weight || 0.5,
          amount_to_collect: input.codAmount,
          item_description: order.items.map(i => i.productTitle).join(', ').slice(0, 200),
        });
        if (!result.success) return { success: false, message: result.message };
        consignmentId = result.consignment_id;
        trackingCode = result.consignment_id;
        deliveryFee = result.delivery_fee;
        courierResponse = result.raw;
        break;
      }

      case 'steadfast': {
        const result = await steadfastService.createOrder({
          invoice: order.orderNumber,
          recipient_name: input.recipientName,
          recipient_phone: input.recipientPhone,
          recipient_address: input.recipientAddress,
          cod_amount: input.codAmount,
          note: input.note,
        });
        if (!result.success) return { success: false, message: result.message };
        consignmentId = result.consignment_id;
        trackingCode = result.tracking_code;
        deliveryFee = result.delivery_fee;
        courierResponse = result.raw;
        break;
      }

      case 'redx': {
        const result = await redxService.createParcel({
          customer_name: input.recipientName,
          customer_phone: input.recipientPhone,
          delivery_area: input.redxDeliveryArea || input.recipientArea || 'Dhaka',
          delivery_area_id: input.redxDeliveryAreaId || 1,
          customer_address: input.recipientAddress,
          merchant_invoice_id: order.orderNumber,
          cash_collection_amount: input.codAmount,
          parcel_weight: input.weight || 500, // grams
          instruction: input.note,
          value: input.redxParcelValue || input.codAmount,
          pickup_store_id: input.redxPickupStoreId,
        });
        if (!result.success) return { success: false, message: result.message };
        consignmentId = result.tracking_id;
        trackingCode = result.tracking_id;
        courierResponse = result.raw;
        break;
      }

      default:
        return { success: false, message: `Unsupported courier: ${input.courier}` };
    }

    // Save to courier_shipments
    await prisma.courier_shipments.create({
      data: {
        id: shipmentId,
        order_id: input.orderId,
        courier_provider: input.courier,
        consignment_id: consignmentId,
        tracking_code: trackingCode,
        courier_status: 'pending',
        internal_status: 'pending',
        delivery_fee: deliveryFee,
        cod_amount: input.codAmount,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        recipient_address: input.recipientAddress,
        recipient_city: input.recipientCity,
        recipient_zone: input.recipientZone,
        recipient_area: input.recipientArea,
        weight: input.weight,
        note: input.note,
        courier_response: courierResponse,
        webhook_events: [],
      },
    });

    // Also create/update the existing Shipment model for backward compat
    // Prefer real courier consignment/tracking; Char(16) column is legacy-limited.
    const rawTrack = String(trackingCode || consignmentId || shipmentId);
    const trackNum = rawTrack.replace(/\s+/g, '').slice(0, 16).toUpperCase().padEnd(16, '0');
    await prisma.shipment.create({
      data: {
        id: shipmentId.slice(0, 8).toUpperCase(),
        orderId: input.orderId,
        carrier: input.courier,
        trackingNumber: trackNum,
        estimatedDelivery: new Date(Date.now() + 3 * 86400_000),
        events: [
          {
            status: 'pending',
            note: `Booked with ${input.courier}`,
            consignmentId: consignmentId || null,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: input.orderId },
      data: { status: 'processing', trackingNumber: trackNum },
    });

    await prisma.orderTimeline.create({
      data: {
        orderId: input.orderId,
        status: 'processing',
        note: `Assigned to ${input.courier}. Consignment: ${consignmentId || 'pending'}`,
        actorType: 'admin',
      },
    });

    // #region agent log
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'pathao-book',hypothesisId:'C',location:'courierService.ts:assignCourier',message:'courier booked',data:{courier:input.courier,orderId:input.orderId,consignmentId:consignmentId||null,trackingCode:trackingCode||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    return {
      success: true,
      courierShipmentId: shipmentId,
      consignmentId,
      trackingCode,
      deliveryFee,
    };
  } catch (err: any) {
    console.error(`[courier] assignCourier ${input.courier} error:`, err.message);
    return { success: false, message: err.message };
  }
}

// ─── Track Shipment ──────────────────────────────────────────────────────────

export async function trackShipment(orderId: string): Promise<{
  success: boolean;
  status?: string;
  events?: any[];
  courierData?: any;
}> {
  const cs = await prisma.courier_shipments.findFirst({ where: { order_id: orderId } });
  if (!cs) return { success: false };

  try {
    switch (cs.courier_provider) {
      case 'paperfly': {
        if (!cs.consignment_id) return { success: false };
        const result = await paperflyService.trackOrder(cs.consignment_id);
        return { success: result.success, status: (result as any).status, events: (result as any).events, courierData: result.raw };
      }
      case 'pathao': {
        if (!cs.consignment_id) return { success: false };
        const info = await pathaoService.getOrderInfo(cs.consignment_id);
        const courierStatus = String(info?.order_status || '');
        const internalStatus = pathaoService.mapPathaoStatus(courierStatus || 'Pending');
        // Persist latest courier status so customer tracking stays current even without webhooks.
        const existingEvents = Array.isArray(cs.webhook_events) ? (cs.webhook_events as object[]) : [];
        await prisma.courier_shipments.update({
          where: { id: cs.id },
          data: {
            courier_status: courierStatus || cs.courier_status,
            internal_status: internalStatus,
            webhook_events: [
              ...existingEvents,
              { eventType: courierStatus || 'poll', internalStatus, timestamp: new Date().toISOString(), raw: info },
            ],
            updated_at: new Date(),
          },
        });
        const shipment = await prisma.shipment.findFirst({ where: { orderId: orderId, carrier: 'pathao' } });
        if (shipment) {
          const events = Array.isArray(shipment.events) ? (shipment.events as object[]) : [];
          const statusMap: Record<string, 'pending' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned'> = {
            pending: 'pending', picked_up: 'picked_up', in_transit: 'in_transit',
            out_for_delivery: 'out_for_delivery', delivered: 'delivered', returned: 'returned',
            on_hold: 'in_transit', partial_delivery: 'in_transit',
          };
          await prisma.shipment.update({
            where: { id: shipment.id },
            data: {
              status: statusMap[internalStatus] || 'in_transit',
              events: [...events, { status: internalStatus, courierStatus, timestamp: new Date().toISOString() }],
            },
          });
        }
        return { success: true, status: courierStatus || internalStatus, courierData: info };
      }
      case 'steadfast': {
        if (!cs.consignment_id) return { success: false };
        const info = await steadfastService.getStatusByCid(cs.consignment_id);
        return { success: true, status: info?.status || info?.delivery_status, courierData: info };
      }
      case 'redx': {
        if (!cs.consignment_id) return { success: false };
        const result = await redxService.trackParcel(cs.consignment_id);
        return { success: result.success, status: (result.tracking as any)?.status, courierData: result.tracking };
      }
      default:
        return { success: false };
    }
  } catch (err: any) {
    console.error(`[courier] trackShipment error:`, err.message);
    return { success: false };
  }
}

// ─── Cancel Shipment ─────────────────────────────────────────────────────────

export async function cancelShipment(orderId: string): Promise<{ success: boolean; message?: string }> {
  const cs = await prisma.courier_shipments.findFirst({ where: { order_id: orderId } });
  if (!cs) return { success: false, message: 'No courier shipment found' };

  try {
    let result: { success: boolean; message?: string } = { success: false };

    switch (cs.courier_provider) {
      case 'paperfly':
        if (cs.consignment_id) result = await paperflyService.cancelOrder(cs.consignment_id);
        break;
      case 'steadfast':
        // Steadfast doesn't have a direct cancel endpoint; use return
        if (cs.consignment_id) {
          const r = await steadfastService.createReturnRequest({ consignment_id: cs.consignment_id, reason: 'Order cancelled' });
          result = { success: r.success, message: r.message };
        }
        break;
      case 'pathao':
        // Pathao doesn't expose a cancel API; mark internally
        result = { success: true, message: 'Marked as cancelled (Pathao has no cancel API)' };
        break;
      case 'redx':
        // RedX doesn't expose a direct cancel API; mark internally
        result = { success: true, message: 'Marked as cancelled (RedX has no cancel API)' };
        break;
    }

    if (result.success) {
      await prisma.courier_shipments.update({
        where: { id: cs.id },
        data: { internal_status: 'cancelled', courier_status: 'cancelled', updated_at: new Date() },
      });
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });
      await prisma.orderTimeline.create({
        data: { orderId, status: 'cancelled', note: `Courier shipment cancelled (${cs.courier_provider})`, actorType: 'admin' },
      });
    }

    return result;
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ─── Delivery Price Estimate ─────────────────────────────────────────────────

export async function getDeliveryPrice(courier: CourierProvider, params: any): Promise<{
  success: boolean;
  price?: number;
  message?: string;
}> {
  try {
    switch (courier) {
      case 'pathao': {
        const result = await pathaoService.calculatePrice(params);
        return { success: true, price: result.price };
      }
      case 'steadfast':
        return { success: true, price: 60 }; // Steadfast standard rate inside Dhaka
      case 'paperfly':
        return { success: true, price: 55 }; // Paperfly standard rate
      case 'redx':
        return { success: true, price: 70 }; // RedX standard rate
      default:
        return { success: false, message: 'Unknown courier' };
    }
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
