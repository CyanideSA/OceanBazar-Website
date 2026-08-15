import React, { useEffect, useState } from "react";
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

function pickId(row, ...keys) {
  for (const k of keys) {
    if (row?.[k] != null && row[k] !== "") return Number(row[k]);
  }
  return 0;
}

function pickName(row, ...keys) {
  for (const k of keys) {
    if (row?.[k]) return String(row[k]);
  }
  return "";
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
    pathaoStoreId: "",
    pathaoCityId: "",
    pathaoZoneId: "",
    pathaoAreaId: "",
  });

  const [pathaoStores, setPathaoStores] = useState([]);
  const [pathaoCities, setPathaoCities] = useState([]);
  const [pathaoZones, setPathaoZones] = useState([]);
  const [pathaoAreas, setPathaoAreas] = useState([]);
  const [pathaoLoading, setPathaoLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (mode !== "assign" || form.courier !== "pathao") return;
    let cancelled = false;
    (async () => {
      setPathaoLoading(true);
      try {
        const [storesRes, citiesRes] = await Promise.all([
          adminApi.pathaoStores(),
          adminApi.pathaoCities(),
        ]);
        if (cancelled) return;
        const stores = Array.isArray(storesRes?.stores) ? storesRes.stores : [];
        const cities = Array.isArray(citiesRes?.cities) ? citiesRes.cities : [];
        setPathaoStores(stores);
        setPathaoCities(cities);
        setForm((f) => {
          if (f.pathaoStoreId) return f;
          const preferred = stores.find((s) => s.is_default_store) || stores[0];
          const sid = pickId(preferred, "store_id", "id");
          return sid ? { ...f, pathaoStoreId: String(sid) } : f;
        });
        // #region agent log
        fetch("http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7c9155" }, body: JSON.stringify({ sessionId: "7c9155", runId: "pathao-book", hypothesisId: "C", location: "CourierBookingModal.jsx:loadPathao", message: "pathao meta loaded", data: { storeCount: stores.length, cityCount: cities.length }, timestamp: Date.now() }) }).catch(() => {});
        // #endregion
      } catch (err) {
        toast.error(err?.response?.data?.error || "Failed to load Pathao stores/cities");
      } finally {
        if (!cancelled) setPathaoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, form.courier]);

  useEffect(() => {
    if (!form.pathaoCityId) {
      setPathaoZones([]);
      setPathaoAreas([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.pathaoZones(form.pathaoCityId);
        if (cancelled) return;
        setPathaoZones(Array.isArray(res?.zones) ? res.zones : []);
        setForm((f) => ({ ...f, pathaoZoneId: "", pathaoAreaId: "" }));
        setPathaoAreas([]);
      } catch {
        if (!cancelled) toast.error("Failed to load Pathao zones");
      }
    })();
    return () => { cancelled = true; };
  }, [form.pathaoCityId]);

  useEffect(() => {
    if (!form.pathaoZoneId) {
      setPathaoAreas([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.pathaoAreas(form.pathaoZoneId);
        if (cancelled) return;
        setPathaoAreas(Array.isArray(res?.areas) ? res.areas : []);
        setForm((f) => ({ ...f, pathaoAreaId: "" }));
      } catch {
        if (!cancelled) toast.error("Failed to load Pathao areas");
      }
    })();
    return () => { cancelled = true; };
  }, [form.pathaoZoneId]);

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
        if (form.courier === "pathao") {
          if (!form.pathaoStoreId || !form.pathaoCityId || !form.pathaoZoneId) {
            toast.error("Pathao requires Store, City, and Zone");
            setSaving(false);
            return;
          }
        }
        const payload = {
          orderId: targetOrderId,
          courier: form.courier,
          recipientName: form.recipientName.trim(),
          recipientPhone: form.recipientPhone.trim(),
          recipientAddress: form.recipientAddress.trim(),
          codAmount: Number(form.codAmount) || 0,
          weight: form.weight ? Number(form.weight) : undefined,
          note: form.note || undefined,
        };
        if (form.courier === "pathao") {
          // Normalize BD phones for Pathao (01XXXXXXXXX) before API call.
          let digits = String(payload.recipientPhone || "").replace(/\D/g, "");
          if (digits.startsWith("880") && digits.length >= 12) digits = digits.slice(3);
          if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;
          payload.recipientPhone = digits;
          if (!/^01\d{9}$/.test(digits)) {
            toast.error("Pathao phone must be 11 digits starting with 01 (e.g. 01712345678)");
            setSaving(false);
            return;
          }
          payload.pathaoStoreId = Number(form.pathaoStoreId);
          payload.pathaoCityId = Number(form.pathaoCityId);
          payload.pathaoZoneId = Number(form.pathaoZoneId);
          if (form.pathaoAreaId) payload.pathaoAreaId = Number(form.pathaoAreaId);
        }
        // #region agent log
        fetch("http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "7c9155" }, body: JSON.stringify({ sessionId: "7c9155", runId: "pathao-book", hypothesisId: "C", location: "CourierBookingModal.jsx:submit", message: "assign courier submit", data: { courier: form.courier, orderId: targetOrderId, pathaoStoreId: payload.pathaoStoreId || null, pathaoCityId: payload.pathaoCityId || null, pathaoZoneId: payload.pathaoZoneId || null, pathaoAreaId: payload.pathaoAreaId || null }, timestamp: Date.now() }) }).catch(() => {});
        // #endregion
        const res = await adminApi.assignCourier(payload);
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
          className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}
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
                  <input
                    className="crm-input"
                    value={form.recipientPhone}
                    onChange={set("recipientPhone")}
                    placeholder="01XXXXXXXXX"
                  />
                  {form.courier === "pathao" ? (
                    <p className="mt-1 text-[11px] text-crm-text-dim">
                      Pathao needs an 11-digit BD mobile starting with 01 (e.g. 01712345678). +880 is auto-converted.
                    </p>
                  ) : null}
                </div>
                <div className="field">
                  <label className="field-label">Recipient Address</label>
                  <textarea className="crm-input min-h-[60px]" value={form.recipientAddress} onChange={set("recipientAddress")} />
                </div>

                {form.courier === "pathao" && (
                  <div className="space-y-3 rounded-lg border border-crm-border bg-crm-bg-alt p-3">
                    <p className="text-xs font-bold text-crm-text-dim uppercase tracking-wide">
                      Pathao delivery location {pathaoLoading ? "(loading…)" : ""}
                    </p>
                    <div className="field">
                      <label className="field-label">Pickup store</label>
                      <select className="crm-input" value={form.pathaoStoreId} onChange={set("pathaoStoreId")}>
                        <option value="">Select store</option>
                        {pathaoStores.map((s) => {
                          const id = pickId(s, "store_id", "id");
                          return (
                            <option key={id} value={id}>
                              {pickName(s, "store_name", "name") || `Store ${id}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="field">
                        <label className="field-label">City</label>
                        <select className="crm-input" value={form.pathaoCityId} onChange={set("pathaoCityId")}>
                          <option value="">Select city</option>
                          {pathaoCities.map((c) => {
                            const id = pickId(c, "city_id", "id");
                            return (
                              <option key={id} value={id}>
                                {pickName(c, "city_name", "name") || id}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label">Zone</label>
                        <select className="crm-input" value={form.pathaoZoneId} onChange={set("pathaoZoneId")} disabled={!form.pathaoCityId}>
                          <option value="">Select zone</option>
                          {pathaoZones.map((z) => {
                            const id = pickId(z, "zone_id", "id");
                            return (
                              <option key={id} value={id}>
                                {pickName(z, "zone_name", "name") || id}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label">Area (optional)</label>
                        <select className="crm-input" value={form.pathaoAreaId} onChange={set("pathaoAreaId")} disabled={!form.pathaoZoneId}>
                          <option value="">Select area</option>
                          {pathaoAreas.map((a) => {
                            const id = pickId(a, "area_id", "id");
                            return (
                              <option key={id} value={id}>
                                {pickName(a, "area_name", "name") || id}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

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
            <button className="crm-btn crm-btn-primary" onClick={submit} disabled={saving || pathaoLoading}>
              {saving ? "Booking…" : mode === "assign" ? "Book Courier" : "Add Tracking"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
