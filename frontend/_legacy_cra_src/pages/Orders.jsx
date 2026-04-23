import React, { useState, useEffect } from 'react';
import AccountLayout from '../components/AccountLayout';
import { useCustomerInbox } from '../context/CustomerInboxContext';
import {
  Package,
  Search,
  Clock,
  Truck,
  Receipt,
  Wallet,
  CreditCard,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Image as ImageIcon
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { orderAPI } from '../api/service';
import { getApiErrorMessage } from '@/utils/apiError';
import { logger } from '@/utils/logger';
import { formatOrderTitle, getOrderDisplayCode, getOrderRouteId } from '../utils/orderDisplay';

const getFulfillmentIcon = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered') return CheckCircle2;
  if (s === 'in_transit' || s === 'shipped' || s === 'out_for_delivery') return Truck;
  if (s === 'processing' || s === 'confirmed') return Clock;
  return Clock;
};

const getPaymentIcon = (paymentStatus) => {
  const p = String(paymentStatus || '').toLowerCase();
  if (p === 'paid') return CheckCircle2;
  if (p === 'failed') return XCircle;
  if (p === 'processing') return RotateCcw;
  if (p === 'pending' || p === 'none' || p === '') return Clock;
  return Clock;
};

const getPaymentLabel = (paymentStatus, paymentMethod) => {
  const p = String(paymentStatus || '').toLowerCase();
  if (!p || p === 'none') return paymentMethod ? `Payment: ${paymentMethod}` : 'Payment: —';
  if (p === 'paid') return paymentMethod ? `Payment: ${paymentMethod} (Paid)` : 'Payment: Paid';
  if (p === 'failed') return paymentMethod ? `Payment: ${paymentMethod} (Failed)` : 'Payment: Failed';
  return paymentMethod ? `Payment: ${paymentMethod} (${p})` : `Payment: ${p}`;
};

const Orders = () => {
  const navigate = useNavigate();
  const { orderStreamTick, returnStreamTick } = useCustomerInbox();
  const [filter, setFilter] = useState('all');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [reorderBusyId, setReorderBusyId] = useState(null);
  
  useEffect(() => {
    fetchOrders();
  }, [filter, orderStreamTick, returnStreamTick]);

  const handleReorder = async (e, order) => {
    e.stopPropagation();
    const oid = order?.id;
    if (!oid) return;
    setReorderBusyId(oid);
    setError('');
    try {
      await orderAPI.reorder(oid);
      navigate('/cart');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add items to cart'));
    } finally {
      setReorderBusyId(null);
    }
  };

  const goToReviewForOrder = (e, order) => {
    e.stopPropagation();
    const items = Array.isArray(order?.items) ? order.items : [];
    const pid = items.map((it) => it?.productId ?? it?.product_id).find(Boolean);
    const oid = order?.id;
    if (pid && oid) {
      navigate(`/product/${encodeURIComponent(String(pid))}/reviews?order=${encodeURIComponent(String(oid))}`);
      return;
    }
    const routeId = getOrderRouteId(order);
    if (routeId) navigate(`/account/orders/${encodeURIComponent(routeId)}`);
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('oceanBazarToken');
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);

      const params = filter === 'completed' ? { status: 'delivered' } : {};
      const response = await orderAPI.list(params);

      let fetchedOrders = response.data.orders || [];
      if (filter === 'recent') {
        fetchedOrders = fetchedOrders.slice(0, 3);
      }

      setOrders(fetchedOrders);
    } catch (error) {
      logger.error('Failed to fetch orders:', error);
      setError(getApiErrorMessage(error, 'Unable to load your orders right now.'));
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (searchQuery === '') return true;
    const q = searchQuery.toLowerCase().replace(/\s/g, '');
    const oid = (order.id || '').toLowerCase();
    const ref = (getOrderDisplayCode(order) || '').toLowerCase();
    return oid.includes(q) || ref.includes(q) || oid.endsWith(q.replace(/^prd-/, ''));
  });

  if (loading) {
    return (
      <AccountLayout>
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-5" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </AccountLayout>
    );
  }

  return (
    <AccountLayout>
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-4 md:mb-0">My Orders</h1>
          <div className="flex gap-2">
            <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')} className={filter === 'all' ? 'bg-[#5BA3D0]' : ''}>All</Button>
            <Button variant={filter === 'recent' ? 'default' : 'outline'} onClick={() => setFilter('recent')} className={filter === 'recent' ? 'bg-[#5BA3D0]' : ''}>Recent</Button>
            <Button variant={filter === 'completed' ? 'default' : 'outline'} onClick={() => setFilter('completed')} className={filter === 'completed' ? 'bg-[#5BA3D0]' : ''}>Completed</Button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input 
            placeholder="Search by order reference or ID..."
            className="pl-12 dark:bg-gray-800"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {error ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-red-200 dark:border-red-800 text-center">
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Could not load orders</h3>
            <p className="text-sm text-red-600 dark:text-red-300 mb-4">{error}</p>
            <Button onClick={fetchOrders} className="bg-[#5BA3D0]">Retry</Button>
          </div>
        ) : !isAuthenticated ? (
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-12 border border-gray-100 dark:border-gray-800 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Sign in to view orders</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Your order history appears here after login.</p>
            <Button onClick={() => navigate('/login')} className="bg-[#5BA3D0]">
              Sign in
            </Button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-12 border border-gray-100 dark:border-gray-800 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Orders Yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Start shopping to see your orders here</p>
            <Button onClick={() => navigate('/products')} className="bg-[#5BA3D0]">
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const routeId = getOrderRouteId(order);
              const goToOrderDetail = () => {
                if (routeId) navigate(`/account/orders/${encodeURIComponent(routeId)}`);
              };
              const StatusIcon = getFulfillmentIcon(order.status);
              const PaymentIcon = getPaymentIcon(order.paymentStatus);
              const paymentLabel = getPaymentLabel(order.paymentStatus, order.paymentMethod);
              const items = Array.isArray(order.items) ? order.items : [];
              const thumbItems = items.slice(0, 3);
              const statusClass =
                order.status === 'delivered'
                  ? 'bg-green-100 text-green-700'
                  : order.status === 'in_transit' || order.status === 'shipped' || order.status === 'out_for_delivery'
                    ? 'bg-blue-100 text-blue-700'
                    : order.status === 'processing' || order.status === 'confirmed'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700';

              return (
                <div
                  key={routeId || order.orderNumber || String(order.createdAt)}
                  role={routeId ? 'button' : undefined}
                  tabIndex={routeId ? 0 : undefined}
                  onClick={routeId ? goToOrderDetail : undefined}
                  onKeyDown={
                    routeId
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goToOrderDetail();
                          }
                        }
                      : undefined
                  }
                  className={`rounded-2xl border border-gray-100 bg-white p-6 transition-shadow dark:border-gray-800 dark:bg-gray-800/80 ${
                    routeId
                      ? 'cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5BA3D0] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900'
                      : 'hover:shadow-lg'
                  }`}
                  aria-label={routeId ? `View details for ${formatOrderTitle(order)}` : undefined}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-1 tracking-tight">
                        <span className="text-[#5BA3D0] dark:text-[#7BB8DC] font-mono">{formatOrderTitle(order)}</span>
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-4 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 ${statusClass}`}>
                        <StatusIcon className="w-4 h-4" />
                        {order.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="px-3 py-2 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-[#5BA3D0] inline-flex items-center gap-2">
                        <PaymentIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">{paymentLabel}</span>
                        <span className="sm:hidden">Payment</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Items</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center -space-x-2">
                          {thumbItems.map((it, idx) => (
                            <div
                              key={`${it.productId || idx}-${idx}`}
                              className="w-9 h-9 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center"
                            >
                              {it.imageUrl ? (
                                <img src={it.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="font-semibold text-gray-800 dark:text-white">{items.length || 0}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                        <Receipt className="w-3.5 h-3.5 text-[#5BA3D0]" />
                        Totals
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            <Wallet className="w-3.5 h-3.5" />
                            Subtotal
                          </span>
                          <span className="font-medium">${(order.subtotal || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5" />
                            GST
                          </span>
                          <span className="font-medium">${(order.gst ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5" />
                            Service fee
                          </span>
                          <span className="font-medium">${(order.serviceFee ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5" />
                            Shipping
                          </span>
                          <span className="font-medium">${(order.shipping || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-900 dark:text-white font-semibold pt-1 border-t border-gray-100 dark:border-gray-800">
                          <span className="inline-flex items-center gap-1">
                            <Receipt className="w-4 h-4" />
                            Total
                          </span>
                          <span>${(order.total || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tracking</p>
                      <p className="font-semibold text-[#5BA3D0] mt-2">{order.trackingNumber || '-'}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Action</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={!routeId}
                        onClick={(e) => {
                          e.stopPropagation();
                          goToOrderDetail();
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>

                  {order.returnStatus && order.returnStatus !== 'none' && (
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                      Return / refund: <span className="capitalize">{order.returnStatus}</span>
                    </p>
                  )}

                  {Array.isArray(order.items) &&
                  order.items.length > 0 &&
                  String(order.status || '').toLowerCase() !== 'cancelled' && (
                    <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!order.id || reorderBusyId === order.id}
                        onClick={(e) => handleReorder(e, order)}
                      >
                        {reorderBusyId === order.id ? 'Adding…' : 'Reorder'}
                      </Button>
                      {order.status === 'delivered' ? (
                        <Button size="sm" variant="outline" onClick={(e) => goToReviewForOrder(e, order)}>
                          Rate a product
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AccountLayout>
  );
};

export default Orders;