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
import { format, subDays, eachDayOfInterval } from "date-fns";

const COLORS = ["#1f6feb", "#238636", "#d29922", "#da3633", "#8957e5", "#39c5cf"];

const TABS = [
  { id: "sales", label: "Sales & Revenue", icon: FiTrendingUp },
  { id: "customers", label: "Customers", icon: FiUsers },
  { id: "products", label: "Products", icon: FiBox },
  { id: "categories", label: "Categories", icon: FiBarChart2 },
  { id: "conversion", label: "Conversion", icon: FiActivity },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("sales");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    sales: [],
    categories: [],
    customers: [],
    products: []
  });

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.salesAnalytics();
      
      const last30Days = eachDayOfInterval({
        start: subDays(new Date(), 29),
        end: new Date()
      });

      const processedSales = last30Days.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const found = (res?.daily || []).find(d => d.date === dateStr);
        return {
          date: format(date, "MMM dd"),
          revenue: found ? Number(found.total) : 0,
          orders: found ? Number(found.count) : 0,
          profit: found ? Number(found.total) * 0.2 : 0 // Mock profit
        };
      });

      setData({
        sales: processedSales,
        categories: [
          { name: "Electronics", value: 45000 },
          { name: "Fashion", value: 32000 },
          { name: "Home & Kitchen", value: 28000 },
          { name: "Beauty", value: 15000 },
          { name: "Sports", value: 12000 },
        ],
        customers: processedSales.map(s => ({
          date: s.date,
          new: Math.floor(Math.random() * 50) + 10,
          returning: Math.floor(Math.random() * 30) + 5
        })),
        products: [
          { name: "Gaming Mouse", sales: 120, revenue: 24000 },
          { name: "Mechanical Keyboard", sales: 85, revenue: 42500 },
          { name: "USB-C Hub", sales: 210, revenue: 10500 },
          { name: "Wireless Headphones", sales: 64, revenue: 32000 },
          { name: "Laptop Stand", sales: 45, revenue: 9000 },
        ]
      });
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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
          <button className="crm-btn">
            <FiDownload /> Export
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
                      <p className="text-2xl font-bold text-crm-text-bright">৳{data.sales.reduce((a, b) => a + b.revenue, 0).toLocaleString()}</p>
                    </div>
                    <div className="crm-card bg-crm-bg-hover border-none">
                      <p className="text-xs text-crm-text-dim uppercase font-bold mb-1">Total Profit (est)</p>
                      <p className="text-2xl font-bold text-crm-success">৳{data.sales.reduce((a, b) => a + b.profit, 0).toLocaleString()}</p>
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
                  <h3 className="font-bold text-crm-text-bright mb-6">Retention Rate</h3>
                  <div className="flex flex-col justify-center h-80 text-center">
                    <div className="text-6xl font-bold text-crm-purple mb-2">72%</div>
                    <p className="text-crm-text-dim">Customer retention rate this month</p>
                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="p-4 bg-crm-bg-hover rounded-lg">
                        <p className="text-xs font-bold text-crm-text-dim uppercase">Churn Rate</p>
                        <p className="text-xl font-bold text-crm-danger">5.2%</p>
                      </div>
                      <div className="p-4 bg-crm-bg-hover rounded-lg">
                        <p className="text-xs font-bold text-crm-text-dim uppercase">LTV (Avg)</p>
                        <p className="text-xl font-bold text-crm-success">৳12,450</p>
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
                      {data.products.map((p, i) => (
                        <tr key={i}>
                          <td className="font-medium text-crm-text-bright">{p.name}</td>
                          <td>{p.sales}</td>
                          <td className="font-bold">৳{p.revenue.toLocaleString()}</td>
                          <td><span className="crm-badge crm-badge-success">In Stock</span></td>
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
              <div className="max-w-2xl mx-auto space-y-12">
                <h3 className="font-bold text-crm-text-bright text-center mb-8">Sales Funnel</h3>
                {[
                  { label: "Website Visits", value: "45,200", percent: "100%", color: "bg-crm-primary" },
                  { label: "Product Views", value: "12,400", percent: "27.4%", color: "bg-crm-purple" },
                  { label: "Add to Cart", value: "3,120", percent: "6.9%", color: "bg-crm-cyan" },
                  { label: "Checkout Start", value: "1,850", percent: "4.1%", color: "bg-crm-warning" },
                  { label: "Successful Orders", value: "1,482", percent: "3.2%", color: "bg-crm-success" },
                ].map((step, i) => (
                  <div key={i} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-crm-text-bright">{step.label}</span>
                      <span className="text-sm font-bold text-crm-text-dim">{step.value} ({step.percent})</span>
                    </div>
                    <div className="h-4 bg-crm-bg-hover rounded-full overflow-hidden">
                      <div className={`h-full ${step.color}`} style={{ width: step.percent }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
