import React, { useState, useEffect, useCallback } from "react";
import {
  FiActivity, FiTrendingUp, FiTrendingDown, FiRefreshCw,
  FiBarChart2, FiUsers, FiTarget, FiAward
} from "react-icons/fi";
import { adminApi, api } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { motion, AnimatePresence } from "framer-motion";

const VARIANT_COLORS = {
  A: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", bar: "bg-blue-500" },
  B: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30", bar: "bg-violet-500" },
};

function WinnerBadge({ winner }) {
  if (!winner) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
      <FiAward size={10} /> Winner
    </span>
  );
}

function VariantCard({ variant, data, isWinner }) {
  const colors = VARIANT_COLORS[variant] || VARIANT_COLORS.A;
  const rate = parseFloat(data?.rate ?? "0") || 0;

  return (
    <div className={`rounded-xl border p-4 ${colors.border} ${colors.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-black ${colors.text}`}>Variant {variant}</span>
          <WinnerBadge winner={isWinner} />
        </div>
        <span className={`text-3xl font-black ${colors.text}`}>{data?.rate ?? "0%"}</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-crm-text-dim">
          <span>Impressions</span>
          <span className="font-bold text-crm-text-bright">{(data?.impressions ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-xs text-crm-text-dim">
          <span>Conversions</span>
          <span className="font-bold text-crm-text-bright">{(data?.conversions ?? 0).toLocaleString()}</span>
        </div>
        {/* Conversion rate bar */}
        <div className="mt-2 h-2 w-full rounded-full bg-crm-bg-hover overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${colors.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(rate, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}

function TestCard({ testId, data }) {
  const A = data?.A;
  const B = data?.B;
  const rateA = parseFloat(A?.rate ?? "0") || 0;
  const rateB = parseFloat(B?.rate ?? "0") || 0;
  const winner = rateA > rateB ? "A" : rateB > rateA ? "B" : null;
  const totalImpressions = (A?.impressions ?? 0) + (B?.impressions ?? 0);
  const totalConversions = (A?.conversions ?? 0) + (B?.conversions ?? 0);
  const liftPct = rateA > 0 ? (((rateB - rateA) / rateA) * 100).toFixed(1) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="crm-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-crm-border">
        <div>
          <h3 className="font-bold text-crm-text-bright text-base">{testId}</h3>
          <p className="text-xs text-crm-text-dim mt-0.5">
            {totalImpressions.toLocaleString()} total impressions · {totalConversions.toLocaleString()} conversions
          </p>
        </div>
        {liftPct !== null && (
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold border ${
            parseFloat(liftPct) >= 0
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-red-500/10 text-red-400 border-red-500/30"
          }`}>
            {parseFloat(liftPct) >= 0 ? <FiTrendingUp size={14} /> : <FiTrendingDown size={14} />}
            {liftPct}% lift (B vs A)
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
        <VariantCard variant="A" data={A} isWinner={winner === "A"} />
        <VariantCard variant="B" data={B} isWinner={winner === "B"} />
      </div>

      {/* No data message */}
      {!A && !B && (
        <div className="p-8 text-center text-crm-text-dim">
          <FiBarChart2 size={32} className="mx-auto mb-3 opacity-20" />
          <p>No data yet — test is running</p>
        </div>
      )}
    </motion.div>
  );
}

export default function ABTestsPage() {
  const toast = useToast();
  const [tests, setTests] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/ab/stats").then((r) => r.data);
      setTests(res?.tests ?? {});
      setLastRefresh(new Date());
    } catch {
      toast.error("Failed to load A/B test stats");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const testIds = Object.keys(tests);
  const totalImpressions = testIds.reduce((sum, id) => {
    return sum + (tests[id]?.A?.impressions ?? 0) + (tests[id]?.B?.impressions ?? 0);
  }, 0);
  const totalConversions = testIds.reduce((sum, id) => {
    return sum + (tests[id]?.A?.conversions ?? 0) + (tests[id]?.B?.conversions ?? 0);
  }, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
            <FiActivity size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">A/B Tests</h2>
            <p className="text-crm-text-dim text-sm">
              Live experiment results · {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "Loading..."}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="crm-btn crm-btn-primary"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Tests", value: testIds.length, icon: FiTarget },
          { label: "Total Impressions", value: totalImpressions.toLocaleString(), icon: FiUsers },
          { label: "Total Conversions", value: totalConversions.toLocaleString(), icon: FiTrendingUp },
        ].map((s) => (
          <div key={s.label} className="crm-card p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-crm-primary-dim text-crm-primary">
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-xl font-black text-crm-text-bright">{s.value}</p>
              <p className="text-xs text-crm-text-dim">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Test cards */}
      {loading ? (
        <div className="crm-card p-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" />
        </div>
      ) : testIds.length === 0 ? (
        <div className="crm-card p-16 text-center text-crm-text-dim">
          <FiBarChart2 size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-crm-text-bright mb-1">No experiments yet</p>
          <p className="text-sm">Once your storefront renders A/B test components, data will appear here.</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-4">
            {testIds.map((id) => (
              <TestCard key={id} testId={id} data={tests[id]} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
