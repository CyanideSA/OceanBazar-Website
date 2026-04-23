import React, { useCallback, useEffect, useState, useMemo } from "react";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from "recharts";
import { 
  FiTrendingUp, FiTrendingDown, FiShoppingCart, FiUsers, 
  FiMessageSquare, FiDollarSign, FiClock, FiPlus, 
  FiArrowRight, FiCheckCircle, FiAlertCircle 
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { motion } from "framer-motion";

const STATUS_COLORS = {
  PENDING: "var(--crm-warning)",
  PROCESSING: "var(--crm-primary)",
  SHIPPED: "var(--crm-purple)",
  DELIVERED: "var(--crm-success)",
  CANCELLED: "var(--crm-danger)",
};

const PIE_COLORS = ["#1f6feb", "#238636", "#d29922", "#da3633", "#8957e5"];

export default function DashboardPage({ 
  onOpenOrder, 
  onOpenProduct, 
  liveSnapshot, 
  liveConnected 
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    recentOrders: [],
    salesHistory: [],
    statusDist: [],
    activity: []
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      const [ordersRes, salesRes] = await Promise.all([
        adminApi.orders({ limit: 10 }),
        adminApi.salesAnalytics()
      ]);

      // Process sales data for chart
      const last7Days = eachDayOfInterval({
        start: subDays(new Date(), 6),
        end: new Date()
      });

      const chartData = last7Days.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const found = (salesRes?.daily || []).find(d => d.date === dateStr);
        return {
          name: format(date, "MMM dd"),
          value: found ? Number(found.total) : 0,
          orders: found ? Number(found.count) : 0
        };
      });

      // Mock status distribution
      const statusDist = [
        { name: "Pending", value: 45 },
        { name: "Delivered", value: 120 },
        { name: "Processing", value: 30 },
        { name: "Cancelled", value: 12 },
        { name: "Shipped", value: 25 },
      ];

      setData({
        recentOrders: ordersRes?.orders || [],
        salesHistory: chartData,
        statusDist,
        activity: [
          { id: 1, type: "order", text: "New order #ORD-2024-001 by Akand", time: "2 min ago", icon: FiShoppingCart, color: "text-crm-primary" },
          { id: 2, type: "payment", text: "Payment received for #ORD-2024-082", time: "15 min ago", icon: FiDollarSign, color: "text-crm-success" },
          { id: 3, type: "customer", text: "New wholesale application from ABC Corp", time: "1 hour ago", icon: FiUsers, color: "text-crm-purple" },
          { id: 4, type: "stock", text: "Low stock alert: Product 'Gaming Mouse'", time: "3 hours ago", icon: FiAlertCircle, color: "text-crm-warning" },
        ]
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const KPICard = ({ title, value, delta, icon: Icon, color, sparkData }) => (
    <div className="crm-card group hover:border-crm-border-strong transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg bg-crm-bg-hover ${color}`}>
          <Icon size={20} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${delta >= 0 ? "text-crm-success" : "text-crm-danger"}`}>
          {delta >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
          {Math.abs(delta)}%
        </div>
      </div>
      <div>
        <p className="text-xs text-crm-text-dim uppercase font-bold tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-crm-text-bright tracking-tight tabular-nums">{value}</p>
      </div>
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
    </div>
  );

  const mockSpark = [
    { v: 40 }, { v: 30 }, { v: 45 }, { v: 50 }, { v: 42 }, { v: 60 }, { v: 55 }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Executive Dashboard</h2>
          <p className="text-crm-text-dim text-sm">Real-time business performance overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="crm-btn" onClick={() => fetchDashboardData()}>
            <FiClock /> Refresh
          </button>
          <button className="crm-btn crm-btn-primary">
            <FiPlus /> Create Product
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Revenue (30d)" 
          value={`৳${(data.salesHistory.reduce((acc, curr) => acc + curr.value, 0)).toLocaleString()}`}
          delta={12.5}
          icon={FiDollarSign}
          color="text-crm-success"
          sparkData={mockSpark}
        />
        <KPICard 
          title="Orders (30d)" 
          value="1,482"
          delta={-2.4}
          icon={FiShoppingCart}
          color="text-crm-primary"
          sparkData={mockSpark.map(s => ({ v: s.v * 0.8 }))}
        />
        <KPICard 
          title="Customers" 
          value="8,245"
          delta={8.1}
          icon={FiUsers}
          color="text-crm-purple"
          sparkData={mockSpark.map(s => ({ v: s.v * 1.2 }))}
        />
        <KPICard 
          title="Conversion" 
          value="3.2%"
          delta={1.2}
          icon={FiTrendingUp}
          color="text-crm-cyan"
          sparkData={mockSpark}
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 crm-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-crm-text-bright">Sales Performance</h3>
            <select className="crm-input w-auto h-8 py-0 text-xs">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.salesHistory}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--crm-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--crm-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--crm-border)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="var(--crm-text-dim)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
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
          </div>
        </div>

        <div className="crm-card">
          <h3 className="font-bold text-crm-text-bright mb-6">Order Distribution</h3>
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
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                  <span className="text-crm-text-dim">{entry.name}</span>
                </div>
                <span className="font-bold text-crm-text-bright">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 crm-card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-crm-text-bright">Recent Orders</h3>
            <button className="text-crm-primary hover:underline text-sm font-medium flex items-center gap-1" onClick={() => onOpenOrder()}>
              View All <FiArrowRight />
            </button>
          </div>
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
                {data.recentOrders.map((order) => (
                  <tr key={order.id} className="cursor-pointer" onClick={() => onOpenOrder(order.id)}>
                    <td className="font-bold text-crm-primary">#{order.id.slice(-8).toUpperCase()}</td>
                    <td>{order.customer?.name || "Guest"}</td>
                    <td className="font-bold tabular-nums">৳{Number(order.total).toLocaleString()}</td>
                    <td>
                      <span className="crm-badge" style={{ 
                        backgroundColor: STATUS_COLORS[order.status] + "22", 
                        color: STATUS_COLORS[order.status],
                        borderColor: STATUS_COLORS[order.status] + "44"
                      }}>
                        {order.status}
                      </span>
                    </td>
                    <td className="text-crm-text-dim">{format(new Date(order.createdAt), "MMM dd, HH:mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="crm-card">
          <h3 className="font-bold text-crm-text-bright mb-6">Activity Feed</h3>
          <div className="space-y-6">
            {data.activity.map((item) => (
              <div key={item.id} className="flex gap-4">
                <div className={`shrink-0 w-8 h-8 rounded-full bg-crm-bg-hover flex items-center justify-center ${item.color}`}>
                  <item.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-crm-text-bright font-medium leading-tight mb-1">{item.text}</p>
                  <div className="flex items-center gap-2 text-[10px] text-crm-text-muted font-bold uppercase tracking-wider">
                    <FiClock size={10} /> {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 crm-btn text-xs">Load More Activity</button>
        </div>
      </div>
    </motion.div>
  );
}
