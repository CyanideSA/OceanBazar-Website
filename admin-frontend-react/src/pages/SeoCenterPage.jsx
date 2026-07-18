import React, { useCallback, useEffect, useState } from "react";
import { FiTarget, FiZap, FiRefreshCw, FiGlobe, FiLayers } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

const TYPES = ["product", "category", "brand", "page"];

function ScoreBadge({ score }) {
  const s = Number(score ?? 0);
  const color = s >= 80 ? "text-crm-success" : s >= 60 ? "text-crm-warning" : "text-crm-danger";
  return <span className={`font-bold tabular-nums ${color}`}>{s}</span>;
}

export default function SeoCenterPage() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [genType, setGenType] = useState("product");
  const [genId, setGenId] = useState("");
  const [bulkType, setBulkType] = useState("product");
  const [bulkLimit, setBulkLimit] = useState(25);

  const loadOverview = useCallback(async () => {
    try {
      setOverview(await adminApi.seoOverview());
    } catch (err) {
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.seoList({ entityType: filterType || undefined, limit: 100 });
      setItems(r?.items || []);
      setTotal(r?.total || 0);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load SEO metadata");
    } finally {
      setLoading(false);
    }
  }, [filterType, toast]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadList(); }, [loadList]);

  const generateOne = async () => {
    if (!genId.trim()) { toast.error("Enter an entity ID"); return; }
    setBusy(true);
    try {
      await adminApi.seoGenerate({ entityType: genType, entityId: genId.trim() });
      toast.success("SEO metadata generated");
      setGenId("");
      loadList(); loadOverview();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const bulkGenerate = async () => {
    setBusy(true);
    try {
      const r = await adminApi.seoBulkGenerate({ entityType: bulkType, limit: Number(bulkLimit) });
      toast.success(`Generated ${r.generated}/${r.requested} (${r.failed} failed)`);
      loadList(); loadOverview();
    } catch {
      toast.error("Bulk generation failed");
    } finally {
      setBusy(false);
    }
  };

  const pingSitemap = async () => {
    setBusy(true);
    try {
      const r = await adminApi.seoSitemapPing();
      const ok = (r.results || []).filter((x) => x.ok).length;
      toast.success(`Pinged ${ok}/${(r.results || []).length} search engines`);
    } catch {
      toast.error("Sitemap ping failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiTarget size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright">SEO Center</h2>
            <p className="text-crm-text-dim text-sm">AI-assisted metadata, schema.org, FAQ &amp; sitemap automation</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={pingSitemap} disabled={busy} className="crm-btn-ghost flex items-center gap-2 text-sm">
            <FiGlobe size={14} /> Ping sitemap
          </button>
          <button onClick={() => { loadList(); loadOverview(); }} className="crm-btn-ghost flex items-center gap-2 text-sm">
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="crm-card">
          <p className="text-xs text-crm-text-dim uppercase font-bold">Optimized entities</p>
          <p className="text-2xl font-bold text-crm-text-bright tabular-nums">{overview?.total ?? 0}</p>
        </div>
        <div className="crm-card">
          <p className="text-xs text-crm-text-dim uppercase font-bold">AI generated</p>
          <p className="text-2xl font-bold text-crm-primary tabular-nums">{overview?.aiGenerated ?? 0}</p>
        </div>
        <div className="crm-card">
          <p className="text-xs text-crm-text-dim uppercase font-bold">Low scores (&lt;60)</p>
          <p className="text-2xl font-bold text-crm-danger tabular-nums">{overview?.lowScores ?? 0}</p>
        </div>
        <div className="crm-card">
          <p className="text-xs text-crm-text-dim uppercase font-bold">Product coverage</p>
          <p className="text-2xl font-bold text-crm-text-bright tabular-nums">
            {overview?.total ?? 0}<span className="text-sm text-crm-text-dim">/{overview?.coverage?.products ?? 0}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="crm-card space-y-3">
          <h3 className="font-bold text-crm-text-bright flex items-center gap-2"><FiZap /> Generate for one entity</h3>
          <div className="flex gap-2">
            <select className="crm-input" value={genType} onChange={(e) => setGenType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="crm-input flex-1" placeholder="Entity ID (e.g. A3F2B1C9)" value={genId} onChange={(e) => setGenId(e.target.value)} />
            <button onClick={generateOne} disabled={busy} className="crm-btn-primary whitespace-nowrap">Generate</button>
          </div>
          <p className="text-xs text-crm-text-dim">Uses the AI/ML service when configured, otherwise high-quality heuristic templates.</p>
        </div>

        <div className="crm-card space-y-3">
          <h3 className="font-bold text-crm-text-bright flex items-center gap-2"><FiLayers /> Bulk generate</h3>
          <div className="flex gap-2">
            <select className="crm-input" value={bulkType} onChange={(e) => setBulkType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="crm-input w-24" type="number" min={1} max={200} value={bulkLimit} onChange={(e) => setBulkLimit(e.target.value)} />
            <button onClick={bulkGenerate} disabled={busy} className="crm-btn-primary whitespace-nowrap">Run bulk</button>
          </div>
          <p className="text-xs text-crm-text-dim">Generates for the most recently updated entities of the chosen type.</p>
        </div>
      </div>

      <div className="crm-card overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-crm-text-bright">Metadata ({total})</h3>
          <select className="crm-input max-w-[160px]" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-crm-primary rounded-full" /></div>
        ) : (
          <div className="crm-table-container">
            <table className="crm-table text-sm">
              <thead><tr><th>Type</th><th>Entity</th><th>Title</th><th>Score</th><th>Source</th><th>Updated</th></tr></thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td className="text-xs uppercase text-crm-text-dim">{m.entityType}</td>
                    <td className="font-mono text-xs">{m.entityId}</td>
                    <td className="truncate max-w-[280px]">{m.metaTitle || "—"}</td>
                    <td><ScoreBadge score={m.seoScore} /></td>
                    <td className="text-xs">{m.source}</td>
                    <td className="text-xs text-crm-text-dim">{m.updatedAt ? format(new Date(m.updatedAt), "MMM d HH:mm") : "—"}</td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-crm-text-dim">No SEO metadata yet — generate some above</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
