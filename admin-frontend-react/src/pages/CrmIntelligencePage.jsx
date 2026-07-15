import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCpu, FiRefreshCw, FiAlertTriangle, FiUsers, FiTrendingUp, FiX, FiPlus } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

const TABS = [
  { key: "risk", label: "Churn & Risk" },
  { key: "segments", label: "Segments" },
  { key: "clv", label: "Lifetime Value" },
  { key: "pipeline", label: "Sales Pipeline" },
];

function churnColor(score) {
  if (score >= 0.7) return "text-crm-danger";
  if (score >= 0.4) return "text-crm-warning";
  return "text-crm-success";
}

function money(n) {
  return "৳" + Number(n || 0).toLocaleString();
}

export default function CrmIntelligencePage() {
  const toast = useToast();
  const [tab, setTab] = useState("risk");
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [churn, setChurn] = useState([]);
  const [segments, setSegments] = useState([]);
  const [clv, setClv] = useState(null);
  const [pipeline, setPipeline] = useState({ stages: [], deals: [] });
  const [timeline, setTimeline] = useState(null);
  const [recomputing, setRecomputing] = useState(false);
  const [newDeal, setNewDeal] = useState({ title: "", value: "", customerId: "" });

  const loadOverview = useCallback(async () => {
    try { setOverview(await adminApi.intelOverview()); } catch { /* ignore */ }
  }, []);

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "risk") setChurn((await adminApi.intelChurn({ limit: 100 }))?.customers || []);
      else if (tab === "segments") setSegments((await adminApi.intelSegments())?.segments || []);
      else if (tab === "clv") setClv(await adminApi.intelClv({ limit: 25 }));
      else if (tab === "pipeline") setPipeline(await adminApi.deals());
    } catch {
      toast.error("Failed to load intelligence data");
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadTab(); }, [loadTab]);

  const recompute = async () => {
    setRecomputing(true);
    try {
      const r = await adminApi.intelRecompute({ churn: true, demand: true });
      toast.success(`Recomputed ${r.churn} customers, ${r.demand} products`);
      loadOverview(); loadTab();
    } catch (e) {
      toast.error(e?.response?.data?.error === "ml_not_configured" ? "ML service not configured" : "Recompute failed");
    } finally {
      setRecomputing(false);
    }
  };

  const openTimeline = async (customerId) => {
    try {
      setTimeline({ customerId, loading: true });
      const data = await adminApi.intelCustomerTimeline(customerId);
      setTimeline({ customerId, ...data, loading: false });
    } catch {
      toast.error("Failed to load timeline");
      setTimeline(null);
    }
  };

  const dealsByStage = useMemo(() => {
    const map = {};
    for (const s of pipeline.stages || []) map[s.id] = [];
    for (const d of pipeline.deals || []) (map[d.stageId] = map[d.stageId] || []).push(d);
    return map;
  }, [pipeline]);

  const moveDeal = async (deal, stageId) => {
    try {
      await adminApi.updateDeal(deal.id, { stageId });
      loadTab();
    } catch { toast.error("Failed to move deal"); }
  };

  const addDeal = async () => {
    if (!newDeal.title.trim()) { toast.error("Deal title required"); return; }
    try {
      await adminApi.createDeal({
        title: newDeal.title.trim(),
        value: Number(newDeal.value) || 0,
        customerId: newDeal.customerId.trim() || undefined,
      });
      setNewDeal({ title: "", value: "", customerId: "" });
      toast.success("Deal created");
      loadTab();
    } catch { toast.error("Failed to create deal"); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiCpu size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright">CRM Intelligence</h2>
            <p className="text-crm-text-dim text-sm">Predictive churn, segmentation, CLV &amp; B2B sales pipeline</p>
          </div>
        </div>
        <button onClick={recompute} disabled={recomputing} className="crm-btn-primary flex items-center gap-2 text-sm">
          <FiRefreshCw size={14} className={recomputing ? "animate-spin" : ""} /> Recompute predictions
        </button>
      </div>

      {overview && !overview.mlConfigured && (
        <div className="crm-card flex items-start gap-3 border-crm-warning text-crm-warning bg-crm-warning-dim/30">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <div className="text-sm">ML service not configured — predictions use heuristic RFM fallbacks. Set <code>ML_SERVICE_URL</code> to enable the full models.</div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="crm-card"><p className="text-xs text-crm-text-dim uppercase font-bold">Scored customers</p><p className="text-2xl font-bold text-crm-text-bright tabular-nums">{overview?.totalScoredCustomers ?? 0}</p></div>
        <div className="crm-card"><p className="text-xs text-crm-text-dim uppercase font-bold">Avg predicted LTV</p><p className="text-2xl font-bold text-crm-primary tabular-nums">{money(overview?.avgPredictedLtv)}</p></div>
        <div className="crm-card"><p className="text-xs text-crm-text-dim uppercase font-bold">Total predicted LTV</p><p className="text-2xl font-bold text-crm-text-bright tabular-nums">{money(overview?.totalPredictedLtv)}</p></div>
        <div className="crm-card"><p className="text-xs text-crm-text-dim uppercase font-bold">Segments</p><p className="text-2xl font-bold text-crm-text-bright tabular-nums">{overview?.segments?.length ?? 0}</p></div>
      </div>

      <div className="flex gap-2 border-b border-crm-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? "border-crm-primary text-crm-primary" : "border-transparent text-crm-text-dim hover:text-crm-text-bright"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-crm-primary rounded-full" /></div>}

      {!loading && tab === "risk" && (
        <div className="crm-card overflow-hidden">
          <div className="crm-table-container">
            <table className="crm-table text-sm">
              <thead><tr><th>Customer</th><th>Segment</th><th>Churn risk</th><th>Predicted LTV</th><th>Lifetime spend</th><th></th></tr></thead>
              <tbody>
                {churn.map((c) => (
                  <tr key={c.customerId}>
                    <td><div className="font-medium text-crm-text-bright">{c.name}</div><div className="text-xs text-crm-text-dim">{c.email || c.customerId}</div></td>
                    <td><span className="text-xs px-2 py-0.5 rounded-full bg-crm-primary-dim text-crm-primary">{c.segment || "—"}</span></td>
                    <td><span className={`font-bold tabular-nums ${churnColor(c.churnScore)}`}>{(c.churnScore * 100).toFixed(0)}%</span></td>
                    <td className="tabular-nums">{money(c.predictedLtv)}</td>
                    <td className="tabular-nums text-crm-text-dim">{money(c.lifetimeSpend)}</td>
                    <td><button onClick={() => openTimeline(c.customerId)} className="text-crm-primary text-xs hover:underline">Timeline</button></td>
                  </tr>
                ))}
                {churn.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-crm-text-dim">No predictions yet — run “Recompute predictions”</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === "segments" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((s) => (
            <div key={s.segment} className="crm-card">
              <div className="flex items-center justify-between"><h3 className="font-bold text-crm-text-bright capitalize">{s.segment}</h3><FiUsers className="text-crm-text-dim" /></div>
              <p className="text-3xl font-bold text-crm-primary tabular-nums mt-2">{s.customers}</p>
              <div className="mt-2 text-xs text-crm-text-dim space-y-1">
                <div>Avg churn: <span className={churnColor(s.avgChurn)}>{(s.avgChurn * 100).toFixed(0)}%</span></div>
                <div>Avg LTV: {money(s.avgPredictedLtv)}</div>
              </div>
            </div>
          ))}
          {segments.length === 0 && <div className="crm-card text-crm-text-dim text-sm">No segments yet.</div>}
        </div>
      )}

      {!loading && tab === "clv" && clv && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="crm-card"><p className="text-xs text-crm-text-dim uppercase font-bold">Avg LTV</p><p className="text-2xl font-bold text-crm-primary tabular-nums">{money(clv.avgLtv)}</p></div>
            <div className="crm-card"><p className="text-xs text-crm-text-dim uppercase font-bold">Total predicted LTV</p><p className="text-2xl font-bold text-crm-text-bright tabular-nums">{money(clv.totalPredictedLtv)}</p></div>
            <div className="crm-card"><p className="text-xs text-crm-text-dim uppercase font-bold">Scored</p><p className="text-2xl font-bold text-crm-text-bright tabular-nums">{clv.scoredCustomers}</p></div>
          </div>
          <div className="crm-card overflow-hidden">
            <h3 className="font-bold text-crm-text-bright mb-3 flex items-center gap-2"><FiTrendingUp /> Top customers by predicted LTV</h3>
            <div className="crm-table-container">
              <table className="crm-table text-sm">
                <thead><tr><th>Customer</th><th>Predicted LTV</th><th>Churn risk</th><th>Segment</th></tr></thead>
                <tbody>
                  {(clv.top || []).map((c) => (
                    <tr key={c.customerId}>
                      <td className="font-medium">{c.name}</td>
                      <td className="tabular-nums text-crm-primary font-bold">{money(c.predictedLtv)}</td>
                      <td><span className={churnColor(c.churnScore)}>{(c.churnScore * 100).toFixed(0)}%</span></td>
                      <td className="text-xs">{c.segment || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && tab === "pipeline" && (
        <div className="space-y-4">
          <div className="crm-card flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[160px]"><label className="text-xs text-crm-text-dim uppercase font-bold">Deal title</label><input className="crm-input w-full" value={newDeal.title} onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })} /></div>
            <div className="w-32"><label className="text-xs text-crm-text-dim uppercase font-bold">Value (৳)</label><input type="number" className="crm-input w-full" value={newDeal.value} onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })} /></div>
            <div className="w-36"><label className="text-xs text-crm-text-dim uppercase font-bold">Customer ID</label><input className="crm-input w-full" value={newDeal.customerId} onChange={(e) => setNewDeal({ ...newDeal, customerId: e.target.value })} /></div>
            <button onClick={addDeal} className="crm-btn-primary flex items-center gap-2"><FiPlus size={16} /> Add deal</button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {(pipeline.stages || []).map((stage) => (
              <div key={stage.id} className="min-w-[240px] w-60 shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h4 className="font-bold text-crm-text-bright text-sm">{stage.name}</h4>
                  <span className="text-xs text-crm-text-dim">{(dealsByStage[stage.id] || []).length}</span>
                </div>
                <div className="space-y-2 min-h-[60px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { const id = e.dataTransfer.getData("dealId"); const d = pipeline.deals.find((x) => x.id === id); if (d) moveDeal(d, stage.id); }}>
                  {(dealsByStage[stage.id] || []).map((d) => (
                    <div key={d.id} draggable onDragStart={(e) => e.dataTransfer.setData("dealId", d.id)}
                      className="crm-card cursor-grab active:cursor-grabbing p-3">
                      <div className="font-medium text-crm-text-bright text-sm">{d.title}</div>
                      <div className="text-crm-primary font-bold text-sm tabular-nums">{money(d.value)}</div>
                      {d.customerId && <div className="text-xs text-crm-text-dim font-mono">{d.customerId}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {timeline && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setTimeline(null)}>
          <div className="w-full max-w-md bg-crm-bg h-full overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-crm-text-bright">Customer Timeline</h3>
              <button onClick={() => setTimeline(null)} className="text-crm-text-dim hover:text-crm-text-bright"><FiX size={20} /></button>
            </div>
            {timeline.loading ? (
              <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-crm-primary rounded-full" /></div>
            ) : (
              <>
                {timeline.prediction && (
                  <div className="crm-card mb-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-xs text-crm-text-dim uppercase">Churn risk</p><p className={`font-bold ${churnColor(timeline.prediction.churnScore)}`}>{(timeline.prediction.churnScore * 100).toFixed(0)}%</p></div>
                      <div><p className="text-xs text-crm-text-dim uppercase">Predicted LTV</p><p className="font-bold text-crm-primary">{money(timeline.prediction.predictedLtv)}</p></div>
                      <div><p className="text-xs text-crm-text-dim uppercase">Segment</p><p className="font-medium capitalize">{timeline.prediction.segment || "—"}</p></div>
                    </div>
                  </div>
                )}
                <h4 className="font-bold text-crm-text-bright text-sm mb-2">Communication history</h4>
                <ul className="space-y-2">
                  {(timeline.timeline || []).map((l) => (
                    <li key={l.id} className="border-l-2 border-crm-primary/40 pl-3 py-1">
                      <div className="flex justify-between gap-2">
                        <span className="text-xs font-semibold uppercase text-crm-primary">{l.channel} · {l.direction}</span>
                        <span className="text-[11px] text-crm-text-dim">{l.createdAt ? format(new Date(l.createdAt), "MMM d HH:mm") : ""}</span>
                      </div>
                      {l.subject && <div className="text-sm text-crm-text-bright">{l.subject}</div>}
                      {l.body && <div className="text-xs text-crm-text-dim line-clamp-2">{l.body}</div>}
                    </li>
                  ))}
                  {(timeline.timeline || []).length === 0 && <li className="text-crm-text-dim text-sm py-4 text-center">No communication history</li>}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
