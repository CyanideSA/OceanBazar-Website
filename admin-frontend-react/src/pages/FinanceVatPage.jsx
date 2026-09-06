import { useEffect, useState } from "react";
import { useToast } from "../components/ToastProvider";
import { api } from "../lib/api";
import { hasPermission } from "../auth/permissionMatrix";
import { getAdminUser } from "../lib/auth";

export default function FinanceVatPage() {
  const toast = useToast();
  const canEdit = hasPermission(getAdminUser()?.role, "financeVat", "edit");
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vatRatePercent: 7.5,
    priceInclusive: true,
    gatewayFeeRatePercent: 2.5,
    passThroughToCustomer: false,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        api.get("/api/admin/finance/vat-summary", { params: { days } }).then((r) => r.data),
        api.get("/api/admin/finance/tax-policy").then((r) => r.data),
      ]);
      setSummary(s);
      setPolicy(p);
      setForm((f) => ({
        ...f,
        vatRatePercent: Number(p?.tax?.vatRatePercent ?? 7.5),
        priceInclusive: Boolean(p?.tax?.priceInclusive),
        gatewayFeeRatePercent: Number(p?.gateway?.feeRatePercent ?? 2.5),
        passThroughToCustomer: Boolean(p?.gateway?.passThroughToCustomer),
      }));
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load VAT finance summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const savePolicy = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const updated = await api.put("/api/admin/finance/tax-policy", {
        vatRatePercent: Number(form.vatRatePercent),
        priceInclusive: Boolean(form.priceInclusive),
        gatewayFeeRatePercent: Number(form.gatewayFeeRatePercent),
        passThroughToCustomer: Boolean(form.passThroughToCustomer),
        effectiveFrom: form.effectiveFrom,
        reason: form.reason || "Admin CRM VAT settings update",
      }).then((r) => r.data);
      setPolicy(updated);
      toast.success("VAT / payment fee settings saved. New orders use the new rates; old orders keep snapshots.");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const cards = summary
    ? [
        { label: "Gross sales", value: summary.grossSales },
        { label: "Output VAT (estimated)", value: summary.outputVat },
        { label: "SSLCommerz fees", value: summary.sslCommerzFees },
        { label: "Gateway settlement", value: summary.gatewaySettlement },
        { label: "Paid orders", value: summary.orderCount, money: false },
      ]
    : [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-crm-text">VAT &amp; payment costs</h1>
          <p className="mt-1 max-w-2xl text-sm text-crm-muted">
            Configure Bangladesh VAT (7.5%, included in listed prices). SSLCommerz ~2.5% is a merchant cost — customers pay merchandise (VAT-inclusive) + shipping only, no service fee.
          </p>
        </div>
        <label className="text-sm text-crm-muted">
          Period (days)
          <select
            className="ml-2 rounded-lg border border-crm-border bg-crm-panel px-2 py-1.5 text-crm-text"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 30, 90, 180, 365].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>

      <form onSubmit={savePolicy} className="rounded-xl border border-crm-border bg-crm-panel p-4 space-y-4">
        <h2 className="font-semibold text-crm-text">Tax &amp; fee settings</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm space-y-1">
            <span className="text-crm-muted">Standard VAT rate (%)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="crm-input w-full"
              value={form.vatRatePercent}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, vatRatePercent: e.target.value })}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-crm-muted">SSLCommerz fee (%)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="crm-input w-full"
              value={form.gatewayFeeRatePercent}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, gatewayFeeRatePercent: e.target.value })}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-crm-muted">Effective from</span>
            <input
              type="date"
              className="crm-input w-full"
              value={form.effectiveFrom}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(form.priceInclusive)}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, priceInclusive: e.target.checked })}
            />
            Prices VAT-inclusive
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(form.passThroughToCustomer)}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, passThroughToCustomer: e.target.checked })}
            />
            Add SSL fee to customer checkout (off = merchant absorbs 2.5%)
          </label>
        </div>
        <label className="block text-sm space-y-1">
          <span className="text-crm-muted">Reason (audit)</span>
          <input
            className="crm-input w-full"
            placeholder="e.g. NBR rate update"
            value={form.reason}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          />
        </label>
        {canEdit ? (
          <button type="submit" className="crm-btn crm-btn-primary" disabled={saving || loading}>
            {saving ? "Saving…" : "Save VAT settings"}
          </button>
        ) : null}
        <p className="text-xs text-crm-muted">
          Business name, address, trade license, TIN &amp; logos for invoices are edited in{" "}
          <strong>Settings → Brand &amp; Contact / Legal</strong>.
        </p>
      </form>

      {loading ? (
        <p className="text-sm text-crm-muted">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((c) => (
              <div key={c.label} className="rounded-xl border border-crm-border bg-crm-panel p-4">
                <p className="text-xs uppercase tracking-wide text-crm-muted">{c.label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-crm-cyan">
                  {c.money === false ? c.value : `৳${Number(c.value || 0).toLocaleString("en-BD")}`}
                </p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-crm-border bg-crm-panel p-4 text-sm">
              <h2 className="font-semibold text-crm-text">Active tax policy</h2>
              <p className="mt-2 text-crm-muted">Category: {policy?.tax?.categoryCode || "—"}</p>
              <p className="text-crm-muted">VAT: {policy?.tax?.vatRatePercent ?? "—"}% · Inclusive: {policy?.tax?.priceInclusive ? "Yes" : "No"}</p>
            </section>
            <section className="rounded-xl border border-crm-border bg-crm-panel p-4 text-sm">
              <h2 className="font-semibold text-crm-text">SSLCommerz</h2>
              <p className="mt-2 text-crm-muted">Fee: {policy?.gateway?.feeRatePercent ?? 2.5}%</p>
              <p className="text-crm-muted">Customer checkout: {policy?.gateway?.passThroughToCustomer ? "Shown & added" : "Hidden (merchant only)"}</p>
            </section>
          </div>
          {summary?.disclaimer ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{summary.disclaimer}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
