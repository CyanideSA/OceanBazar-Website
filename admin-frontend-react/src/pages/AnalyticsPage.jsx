import React, { useState, useEffect, useCallback } from "react";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, ComposedChart
} from "recharts";
import { 
  FiBarChart2, FiTrendingUp, FiUsers, FiBox, 
  FiActivity, FiDownload, FiFilter, FiCalendar 
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format, subDays, eachDayOfInterval } from "date-fns";

const COLORS = ["#1f6feb", "#238636", "#d29922", "#da3633", "#8957e5", "#39c5cf"];

const TABS = [
  { id: "sales", label: "Sales & Revenue", icon: FiTrendingUp },
  { id: "customers", label: "Customers", icon: FiUsers },
  { id: "products", label: "Products", icon: FiBox },
  { id: "categories", label: "Categories", icon: FiBarChart2 },
  { id: "conversion", label: "Conversion", icon: FiActivity },
];

export default function AnalyticsPage({ liveTick = 0 }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("sales");
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [data, setData] = useState({
    sales: [],
    categories: [],
    customers: [],
    products: [],
    funnel: {},
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0,
  });
  const [googleInsights, setGoogleInsights] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, customerRes, topProductsRes, catRes, funnelRes, googleRes] = await Promise.all([
        adminApi.salesAnalytics(),
        adminApi.customerGrowth(),
        adminApi.topProducts({ limit: 10 }),
        adminApi.categoryRevenue(),
        adminApi.orderFunnel(),
        adminApi.googleAnalyticsInsights({ days: 7 }).catch(() => null),
      ]);
      setGoogleInsights(googleRes);

      const last30Days = eachDayOfInterval({
        start: subDays(new Date(), 29),
        end: new Date()
      });

      const processedSales = last30Days.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const found = (salesRes?.sales || []).find(d => d.date === dateStr);
        return {
          date: format(date, "MMM dd"),
          revenue: found ? Number(found.revenue) : 0,
          orders: found ? Number(found.orders) : 0,
          profit: found ? Number(found.revenue) * 0.2 : 0
        };
      });

      const processedCustomers = last30Days.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const found = (customerRes?.growth || []).find(d => d.date === dateStr);
        return {
          date: format(date, "MMM dd"),
          new: found ? Number(found.newUsers) : 0,
          returning: 0
        };
      });

      const processedProducts = (topProductsRes?.topProducts || []).map(tp => ({
        name: tp.product?.titleEn || tp.productId,
        sales: tp.totalSold || 0,
        revenue: Number(tp.totalRevenue || 0),
        stock: tp.product?.stock ?? 0,
      }));

      const rawCategories = catRes?.categories || [];
      const processedCategories = rawCategories.length > 0
        ? rawCategories
        : [{ name: 'No orders yet', value: 1 }];

      setData({
        sales: processedSales,
        categories: processedCategories,
        customers: processedCustomers,
        products: processedProducts,
        funnel: funnelRes?.funnel || {},
        totalRevenue: salesRes?.totalRevenue || 0,
        totalOrders: salesRes?.totalOrders || 0,
        totalUsers: customerRes?.totalUsers || 0,
      });
    } catch (err) {
      console.error("Analytics fetch error:", err);
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Auto-refresh when live events arrive (orders/payments)
  useEffect(() => {
    if (liveTick > 0) {
      fetchAnalytics();
      setLastRefreshed(new Date());
    }
  }, [liveTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const downloadCSV = (filename, headers, csvRows) => {
    const csv = [headers, ...csvRows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const exportAnalytics = () => {
    const tabMap = {
      sales:      { headers: ['Date', 'Revenue (BDT)', 'Orders', 'Profit (BDT)'], rows: data.sales.map(r => [r.date, r.revenue, r.orders, r.profit]) },
      customers:  { headers: ['Date', 'New Customers', 'Returning'], rows: data.customers.map(r => [r.date, r.new, r.returning]) },
      products:   { headers: ['Product', 'Units Sold', 'Revenue (BDT)'], rows: data.products.map(r => [r.name, r.sales, r.revenue]) },
      categories: { headers: ['Category', 'Revenue (BDT)', 'Share (%)'], rows: data.categories.map(r => [r.name, r.value, r.percent ?? '']) },
      conversion: { headers: ['Date', 'Revenue (BDT)', 'Orders', 'Profit (BDT)'], rows: data.sales.map(r => [r.date, r.revenue, r.orders, r.profit]) },
    };
    const { headers, rows } = tabMap[activeTab] || tabMap.sales;
    downloadCSV(`analytics-${activeTab}`, headers, rows);
    toast.success(`Analytics data exported`);
  };

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all font-medium text-sm ${
        activeTab === id 
          ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
          : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Business Intelligence</h2>
          <p className="text-crm-text-dim text-sm">Deep dive into OceanBazar's performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn">
            <FiCalendar /> Last 30 Days
          </button>
          <button className="crm-btn" onClick={exportAnalytics}>
            <FiDownload /> Export
          </button>
          <button className="crm-btn" onClick={() => { fetchAnalytics(); setLastRefreshed(new Date()); }} title="Refresh now">
            <FiActivity size={14} className={loading ? 'animate-pulse' : ''} />
            {lastRefreshed ? `Updated ${format(lastRefreshed, 'HH:mm:ss')}` : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="crm-card p-0 overflow-hidden flex flex-wrap border-b-0 rounded-b-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all font-medium text-sm ${
              activeTab === tab.id 
                ? 'border-crm-primary text-crm-primary bg-crm-primary-dim' 
                : 'border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="crm-card rounded-t-none border-t-0 p-6 min-h-[600px]">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-crm-primary"></div>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {activeTab === "sales" && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 crm-card bg-crm-bg border-none shadow-none">
                    <h3 className="font-bold text-crm-text-bright mb-6">Revenue vs Profit Trend</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data.sales}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" vertical={false} />
                          <XAxis dataKey="date" stroke="var(--crm-text-dim)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--crm-text-dim)" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: "var(--crm-bg-card)", borderColor: "var(--crm-border)" }} />
                          <Legend />
                          <Area type="monotone" dataKey="revenue" fill="var(--crm-primary-dim)" stroke="var(--crm-primary)" strokeWidth={2} />
                          <Line type="monotone" dataKey="profit" stroke="var(--crm-success)" strokeWidth={2} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="crm-card bg-crm-bg-hover border-none">
                      <p className="text-xs text-crm-text-dim uppercase font-bold mb-1">Total Revenue</p>
                      <p className="text-2xl font-bold text-crm-text-bright">৳{Number(data.totalRevenue || 0).toLocaleString()}</p>
                    </div>
                    <div className="crm-card bg-crm-bg-hover border-none">
                      <p className="text-xs text-crm-text-dim uppercase font-bold mb-1">Total Orders</p>
                      <p className="text-2xl font-bold text-crm-success">{Number(data.totalOrders || 0).toLocaleString()}</p>
                    </div>
                    <div className="crm-card bg-crm-bg-hover border-none">
                      <p className="text-xs text-crm-text-dim uppercase font-bold mb-1">Avg. Order Value</p>
                      <p className="text-2xl font-bold text-crm-cyan">৳{(data.sales.reduce((a, b) => a + b.revenue, 0) / data.sales.reduce((a, b) => a + b.orders, 0) || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="crm-card bg-crm-bg border-none shadow-none">
                  <h3 className="font-bold text-crm-text-bright mb-6">Daily Orders</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.sales}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" vertical={false} />
                        <XAxis dataKey="date" stroke="var(--crm-text-dim)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--crm-text-dim)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: "var(--crm-bg-card)", borderColor: "var(--crm-border)" }} />
                        <Bar dataKey="orders" fill="var(--crm-purple)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {activeTab === "customers" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="crm-card bg-crm-bg border-none">
                  <h3 className="font-bold text-crm-text-bright mb-6">User Acquisition</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.customers}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" vertical={false} />
                        <XAxis dataKey="date" stroke="var(--crm-text-dim)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--crm-text-dim)" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="new" stackId="1" stroke="var(--crm-primary)" fill="var(--crm-primary-dim)" />
                        <Area type="monotone" dataKey="returning" stackId="1" stroke="var(--crm-success)" fill="var(--crm-success-dim)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="crm-card bg-crm-bg border-none">
                  <h3 className="font-bold text-crm-text-bright mb-6">Customer Overview</h3>
                  <div className="flex flex-col justify-center h-80 text-center">
                    <div className="text-6xl font-bold text-crm-purple mb-2">{Number(data.totalUsers || 0).toLocaleString()}</div>
                    <p className="text-crm-text-dim">Total registered customers</p>
                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="p-4 bg-crm-bg-hover rounded-lg">
                        <p className="text-xs font-bold text-crm-text-dim uppercase">New (30d)</p>
                        <p className="text-xl font-bold text-crm-success">{data.customers.reduce((s, d) => s + d.new, 0).toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-crm-bg-hover rounded-lg">
                        <p className="text-xs font-bold text-crm-text-dim uppercase">Total Orders</p>
                        <p className="text-xl font-bold text-crm-primary">{Number(data.totalOrders || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "products" && (
              <div className="space-y-6">
                <div className="crm-card bg-crm-bg border-none">
                  <h3 className="font-bold text-crm-text-bright mb-6">Top Products by Revenue</h3>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.products} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" horizontal={false} />
                        <XAxis type="number" stroke="var(--crm-text-dim)" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" stroke="var(--crm-text-dim)" fontSize={12} tickLine={false} axisLine={false} width={150} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="var(--crm-cyan)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="crm-table-container overflow-x-auto">
                  <table className="crm-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Units Sold</th>
                        <th>Revenue</th>
                        <th>Inventory Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.products.length === 0 ? (
                        <tr><td colSpan="4" className="text-center py-8 text-crm-text-dim">No sales data yet</td></tr>
                      ) : data.products.map((p, i) => (
                        <tr key={i}>
                          <td className="font-medium text-crm-text-bright">{p.name}</td>
                          <td>{p.sales.toLocaleString()}</td>
                          <td className="font-bold">৳{Number(p.revenue).toLocaleString()}</td>
                          <td><span className={`crm-badge ${p.stock > 0 ? 'crm-badge-success' : 'crm-badge-danger'}`}>{p.stock > 0 ? 'In Stock' : 'Out of Stock'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "categories" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="crm-card bg-crm-bg border-none">
                  <h3 className="font-bold text-crm-text-bright mb-6">Category Distribution</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.categories}
                          innerRadius={80}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {data.categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-4">
                  {data.categories.map((cat, i) => (
                    <div key={i} className="crm-card bg-crm-bg-hover border-none flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        <span className="font-medium text-crm-text-bright">{cat.name}</span>
                      </div>
                      <span className="font-bold">৳{cat.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "conversion" && (
              <div className="max-w-2xl mx-auto space-y-8">
                <h3 className="font-bold text-crm-text-bright text-center mb-8">Order Status Funnel (Live DB)</h3>
                {(() => {
                  const f = data.funnel;
                  const total = Math.max(1, Object.values(f).reduce((s, v) => s + Number(v), 0));
                  const steps = [
                    { label: 'Pending', key: 'pending', color: 'bg-crm-warning' },
                    { label: 'Confirmed', key: 'confirmed', color: 'bg-crm-primary' },
                    { label: 'Processing', key: 'processing', color: 'bg-crm-purple' },
                    { label: 'Shipped', key: 'shipped', color: 'bg-crm-cyan' },
                    { label: 'Delivered', key: 'delivered', color: 'bg-crm-success' },
                    { label: 'Cancelled', key: 'cancelled', color: 'bg-crm-danger' },
                    { label: 'Returned', key: 'returned', color: 'bg-crm-text-dim' },
                  ];
                  return steps.map((step) => {
                    const count = Number(f[step.key] || 0);
                    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={step.key} className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-crm-text-bright">{step.label}</span>
                          <span className="text-sm font-bold text-crm-text-dim">{count.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="h-4 bg-crm-bg-hover rounded-full overflow-hidden">
                          <div className={`h-full ${step.color} transition-all`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {googleInsights?.configured && (
        <div className="crm-card p-6 border-crm-border space-y-4 mt-6">
          <h3 className="text-lg font-bold text-crm-text-bright">Website Analytics (Google GA4 + Search Console)</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-crm-bg-alt border border-crm-border">
              <p className="text-xs text-crm-text-dim uppercase">Sessions (7d)</p>
              <p className="text-2xl font-bold text-crm-text-bright">{googleInsights?.overview?.sessions?.toLocaleString() || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-crm-bg-alt border border-crm-border">
              <p className="text-xs text-crm-text-dim uppercase">Users (7d)</p>
              <p className="text-2xl font-bold text-crm-text-bright">{googleInsights?.overview?.users?.toLocaleString() || 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-crm-bg-alt border border-crm-border">
              <p className="text-xs text-crm-text-dim uppercase">Page views (7d)</p>
              <p className="text-2xl font-bold text-crm-text-bright">{googleInsights?.overview?.pageViews?.toLocaleString() || 0}</p>
            </div>
          </div>
          {googleInsights?.searchQueries?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-crm-text-bright mb-2">Top search queries</p>
              <ul className="text-sm space-y-1 text-crm-text-dim">
                {googleInsights.searchQueries.slice(0, 8).map((q) => (
                  <li key={q.query} className="flex justify-between border-b border-crm-border/50 py-1">
                    <span>{q.query}</span>
                    <span>{q.clicks} clicks</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
