import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch, FiTrendingUp, FiClock, FiAlertCircle } from "react-icons/fi";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

const BASE = "/api/admin/governance";

export default function SearchAnalyticsPage() {
  const toast = useToast();
  const [data, setData] = useState({ terms: [], recent: [], totalDistinct: 0, trend: [], zeroResultTerms: [] });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/search-analytics`);
      setData(res.data || { terms: [], recent: [], totalDistinct: 0, trend: [], zeroResultTerms: [] });
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

  const topTermsChart = useMemo(() =>
    (data.terms || []).slice(0, 12).map((t) => ({
      query: String(t.query || "").slice(0, 20),
      count: Number(t.search_count ?? 0),
    })),
  [data.terms]);

  const trendChart = useMemo(() =>
    (data.trend || []).map((r) => ({
      day: r.day ? format(new Date(r.day), "MMM d") : "",
      searches: Number(r.searches ?? 0),
    })),
  [data.trend]);

  const isEmpty = !loading && (data.totalDistinct ?? 0) === 0 && (data.recent || []).length === 0;

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

      {isEmpty ? (
        <div className="crm-card p-16 text-center space-y-3">
          <FiSearch size={48} className="mx-auto text-crm-text-muted" />
          <p className="text-crm-text-bright font-semibold">No search data yet</p>
          <p className="text-crm-text-dim text-sm max-w-md mx-auto">
            Search logs will appear here once customers use the storefront search bar. Data is retained permanently for analytics.
          </p>
        </div>
      ) : (
        <>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {topTermsChart.length > 0 && (
              <div className="crm-card">
                <h3 className="font-bold text-crm-text-bright mb-4 flex items-center gap-2"><FiTrendingUp /> Top search terms</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topTermsChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                    <XAxis type="number" tick={{ fill: "var(--crm-text-dim)", fontSize: 11 }} />
                    <YAxis type="category" dataKey="query" width={100} tick={{ fill: "var(--crm-text-dim)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "var(--crm-bg-alt)", border: "1px solid var(--crm-border)" }} />
                    <Bar dataKey="count" fill="#1f6feb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {trendChart.length > 0 && (
              <div className="crm-card">
                <h3 className="font-bold text-crm-text-bright mb-4 flex items-center gap-2"><FiClock /> Search volume (30 days)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" />
                    <XAxis dataKey="day" tick={{ fill: "var(--crm-text-dim)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "var(--crm-text-dim)", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "var(--crm-bg-alt)", border: "1px solid var(--crm-border)" }} />
                    <Line type="monotone" dataKey="searches" stroke="#8957e5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {(data.zeroResultTerms || []).length > 0 && (
            <div className="crm-card border-crm-warning/30 bg-crm-warning-dim/20">
              <h3 className="font-bold text-crm-text-bright mb-3 flex items-center gap-2"><FiAlertCircle className="text-crm-warning" /> Zero-result searches</h3>
              <div className="flex flex-wrap gap-2">
                {data.zeroResultTerms.slice(0, 20).map((t) => (
                  <span key={t.query} className="text-xs px-2 py-1 rounded-full bg-crm-bg border border-crm-border text-crm-text-dim">
                    {t.query} ({t.search_count})
                  </span>
                ))}
              </div>
            </div>
          )}

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
        </>
      )}
    </div>
  );
}
