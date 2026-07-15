import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FiZap,
  FiPlus,
  FiTrash2,
  FiClock,
  FiPackage,
  FiBarChart2,
  FiStopCircle,
} from "react-icons/fi";
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import FlashSaleExplorer from "../components/flash-sales/FlashSaleExplorer";
import FlashSaleReportModal from "../components/flash-sales/FlashSaleReportModal";

const BASE = "/api";

const STATUS_STYLES = {
  draft: "bg-crm-surface text-crm-text-dim",
  scheduled: "bg-crm-warning-dim text-crm-warning",
  running: "bg-green-500/20 text-green-400 animate-pulse",
  completed: "bg-crm-surface text-crm-text-muted",
};

function StatusBadge({ status }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {label}
    </span>
  );
}

function CountdownTimer({ endsAt }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    function tick() {
      const diff = new Date(endsAt) - new Date();
      if (diff <= 0) {
        setRemaining("Ended");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}h ${m}m`);
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [endsAt]);
  return <span className="font-mono text-crm-warning text-sm">{remaining}</span>;
}

function defaultDates() {
  const start = new Date();
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 7 * 86400000);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

export default function FlashSalesPage() {
  const toast = useToast();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [reportSale, setReportSale] = useState(null);
  const [deleting, setDeleting] = useState({});

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/flash-sales`);
      setSales(res.data?.sales || []);
    } catch {
      toast.error("Failed to load flash campaigns");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const filtered = useMemo(() => {
    if (filter === "all") return sales;
    return sales.filter((s) => (s.computed_status || s.campaign_status) === filter);
  }, [sales, filter]);

  const counts = useMemo(() => {
    const c = { all: sales.length, draft: 0, scheduled: 0, running: 0, completed: 0 };
    sales.forEach((s) => {
      const st = s.computed_status || s.campaign_status || "draft";
      if (c[st] != null) c[st] += 1;
    });
    return c;
  }, [sales]);

  async function createCampaign() {
    setCreating(true);
    const { starts_at, ends_at } = defaultDates();
    try {
      const res = await api.post(`${BASE}/flash-sales`, {
        name: "New campaign",
        starts_at,
        ends_at,
        items: [],
        save_as_draft: true,
      });
      const id = res.data?.id;
      if (!id) throw new Error("No campaign id returned");
      setSelectedId(id);
      await fetchSales();
      toast.success("Draft campaign created — edits auto-save");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  }

  async function deleteSale(id, e) {
    e?.stopPropagation();
    if (!window.confirm("Delete this campaign permanently?")) return;
    setDeleting((d) => ({ ...d, [id]: true }));
    try {
      await api.delete(`${BASE}/flash-sales/${id}`);
      setSales((s) => s.filter((x) => x.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success("Campaign deleted");
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting((d) => ({ ...d, [id]: false }));
    }
  }

  async function completeEarly(id, e) {
    e?.stopPropagation();
    if (!window.confirm("End this campaign now and restore product pricing?")) return;
    try {
      await api.post(`${BASE}/flash-sales/${id}/complete`);
      toast.success("Campaign completed");
      fetchSales();
    } catch {
      toast.error("Failed to complete campaign");
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] min-h-[480px] animate-fade-in -mx-4 lg:-mx-6">
      {reportSale && (
        <FlashSaleReportModal
          saleId={reportSale.id}
          saleName={reportSale.name}
          onClose={() => setReportSale(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 lg:px-6 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-warning-dim text-crm-warning">
            <FiZap size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Flash Campaigns</h2>
            <p className="text-crm-text-dim text-sm">Explorer · auto-save · tiered & flat pricing</p>
          </div>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={createCampaign}
          className="crm-btn-primary flex items-center gap-2 shrink-0"
        >
          {creating ? <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> : <FiPlus size={18} />}
          New campaign
        </button>
      </div>

      <div className="flex flex-wrap gap-2 px-4 lg:px-6 pb-3 shrink-0">
        {[
          ["all", "All"],
          ["draft", "Draft"],
          ["scheduled", "Scheduled"],
          ["running", "Running"],
          ["completed", "Completed"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              filter === key ? "bg-crm-warning-dim text-crm-warning" : "bg-crm-bg text-crm-text-dim hover:text-crm-text-bright"
            }`}
          >
            {label} ({counts[key] ?? 0})
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 border-t border-crm-border bg-crm-bg">
        <aside className="w-full max-w-sm border-r border-crm-border overflow-y-auto shrink-0 hidden md:block">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-warning" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-crm-text-dim text-sm">No campaigns in this view.</div>
          ) : (
            <ul className="divide-y divide-crm-border">
              {filtered.map((sale) => {
                const status = sale.computed_status || sale.campaign_status || "draft";
                const active = selectedId === sale.id;
                return (
                  <li key={sale.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(sale.id)}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-crm-surface/80 ${
                        active ? "bg-crm-warning-dim/30 border-l-2 border-crm-warning" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-crm-text-bright truncate text-sm">{sale.name}</p>
                        <StatusBadge status={status} />
                      </div>
                      <p className="text-xs text-crm-text-dim mt-1 flex items-center gap-1">
                        <FiPackage size={11} /> {sale.item_count ?? 0} products
                      </p>
                      <p className="text-[10px] text-crm-text-muted mt-0.5">
                        {sale.starts_at ? format(new Date(sale.starts_at), "MMM d, HH:mm") : "—"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          {selectedId ? (
            <>
              <div className="md:hidden px-4 py-2 border-b border-crm-border">
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="crm-input w-full text-sm"
                >
                  {filtered.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-crm-border bg-crm-surface/50 shrink-0">
                {(() => {
                  const sale = sales.find((s) => s.id === selectedId);
                  if (!sale) return null;
                  const status = sale.computed_status || sale.campaign_status || "draft";
                  return (
                    <>
                      <button type="button" onClick={() => setReportSale(sale)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border border-crm-border">
                        <FiBarChart2 size={12} /> Report
                      </button>
                      {status === "running" && (
                        <button type="button" onClick={(e) => completeEarly(sale.id, e)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-orange-400 border border-orange-500/30">
                          <FiStopCircle size={12} /> End now
                        </button>
                      )}
                      {status === "draft" && (
                        <button type="button" disabled={deleting[sale.id]} onClick={(e) => deleteSale(sale.id, e)}
                          className="p-1 text-crm-danger">
                          <FiTrash2 size={14} />
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="flex-1 min-h-0">
                <FlashSaleExplorer
                  saleId={selectedId}
                  onSaved={fetchSales}
                  onDeleted={(id) => {
                    setSelectedId(null);
                    setSales((s) => s.filter((x) => x.id !== id));
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 p-8 text-center">
              <FiZap size={48} className="text-crm-text-muted mb-4" />
              <p className="text-crm-text-dim mb-4">Select a campaign or create a new one to open the explorer.</p>
              <button type="button" onClick={createCampaign} disabled={creating} className="crm-btn-primary">
                <FiPlus className="inline mr-2" /> Create campaign
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
