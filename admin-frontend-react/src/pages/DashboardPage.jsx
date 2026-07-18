import React, { useCallback, useEffect, useState } from "react";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  FiTrendingUp, FiTrendingDown, FiShoppingCart, FiUsers,
  FiMessageSquare, FiDollarSign, FiClock, FiPlus,
  FiArrowRight, FiAlertCircle, FiCpu, FiZap, FiBox,
  FiRotateCcw,
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format, subDays, eachDayOfInterval, isValid } from "date-fns";
import { motion } from "framer-motion";

const STATUS_COLORS = {
  pending: "var(--crm-warning)",
  confirmed: "var(--crm-primary)",
  processing: "var(--crm-primary)",
  shipped: "var(--crm-purple)",
  delivered: "var(--crm-success)",
  cancelled: "var(--crm-danger)",
  returned: "var(--crm-danger)",
};

const PIE_COLORS = ["#1f6feb", "#238636", "#d29922", "#da3633", "#8957e5"];

const ACTIVITY_ICONS = {
  order: FiShoppingCart,
  payment: FiDollarSign,
  return: FiRotateCcw,
  ticket: FiMessageSquare,
  customer: FiUsers,
};

function safeFormatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!isValid(d)) return "—";
  try {
    return format(d, "MMM dd, HH:mm");
  } catch {
    return "—";
  }
}

function mapActivityItem(item) {
  return {
    ...item,
    icon: ACTIVITY_ICONS[item.type] || FiClock,
    time: safeFormatTime(item.time),
  };
}

function statusColor(status) {
  const key = String(status || "").toLowerCase();
  return STATUS_COLORS[key] || "var(--crm-text-dim)";
}

export default function DashboardPage({
  onOpenOrder,
  onOpenProduct,
  liveSnapshot,
  liveConnected,
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [salesDays, setSalesDays] = useState(7);
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [loadingMoreActivity, setLoadingMoreActivity] = useState(false);
  const [data, setData] = useState({
    recentOrders: [],
    salesHistory: [],
    statusDist: [],
    activity: [],
    totalRevenue: 0,
    totalOrders: 0,
    confirmedRevenue: 0,
  });

  const buildSalesHistory = useCallback((salesRes, days) => {
    const lastNDays = eachDayOfInterval({
      start: subDays(new Date(), days - 1),
      end: new Date(),
    });
    return lastNDays.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const found = (salesRes?.sales || []).find((d) => d.date === dateStr);
      return {
        name: format(date, "MMM dd"),
        value: found ? Number(found.revenue) : 0,
        orders: found ? Number(found.orders) : 0,
      };
    });
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const settled = await Promise.allSettled([
        adminApi.orders({ limit: 10 }),
        adminApi.salesAnalytics({ days: Math.max(salesDays, 30) }),
        adminApi.orderFunnel(),
        adminApi.activity({ page: 1, limit: 10 }),
        adminApi.overview().catch(() => null),
      ]);
      const [ordersRes, salesRes, funnelRes, activityRes, overviewRes] = settled.map((r) =>
        r.status === "fulfilled" ? r.value : null
      );
      const firstReject = settled.find((r) => r.status === "rejected");
      if (firstReject && firstReject.status === "rejected") {
        const err = firstReject.reason;
        if (settled.every((r) => r.status === "rejected")) {
          toast.error(err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to load dashboard");
        }
      }

      const funnel = funnelRes?.funnel || {};
      const statusDist = Object.entries(funnel)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value: Number(value),
        }))
        .filter((s) => s.value > 0);

      const recentOrders = ordersRes?.orders || [];
      const activity = (activityRes?.items || []).map(mapActivityItem);

      setActivityPage(1);
      setActivityHasMore(Boolean(activityRes?.hasMore));

      setData({
        recentOrders,
        salesHistory: buildSalesHistory(salesRes, salesDays),
        statusDist,
        activity,
        totalRevenue: Number(salesRes?.totalRevenue ?? overviewRes?.totalRevenue ?? 0),
        totalOrders: Number(salesRes?.totalOrders ?? overviewRes?.totalOrders ?? 0),
        confirmedRevenue: Number(salesRes?.confirmedRevenue ?? salesRes?.totalRevenue ?? 0),
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      toast.error(err?.response?.data?.detail || err?.response?.data?.error || err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [buildSalesHistory, salesDays, toast]);

  const loadMoreActivity = useCallback(async () => {
    if (loadingMoreActivity || !activityHasMore) return;
    setLoadingMoreActivity(true);
    try {
      const nextPage = activityPage + 1;
      const activityRes = await adminApi.activity({ page: nextPage, limit: 10 });
      const newItems = (activityRes?.items || []).map(mapActivityItem);
      setData((prev) => ({
        ...prev,
        activity: [...prev.activity, ...newItems],
      }));
      setActivityPage(nextPage);
      setActivityHasMore(Boolean(activityRes?.hasMore) && newItems.length > 0);
      if (newItems.length === 0) {
        setActivityHasMore(false);
      }
    } catch (err) {
      console.error("Activity load more error:", err);
      toast.error(err?.response?.data?.error || "Failed to load more activity");
    } finally {
      setLoadingMoreActivity(false);
    }
  }, [activityPage, activityHasMore, loadingMoreActivity, toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const KPICard = ({ title, value, delta, icon: Icon, color, sparkData, subtitle }) => (
    <div className="crm-card group hover:border-crm-border-strong transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg bg-crm-bg-hover ${color}`}>
          <Icon size={20} />
        </div>
        {typeof delta === "number" && (
          <div className={`flex items-center gap-1 text-xs font-bold ${delta >= 0 ? "text-crm-success" : "text-crm-danger"}`}>
            {delta >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-xs text-crm-text-dim uppercase font-bold tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-crm-text-bright tracking-tight tabular-nums">{value}</p>
        {subtitle && <p className="text-[10px] text-crm-text-muted mt-1">{subtitle}</p>}
      </div>
      {sparkData?.length > 0 && (
        <div className="h-12 mt-4 opacity-50 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <Area
                type="monotone"
                dataKey="v"
                stroke="currentColor"
                fill="currentColor"
                fillOpacity={0.1}
                className={color}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  const revenue = Number(liveSnapshot?.totalRevenue ?? data.totalRevenue ?? 0);
  const ordersCount = Number(liveSnapshot?.totalOrders ?? data.totalOrders ?? 0);
  const customersCount = Number(liveSnapshot?.totalUsers ?? 0);
  const pendingCount = Number(liveSnapshot?.pendingOrders ?? 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Executive Dashboard</h2>
          <p className="text-crm-text-dim text-sm flex items-center gap-2">
            Real-time business performance overview
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${liveConnected ? "text-crm-success" : "text-crm-text-muted"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${liveConnected ? "bg-crm-success" : "bg-crm-text-muted"}`} />
              {liveConnected ? "Live" : "Polling"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="crm-btn" onClick={() => fetchDashboardData()}>
            <FiClock /> Refresh
          </button>
          <button type="button" className="crm-btn crm-btn-primary" onClick={() => onOpenProduct?.("")}>
            <FiPlus /> Create Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Revenue (30d)"
          value={`৳${revenue.toLocaleString()}`}
          icon={FiDollarSign}
          color="text-crm-success"
          sparkData={data.salesHistory.map((s) => ({ v: s.value }))}
          subtitle={data.confirmedRevenue != null ? `Confirmed paid: ৳${Number(data.confirmedRevenue).toLocaleString()}` : undefined}
        />
        <KPICard
          title="Orders (30d)"
          value={ordersCount.toLocaleString()}
          icon={FiShoppingCart}
          color="text-crm-primary"
          sparkData={data.salesHistory.map((s) => ({ v: s.orders }))}
        />
        <KPICard
          title="Customers"
          value={customersCount.toLocaleString()}
          icon={FiUsers}
          color="text-crm-purple"
        />
        <KPICard
          title="Pending Orders"
          value={pendingCount.toLocaleString()}
          icon={FiClock}
          color="text-crm-warning"
        />
      </div>

      <AiInsightsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 crm-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-crm-text-bright">Sales Performance</h3>
            <select
              className="crm-input w-auto h-8 py-0 text-xs"
              value={salesDays}
              onChange={(e) => setSalesDays(Number(e.target.value))}
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
          <div className="h-80">
            {data.salesHistory.every((s) => s.value === 0) ? (
              <div className="h-full flex items-center justify-center text-sm text-crm-text-dim">
                No sales data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.salesHistory}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--crm-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--crm-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--crm-text-dim)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="var(--crm-text-dim)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `৳${v}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--crm-bg-card)", borderColor: "var(--crm-border)", color: "var(--crm-text-bright)" }}
                    itemStyle={{ color: "var(--crm-primary)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--crm-primary)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="crm-card">
          <h3 className="font-bold text-crm-text-bright mb-6">Order Distribution</h3>
          {data.statusDist.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-crm-text-dim">No orders yet</div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.statusDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {data.statusDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {data.statusDist.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="text-crm-text-dim">{entry.name}</span>
                    </div>
                    <span className="font-bold text-crm-text-bright">{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 crm-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-crm-text-bright">Recent Orders</h3>
            <button
              type="button"
              className="text-crm-primary hover:underline text-sm font-medium flex items-center gap-1"
              onClick={() => onOpenOrder?.("")}
            >
              View All <FiArrowRight />
            </button>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-crm-text-dim py-8 text-center">No recent orders</p>
          ) : (
            <div className="crm-table-container overflow-x-auto md:table">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentOrders.map((order) => {
                    const color = statusColor(order.status);
                    return (
                      <tr key={order.id} className="cursor-pointer" onClick={() => onOpenOrder?.(order.id)}>
                        <td className="font-bold text-crm-primary">
                          #{String(order.orderNumber || order.id || "").slice(-8).toUpperCase()}
                        </td>
                        <td>{order.user?.name || order.customer?.name || "Guest"}</td>
                        <td className="font-bold tabular-nums">৳{Number(order.total || 0).toLocaleString()}</td>
                        <td>
                          <span
                            className="crm-badge capitalize"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                              color,
                              borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                            }}
                          >
                            {order.status || "—"}
                          </span>
                        </td>
                        <td className="text-crm-text-dim">{safeFormatTime(order.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="crm-card">
          <h3 className="font-bold text-crm-text-bright mb-6">Activity Feed</h3>
          {data.activity.length === 0 ? (
            <p className="text-sm text-crm-text-dim py-8 text-center">No recent activity</p>
          ) : (
            <div className="space-y-6">
              {data.activity.map((item) => {
                const Icon = item.icon || FiClock;
                return (
                  <div key={item.id} className="flex gap-4">
                    <div className={`shrink-0 w-8 h-8 rounded-full bg-crm-bg-hover flex items-center justify-center ${item.color || ""}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-crm-text-bright font-medium leading-tight mb-1">{item.text}</p>
                      <div className="flex items-center gap-2 text-[10px] text-crm-text-muted font-bold uppercase tracking-wider">
                        <FiClock size={10} /> {item.time}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className="w-full mt-8 crm-btn text-xs disabled:opacity-50"
            onClick={loadMoreActivity}
            disabled={!activityHasMore || loadingMoreActivity || data.activity.length === 0}
          >
            {loadingMoreActivity ? "Loading…" : activityHasMore ? "Load More Activity" : "No More Activity"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AiInsightsPanel() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    adminApi
      .intelInsights()
      .then((d) => {
        if (active) setInsights(d);
      })
      .catch(() => {
        if (active) setInsights(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="crm-card flex items-center gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-crm-primary" />
        <span className="text-crm-text-dim text-sm">Loading AI insights…</span>
      </div>
    );
  }
  if (!insights) return null;

  const atRisk = insights.atRiskCustomers || [];
  const restock = insights.restockSuggestions || [];
  const topSegment = (insights.segments || []).slice().sort((a, b) => b.customers - a.customers)[0];

  return (
    <div className="crm-card border-l-2 border-crm-primary">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-bold text-crm-text-bright flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-crm-primary-dim text-crm-primary">
            <FiCpu size={16} />
          </span>
          AI Insights
        </h3>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-crm-bg-hover text-crm-text-dim">
          {insights.mlConfigured ? "ML active" : "Heuristic mode"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg bg-crm-bg-hover p-4">
          <div className="flex items-center gap-2 text-crm-success mb-1">
            <FiZap size={14} />
            <span className="text-xs font-bold uppercase tracking-wide">Forecast (7d)</span>
          </div>
          <p className="text-xl font-bold text-crm-text-bright tabular-nums">
            ৳{Number(insights.forecastNext7Days || 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-crm-text-dim">{insights.forecastMethod}</p>
        </div>
        <div className="rounded-lg bg-crm-bg-hover p-4">
          <div className="flex items-center gap-2 text-crm-danger mb-1">
            <FiAlertCircle size={14} />
            <span className="text-xs font-bold uppercase tracking-wide">At-risk customers</span>
          </div>
          <p className="text-xl font-bold text-crm-text-bright tabular-nums">{atRisk.length}</p>
          <p className="text-[11px] text-crm-text-dim truncate">
            {atRisk[0]?.name ? `Top: ${atRisk[0].name}` : "None flagged"}
          </p>
        </div>
        <div className="rounded-lg bg-crm-bg-hover p-4">
          <div className="flex items-center gap-2 text-crm-warning mb-1">
            <FiBox size={14} />
            <span className="text-xs font-bold uppercase tracking-wide">Restock alerts</span>
          </div>
          <p className="text-xl font-bold text-crm-text-bright tabular-nums">{restock.length}</p>
          <p className="text-[11px] text-crm-text-dim truncate">
            {restock[0]?.title ? restock[0].title : "Inventory healthy"}
          </p>
        </div>
        <div className="rounded-lg bg-crm-bg-hover p-4">
          <div className="flex items-center gap-2 text-crm-primary mb-1">
            <FiUsers size={14} />
            <span className="text-xs font-bold uppercase tracking-wide">Top segment</span>
          </div>
          <p className="text-xl font-bold text-crm-text-bright capitalize">{topSegment?.segment || "—"}</p>
          <p className="text-[11px] text-crm-text-dim">
            {topSegment ? `${topSegment.customers} customers` : "No segments"}
          </p>
        </div>
      </div>
    </div>
  );
}
