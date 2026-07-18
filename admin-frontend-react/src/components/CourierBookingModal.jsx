import React, { useState } from "react";
import { FiX, FiTruck, FiEdit3 } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi } from "../lib/api";
import { useToast } from "./ToastProvider";

const COURIERS = [
  { id: "steadfast", label: "Steadfast Courier" },
  { id: "pathao", label: "Pathao Courier" },
  { id: "paperfly", label: "Paperfly" },
  { id: "redx", label: "RedX" },
];

function addrOf(order) {
  const a = order?.shippingAddress;
  if (!a) return "";
  return [a.line1, a.line2, a.city, a.district].filter(Boolean).join(", ");
}

/**
 * Shared modal for booking a courier (live API) or adding a manual tracking
 * entry, used from both OrdersPage and DeliveryPage.
 */
export default function CourierBookingModal({ order, orderId, onClose, onBooked }) {
  const toast = useToast();
  const [mode, setMode] = useState("assign");
  const [saving, setSaving] = useState(false);
  const targetOrderId = order?.id || orderId;

  const [form, setForm] = useState({
    courier: "steadfast",
    recipientName: order?.user?.name || "",
    recipientPhone: order?.user?.phone || "",
    recipientAddress: addrOf(order),
    codAmount: order?.paymentMethod === "cod" ? Number(order?.total || 0) : 0,
    weight: "",
    note: "",
    trackingNumber: "",
    carrier: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!targetOrderId) { toast.error("Order ID is required"); return; }
    setSaving(true);
    try {
      if (mode === "assign") {
        if (!form.recipientName.trim() || !form.recipientPhone.trim() || !form.recipientAddress.trim()) {
          toast.error("Recipient name, phone and address are required");
          setSaving(false);
          return;
        }
        const res = await adminApi.assignCourier({
          orderId: targetOrderId,
          courier: form.courier,
          recipientName: form.recipientName.trim(),
          recipientPhone: form.recipientPhone.trim(),
          recipientAddress: form.recipientAddress.trim(),
          codAmount: Number(form.codAmount) || 0,
          weight: form.weight ? Number(form.weight) : undefined,
          note: form.note || undefined,
        });
        toast.success(`Courier booked — tracking ${res?.trackingCode || res?.consignmentId || ""}`);
      } else {
        if (!form.trackingNumber.trim()) { toast.error("Tracking number is required"); setSaving(false); return; }
        await adminApi.manualTracking({
          orderId: targetOrderId,
          trackingCode: form.trackingNumber.trim(),
          courierProvider: form.carrier || "Manual",
          note: form.note || undefined,
        });
        toast.success("Manual tracking added");
      }
      onBooked?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Booking failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="modal-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3><FiTruck className="inline mr-1.5" /> Book Courier</h3>
            <button onClick={onClose} className="text-crm-text-dim hover:text-crm-text-bright"><FiX /></button>
          </div>
          <div className="modal-body space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 crm-btn ${mode === "assign" ? "crm-btn-primary" : ""}`}
                onClick={() => setMode("assign")}
              >
                <FiTruck /> Live Booking
              </button>
              <button
                type="button"
                className={`flex-1 crm-btn ${mode === "manual" ? "crm-btn-primary" : ""}`}
                onClick={() => setMode("manual")}
              >
                <FiEdit3 /> Manual Tracking
              </button>
            </div>

            {!order && (
              <div className="field">
                <label className="field-label">Order ID</label>
                <input className="crm-input" value={targetOrderId || ""} disabled />
              </div>
            )}

            {mode === "assign" ? (
              <>
                <div className="field">
                  <label className="field-label">Courier</label>
                  <select className="crm-input" value={form.courier} onChange={set("courier")}>
                    {COURIERS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Recipient Name</label>
                  <input className="crm-input" value={form.recipientName} onChange={set("recipientName")} />
                </div>
                <div className="field">
                  <label className="field-label">Recipient Phone</label>
                  <input className="crm-input" value={form.recipientPhone} onChange={set("recipientPhone")} />
                </div>
                <div className="field">
                  <label className="field-label">Recipient Address</label>
                  <textarea className="crm-input min-h-[60px]" value={form.recipientAddress} onChange={set("recipientAddress")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="field">
                    <label className="field-label">COD Amount (৳)</label>
                    <input type="number" className="crm-input" value={form.codAmount} onChange={set("codAmount")} />
                  </div>
                  <div className="field">
                    <label className="field-label">Weight (kg)</label>
                    <input type="number" className="crm-input" value={form.weight} onChange={set("weight")} placeholder="0.5" />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Note (optional)</label>
                  <input className="crm-input" value={form.note} onChange={set("note")} />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label className="field-label">Tracking / Consignment Number</label>
                  <input className="crm-input" value={form.trackingNumber} onChange={set("trackingNumber")} placeholder="e.g. SF123456789" />
                </div>
                <div className="field">
                  <label className="field-label">Carrier / Courier name</label>
                  <input className="crm-input" value={form.carrier} onChange={set("carrier")} placeholder="e.g. Sundarban Courier" />
                </div>
                <div className="field">
                  <label className="field-label">Note (optional)</label>
                  <input className="crm-input" value={form.note} onChange={set("note")} />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="crm-btn" onClick={onClose}>Cancel</button>
            <button className="crm-btn crm-btn-primary" onClick={submit} disabled={saving}>
              {saving ? "Booking…" : mode === "assign" ? "Book Courier" : "Add Tracking"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
