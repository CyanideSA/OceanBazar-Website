import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { Package, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { orderAPI } from '../api/service';
import { getApiErrorMessage } from '@/utils/apiError';
import { logger } from '@/utils/logger';
import { useCustomerInbox } from '../context/CustomerInboxContext';
import { formatOrderTitle, getOrderRouteId } from '../utils/orderDisplay';

const Dashboard = ({ user = null }) => {
  const navigate = useNavigate();
  const { orderStreamTick, returnStreamTick } = useCustomerInbox();
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    avgOrderValue: 0,
    pendingOrders: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [orderStreamTick, returnStreamTick]);

  const fetchDashboardData = async () => {
    setLoadError('');
    try {
      const token = localStorage.getItem('oceanBazarToken');
      if (!token) return;

      const [statsRes, ordersRes] = await Promise.all([
        orderAPI.dashboardStats(),
        orderAPI.recent(5)
      ]);

      setStats(statsRes.data);
      setRecentOrders(ordersRes.data.orders);
    } catch (error) {
      logger.error('Failed to fetch dashboard data:', error);
      setLoadError(getApiErrorMessage(error, 'Unable to load dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    { label: 'Total Orders', value: stats.totalOrders, icon: Package, color: 'from-[#5BA3D0] to-[#7BB8DC]' },
    { label: 'Total Spent', value: `$${stats.totalSpent.toFixed(2)}`, icon: DollarSign, color: 'from-[#7BB8DC] to-[#5BA3D0]' },
    { label: 'Avg Order Value', value: `$${stats.avgOrderValue.toFixed(2)}`, icon: TrendingUp, color: 'from-[#5BA3D0] to-[#7BB8DC]' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: Clock, color: 'from-[#7BB8DC] to-[#5BA3D0]' },
  ];
  if (loading) {
    return (
      <AccountLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading dashboard...</div>
        </div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Dashboard</h1>
        {loadError ? (
          <div
            className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            role="alert"
          >
            {loadError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${stat.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Recent Orders</h2>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No orders yet. Start shopping!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Order</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Items</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Total</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order, idx) => {
                    const routeId = getOrderRouteId(order);
                    const goToOrder = () => {
                      if (routeId) navigate(`/account/orders/${encodeURIComponent(routeId)}`);
                    };
                    return (
                    <tr
                      key={routeId || `recent-${idx}`}
                      role={routeId ? 'link' : undefined}
                      tabIndex={routeId ? 0 : undefined}
                      onClick={routeId ? goToOrder : undefined}
                      onKeyDown={
                        routeId
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                goToOrder();
                              }
                            }
                          : undefined
                      }
                      className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        routeId ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5BA3D0] focus-visible:ring-inset' : ''
                      }`}
                      aria-label={routeId ? `View order details for ${formatOrderTitle(order)}` : undefined}
                    >
                      <td className="py-3 px-4 font-medium font-mono text-[#5BA3D0] dark:text-[#7BB8DC]">{formatOrderTitle(order)}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{order.items?.length || 0} items</td>
                      <td className="py-3 px-4 font-semibold text-gray-800 dark:text-white">${Number(order.total ?? 0).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.status === 'in_transit' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AccountLayout>
  );
};

export default Dashboard;