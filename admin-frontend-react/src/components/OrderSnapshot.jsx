import React from "react";
import { FiExternalLink, FiUser, FiPackage, FiTruck, FiCreditCard } from "react-icons/fi";
import { format } from "date-fns";

function money(n) {
  return `৳${Number(n || 0).toLocaleString()}`;
}

function addr(a) {
  if (!a) return null;
  const parts = [a.line1, a.line2, a.city, a.district, a.postalCode].filter(Boolean);
  return parts.join(", ") || null;
}

/**
 * Full order snapshot — reused by Orders, Delivery, Returns, Payments.
 */
export default function OrderSnapshot({
  order,
  onOpenCustomer,
  onOpenProduct,
  onOpenOrder,
  showTimeline = true,
  showPayments = true,
  showShipments = true,
  actions = null,
  compact = false,
}) {
  if (!order) return null;

  const o = order.order || order;
  const items = o.items || [];
  const user = o.user || o.customer || null;
  const shipping = o.shippingAddress || o.shipping_address || null;
  const timeline = o.timeline || [];
  const payments = o.paymentTxs || o.payment_txs || o.payments || [];
  const shipments = o.shipments || [];
  const courierShipments = o.courierShipments || o.courier_shipments || [];

  return (
    <div className={`space-y-${compact ? "4" : "6"}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-crm-text-dim">Order</p>
          <button
            type="button"
            className="text-lg font-bold text-crm-primary hover:underline"
            onClick={() => onOpenOrder?.(o.id)}
          >
            #{o.orderNumber || String(o.id || "").slice(-8).toUpperCase()}
          </button>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="crm-badge">{o.status || "—"}</span>
            <span className="crm-badge">{o.paymentStatus || o.payment_status || "—"}</span>
            {(o.deliveryPaymentStatus || o.delivery_payment_status) && String(o.deliveryPaymentStatus || o.delivery_payment_status) !== 'none' ? (
              <span className="crm-badge">
                Delivery: {String(o.deliveryPaymentStatus || o.delivery_payment_status).replace(/_/g, ' ')}
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-crm-text-dim">Total</p>
          <p className="text-xl font-extrabold text-crm-text-bright">{money(o.total)}</p>
          {o.createdAt && (
            <p className="text-[10px] text-crm-text-dim mt-1">
              {format(new Date(o.createdAt), "MMM dd, yyyy HH:mm")}
            </p>
          )}
        </div>
      </div>

      {/* Customer */}
      <div className="crm-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-bold text-crm-text-dim uppercase tracking-widest flex items-center gap-1.5">
            <FiUser size={12} /> Customer
          </h4>
          {user?.id && onOpenCustomer && (
            <button
              type="button"
              className="text-xs text-crm-primary hover:underline flex items-center gap-1"
              onClick={() => onOpenCustomer(user.id)}
            >
              Open profile <FiExternalLink size={12} />
            </button>
          )}
        </div>
        <p className="text-sm font-bold text-crm-text-bright">{user?.name || "Guest"}</p>
        <p className="text-xs text-crm-text-dim">{user?.email || "—"}</p>
        {user?.phone && <p className="text-xs text-crm-text-dim">{user.phone}</p>}
        {user?.id && <p className="text-[10px] font-mono text-crm-text-muted">ID: {user.id}</p>}
        {addr(shipping) && (
          <div className="pt-2 border-t border-crm-border">
            <p className="text-[10px] font-bold uppercase text-crm-text-dim mb-1">Delivery address</p>
            <p className="text-xs text-crm-text-bright">{addr(shipping)}</p>
            {(shipping?.pathaoCityName || shipping?.pathao_city_name) && (
              <p className="text-[10px] text-crm-text-dim mt-1">
                Pathao: {shipping.pathaoCityName || shipping.pathao_city_name}
                {(shipping.pathaoZoneName || shipping.pathao_zone_name) ? ` / ${shipping.pathaoZoneName || shipping.pathao_zone_name}` : ''}
                {(shipping.pathaoAreaName || shipping.pathao_area_name) ? ` / ${shipping.pathaoAreaName || shipping.pathao_area_name}` : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold text-crm-text-dim uppercase tracking-widest flex items-center gap-1.5">
          <FiPackage size={12} /> Items ({items.length})
        </h4>
        {items.length === 0 && (
          <p className="text-xs text-crm-text-dim">No line items</p>
        )}
        {items.map((item, i) => {
          const title = item.productTitle || item.title || item.productId;
          const price = item.unitPrice ?? item.price ?? 0;
          const img = item.productImage || item.image || item.product?.assets?.[0]?.url;
          return (
            <div key={item.id || i} className="flex gap-3 items-center p-2 rounded-lg bg-crm-bg border border-crm-border">
              <div className="w-12 h-12 rounded bg-crm-bg-hover overflow-hidden flex-shrink-0 flex items-center justify-center">
                {img ? (
                  <img src={img} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FiPackage className="text-crm-text-dim" size={18} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {onOpenProduct && item.productId ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-crm-primary hover:underline truncate block text-left"
                    onClick={() => onOpenProduct(item.productId)}
                  >
                    {title}
                  </button>
                ) : (
                  <p className="text-sm font-medium text-crm-text-bright truncate">{title}</p>
                )}
                {(item.variantLabel || item.variant_label) && (
                  <p className="text-[10px] text-crm-primary font-medium truncate">
                    {item.variantLabel || item.variant_label}
                  </p>
                )}
                <p className="text-[10px] text-crm-text-dim">
                  Qty: {item.quantity} × {money(price)}
                </p>
              </div>
              <p className="text-sm font-bold text-crm-text-bright flex-shrink-0">
                {money(item.lineTotal ?? Number(price) * Number(item.quantity || 0))}
              </p>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="crm-card p-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-crm-text-dim"><span>Subtotal</span><span>{money(o.subtotal)}</span></div>
        {Number(o.discount) > 0 && <div className="flex justify-between text-crm-text-dim"><span>Discount</span><span>-{money(o.discount)}</span></div>}
        {Number(o.obDiscount || o.ob_discount) > 0 && <div className="flex justify-between text-crm-text-dim"><span>OB Points</span><span>-{money(o.obDiscount || o.ob_discount)}</span></div>}
        <div className="flex justify-between text-crm-text-dim"><span>Shipping</span><span>{money(o.shippingFee ?? o.shipping_fee ?? o.shippingCost)}</span></div>
        {(o.deliveryPaymentStatus || o.delivery_payment_status) && String(o.deliveryPaymentStatus || o.delivery_payment_status) !== 'none' ? (
          <div className="flex justify-between text-crm-text-dim">
            <span>Delivery fee paid</span>
            <span>
              {money(o.deliveryFeePaid ?? o.delivery_fee_paid)} · {String(o.deliveryPaymentStatus || o.delivery_payment_status).replace(/_/g, ' ')}
            </span>
          </div>
        ) : null}
        {Number(o.gst) > 0 && <div className="flex justify-between text-crm-text-dim"><span>GST</span><span>{money(o.gst)}</span></div>}
        {Number(o.serviceFee || o.service_fee) > 0 && <div className="flex justify-between text-crm-text-dim"><span>Service fee</span><span>{money(o.serviceFee || o.service_fee)}</span></div>}
        <div className="flex justify-between font-bold text-crm-text-bright border-t border-crm-border pt-2 mt-1">
          <span>Total</span><span>{money(o.total)}</span>
        </div>
        {o.trackingNumber && (
          <p className="text-xs text-crm-text-dim pt-2">Tracking: <code className="font-mono text-crm-text-bright">{o.trackingNumber}</code></p>
        )}
        {o.notes && <p className="text-xs text-crm-text-dim pt-1">Notes: {o.notes}</p>}
      </div>

      {/* Payments */}
      {showPayments && payments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-crm-text-dim uppercase tracking-widest flex items-center gap-1.5">
            <FiCreditCard size={12} /> Payments
          </h4>
          {payments.map((tx) => (
            <div key={tx.id} className="flex justify-between text-xs p-2 rounded border border-crm-border">
              <span className="text-crm-text-bright">{tx.method} · {tx.status}</span>
              <span className="font-bold">{money(tx.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Shipments */}
      {showShipments && (shipments.length > 0 || courierShipments.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-crm-text-dim uppercase tracking-widest flex items-center gap-1.5">
            <FiTruck size={12} /> Shipments
          </h4>
          {courierShipments.map((cs) => (
            <div key={cs.id} className="text-xs p-2 rounded border border-crm-border space-y-0.5">
              <p className="font-medium text-crm-text-bright">{cs.courier_provider || cs.courierProvider} · {cs.internal_status || cs.internalStatus || cs.courier_status}</p>
              {(cs.tracking_code || cs.trackingCode) && (
                <p className="font-mono text-crm-text-dim">{cs.tracking_code || cs.trackingCode}</p>
              )}
            </div>
          ))}
          {shipments.map((s) => (
            <div key={s.id} className="text-xs p-2 rounded border border-crm-border">
              <p className="font-medium text-crm-text-bright">{s.carrier} · {s.status}</p>
              {s.trackingNumber && <p className="font-mono text-crm-text-dim">{s.trackingNumber}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {showTimeline && timeline.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-crm-text-dim uppercase tracking-widest">Timeline</h4>
          <ol className="space-y-2 border-l border-crm-border pl-3">
            {timeline.map((t) => (
              <li key={t.id} className="text-xs">
                <p className="font-medium text-crm-text-bright">{t.status}</p>
                {t.note && <p className="text-crm-text-dim">{t.note}</p>}
                <p className="text-crm-text-muted">
                  {t.createdAt ? format(new Date(t.createdAt), "MMM dd, HH:mm") : ""} · {t.actorType || t.actor_type || "system"}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {actions}
    </div>
  );
}
