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

export function normalizeReturn(row) {
  if (!row) return row;
  const timeline = Array.isArray(row.timeline) ? row.timeline : [];
  return {
    id: row.id,
    orderId: row.order_id ?? row.orderId,
    userId: row.user_id ?? row.userId,
    reason: row.reason,
    reasonCategory: row.reason_category ?? row.reasonCategory,
    description: row.description,
    status: row.status,
    refundAmount: row.refund_amount ?? row.refundAmount ?? 0,
    adminNote: row.admin_note ?? row.adminNote,
    timeline: timeline.map((h) => ({
      status: h.status,
      note: h.note,
      at: h.timestamp ?? h.at,
    })),
    createdAt: row.created_at ?? row.createdAt,
  };
}
