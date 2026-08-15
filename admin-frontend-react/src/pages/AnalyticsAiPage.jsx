import React, { useCallback, useEffect, useState } from "react";
import {
  ComposedChart, Area, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { FiTrendingUp, FiRefreshCw, FiBox, FiShoppingCart, FiZap } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";

function money(n) {
  return "৳" + Number(n || 0).toLocaleString();
}

const HORIZONS = [7, 14, 30, 60];

export default function AnalyticsAiPage() {
  const toast = useToast();
  const [horizon, setHorizon] = useState(30);
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [restock, setRestock] = useState([]);
  const [abandoned, setAbandoned] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, c, r, a] = await Promise.all([
        adminApi.intelForecast({ days: horizon }),
        adminApi.intelCohorts(),
        adminApi.intelRestock(),
        adminApi.intelAbandonedCarts(),
      ]);
      setForecast(f);
      setCohorts(c?.cohorts || []);
      setRestock(r?.products || []);
      setAbandoned(a?.carts || []);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [horizon, toast]);

  useEffect(() => { load(); }, [load]);

  const forecastData = (forecast?.points || []).map((p) => ({
    date: p.date?.slice(5),
    predicted: p.predicted_revenue,
    range: [p.lower, p.upper],
    lower: p.lower,
    upper: p.upper,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiTrendingUp size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright">AI Analytics</h2>
            <p className="text-crm-text-dim text-sm">Predictive sales forecast, cohorts &amp; demand intelligence</p>
          </div>
        </div>
        <button onClick={load} className="crm-btn flex items-center gap-2 text-sm"><FiRefreshCw size={14} /> Refresh</button>
      </div>

      {loading && <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-crm-primary rounded-full" /></div>}

      {!loading && (
        <>
          <div className="crm-card">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-bold text-crm-text-bright flex items-center gap-2"><FiZap className="text-crm-primary" /> Sales Forecast</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-crm-text-dim">
                  {forecast?.method} · {money(forecast?.total_predicted)} predicted
                </span>
                <div className="flex gap-1">
                  {HORIZONS.map((h) => (
                    <button key={h} onClick={() => setHorizon(h)}
                      className={`px-2 py-1 text-xs rounded ${horizon === h ? "bg-crm-primary text-white" : "bg-crm-bg-card text-crm-text-dim hover:text-crm-text-bright"}`}>
                      {h}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => money(v)} />
                <Area type="monotone" dataKey="upper" stroke="none" fill="#6366f1" fillOpacity={0.12} />
                <Area type="monotone" dataKey="lower" stroke="none" fill="#0f172a" fillOpacity={0} />
                <Line type="monotone" dataKey="predicted" stroke="#6366f1" strokeWidth={2} dot={false} name="Predicted revenue" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="crm-card">
            <h3 className="font-bold text-crm-text-bright mb-4 flex items-center gap-2"><FiTrendingUp className="text-crm-primary" /> Signup Cohorts &amp; Conversion</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cohorts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="cohort" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="customers" fill="#6366f1" name="New customers" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="purchasers" fill="#22c55e" name="Purchasers" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="conversionRate" stroke="#f59e0b" name="Conversion %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="crm-card overflow-hidden">
              <h3 className="font-bold text-crm-text-bright mb-3 flex items-center gap-2"><FiBox className="text-crm-primary" /> Restock Suggestions</h3>
              <div className="crm-table-container max-h-80 overflow-y-auto">
                <table className="crm-table text-sm">
                  <thead><tr><th>Product</th><th>Stock</th><th>Demand</th><th>Daily rate</th></tr></thead>
                  <tbody>
                    {restock.map((p) => (
                      <tr key={p.productId}>
                        <td className="font-medium">{p.title}</td>
                        <td className={`tabular-nums ${p.stock <= 10 ? "text-crm-danger font-bold" : ""}`}>{p.stock}</td>
                        <td className="tabular-nums">{p.demandScore.toFixed(0)}</td>
                        <td className="tabular-nums text-crm-text-dim">{p.dailyRate.toFixed(1)}/day</td>
                      </tr>
                    ))}
                    {restock.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-crm-text-dim">No demand predictions — run recompute in CRM Intelligence</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="crm-card overflow-hidden">
              <h3 className="font-bold text-crm-text-bright mb-3 flex items-center gap-2"><FiShoppingCart className="text-crm-primary" /> Recent Abandoned Carts</h3>
              <div className="crm-table-container max-h-80 overflow-y-auto">
                <table className="crm-table text-sm">
                  <thead><tr><th>Customer</th><th>Reminder</th><th>Sent</th></tr></thead>
                  <tbody>
                    {abandoned.map((c) => (
                      <tr key={c.id}>
                        <td><div className="font-medium">{c.name}</div><div className="text-xs text-crm-text-dim">{c.email}</div></td>
                        <td><span className="text-xs px-2 py-0.5 rounded-full bg-crm-warning-dim/40 text-crm-warning">{c.reminderType}</span></td>
                        <td className="text-xs text-crm-text-dim">{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                    {abandoned.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-crm-text-dim">No abandoned carts</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
