import React, { useCallback, useEffect, useState } from "react";
import { FiSearch, FiTrendingUp, FiClock } from "react-icons/fi";
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

const BASE = "/api/admin/governance";

export default function SearchAnalyticsPage() {
  const toast = useToast();
  const [data, setData] = useState({ terms: [], recent: [], totalDistinct: 0 });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/search-analytics`);
      setData(res.data || { terms: [], recent: [], totalDistinct: 0 });
    } catch {
      toast.error("Failed to load search analytics");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (data.terms || []).filter((t) =>
    !q || String(t.query || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
          <FiSearch size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright">Storefront Search Analytics</h2>
          <p className="text-crm-text-dim text-sm">All-time search bar queries · read-only · never deleted</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="crm-card">
          <p className="text-xs text-crm-text-dim uppercase font-bold">Distinct terms</p>
          <p className="text-2xl font-bold text-crm-text-bright tabular-nums">{data.totalDistinct ?? 0}</p>
        </div>
        <div className="crm-card">
          <p className="text-xs text-crm-text-dim uppercase font-bold">Top terms loaded</p>
          <p className="text-2xl font-bold text-crm-text-bright tabular-nums">{(data.terms || []).length}</p>
        </div>
        <div className="crm-card">
          <p className="text-xs text-crm-text-dim uppercase font-bold">Recent searches</p>
          <p className="text-2xl font-bold text-crm-text-bright tabular-nums">{(data.recent || []).length}</p>
        </div>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} className="crm-input max-w-md" placeholder="Filter terms…" />

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 border-b-2 border-crm-primary rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="crm-card overflow-hidden">
            <h3 className="font-bold text-crm-text-bright mb-3 flex items-center gap-2"><FiTrendingUp /> Top search terms</h3>
            <div className="crm-table-container">
              <table className="crm-table text-sm">
                <thead>
                  <tr>
                    <th>Query</th>
                    <th>Count</th>
                    <th>Last searched</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((t) => (
                    <tr key={t.query}>
                      <td className="font-medium">{t.query}</td>
                      <td className="tabular-nums">{t.search_count}</td>
                      <td className="text-crm-text-dim text-xs">{t.last_searched ? format(new Date(t.last_searched), "MMM d, yyyy") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="crm-card">
            <h3 className="font-bold text-crm-text-bright mb-3 flex items-center gap-2"><FiClock /> Recent searches</h3>
            <ul className="space-y-2 max-h-[480px] overflow-y-auto">
              {(data.recent || []).map((r) => (
                <li key={r.id} className="flex justify-between gap-2 text-sm border-b border-crm-border/50 pb-2">
                  <span className="font-medium text-crm-text-bright truncate">{r.query}</span>
                  <span className="text-xs text-crm-text-dim shrink-0">{format(new Date(r.created_at), "MMM d HH:mm")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
