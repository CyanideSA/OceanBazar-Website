/** Map snake_case API rows to camelCase for CRM UI. */

export function normalizeApplication(row) {
  if (!row) return row;
  return {
    id: row.id,
    businessName: row.business_name ?? row.businessName,
    contactPerson: row.contact_person ?? row.contactPerson ?? row.full_name ?? row.fullName,
    fullName: row.full_name ?? row.fullName,
    email: row.email,
    phone: row.phone,
    businessType: row.business_type ?? row.businessType,
    expectedVolume: row.expected_volume ?? row.expectedVolume,
    message: row.message ?? row.business_description ?? row.businessDescription,
    status: row.status,
    adminNotes: row.admin_notes ?? row.adminNotes,
    reviewedAt: row.reviewed_at ?? row.reviewedAt,
    createdAt: row.created_at ?? row.createdAt,
  };
}

export function normalizeInventoryItem(row) {
  if (!row) return row;
  return {
    id: row.id,
    productId: row.product_id ?? row.productId,
    sku: row.sku,
    warehouseName: row.warehouse_name ?? row.warehouseName,
    quantityOnHand: row.quantity_on_hand ?? row.quantityOnHand ?? 0,
    quantityReserved: row.quantity_reserved ?? row.quantityReserved ?? 0,
    quantityAvailable: row.quantity_available ?? row.quantityAvailable ?? 0,
    reorderPoint: row.reorder_point ?? row.reorderPoint ?? 10,
    status: row.status,
  };
}

export function normalizeInventoryTransaction(row) {
  if (!row) return row;
  return {
    id: row.id,
    type: row.type,
    quantity: row.quantity,
    note: row.note,
    createdAt: row.created_at ?? row.createdAt,
  };
}

/** JSON columns may arrive as strings (raw Postgres json) or already-parsed objects. */
function parseMaybeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export function normalizeRefundRecord(row) {
  if (!row) return row;
  return {
    id: row.id,
    orderId: row.order_id ?? row.orderId,
    returnId: row.return_id ?? row.returnId,
    paymentTxId: row.payment_tx_id ?? row.paymentTxId,
    userId: row.user_id ?? row.userId,
    amount: Number(row.amount ?? 0),
    method: row.method,
    reference: row.reference,
    customerAccount: parseMaybeJson(row.customer_account ?? row.customerAccount, null),
    notes: row.notes,
    receiptUrl: row.receipt_url ?? row.receiptUrl ?? null,
    status: row.status,
    requestedAt: row.requested_at ?? row.requestedAt,
    completedAt: row.completed_at ?? row.completedAt ?? null,
    createdBy: row.created_by ?? row.createdBy ?? null,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

export function normalizeReturn(row) {
  if (!row) return row;
  const timeline = parseMaybeJson(row.timeline, []) || [];
  return {
    id: row.id,
    orderId: row.order_id ?? row.orderId,
    userId: row.user_id ?? row.userId,
    order: row.order ?? null,
    items: parseMaybeJson(row.items, []) || [],
    images: parseMaybeJson(row.images, []) || [],
    reason: row.reason,
    reasonCategory: row.reason_category ?? row.reasonCategory,
    description: row.description,
    status: row.status,
    refundAmount: row.refund_amount ?? row.refundAmount ?? 0,
    refundMethod: row.refund_method ?? row.refundMethod ?? null,
    trackingNumber: row.tracking_number ?? row.trackingNumber ?? null,
    shippingCarrier: row.shipping_carrier ?? row.shippingCarrier ?? null,
    assignedToAdminId: row.assigned_to_admin_id ?? row.assignedToAdminId ?? null,
    disputeId: row.dispute_id ?? row.disputeId ?? null,
    adminNote: row.admin_note ?? row.adminNote,
    refundRecords: Array.isArray(row.refundRecords)
      ? row.refundRecords.map(normalizeRefundRecord)
      : Array.isArray(row.refund_records)
        ? row.refund_records.map(normalizeRefundRecord)
        : [],
    courierShipments: Array.isArray(row.courierShipments)
      ? row.courierShipments
      : Array.isArray(row.courier_shipments)
        ? row.courier_shipments
        : [],
    timeline: timeline.map((h) => ({
      status: h.status,
      note: h.note,
      at: h.timestamp ?? h.at,
      actor: h.actor,
    })),
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}
