import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useCustomerInbox } from '../context/CustomerInboxContext';
import { Button } from '../components/ui/button';
import { orderAPI, profileAPI } from '../api/service';
import { useToast } from '../hooks/use-toast';
import { formatOrderTitle, getOrderDisplayCode } from '../utils/orderDisplay';
import {
  Clock,
  Truck,
  Receipt,
  Wallet,
  CreditCard,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Image as ImageIcon,
  Ship,
  Star,
} from 'lucide-react';
import OrderTrackingTimeline, {
  getFulfillmentTimelineIndex,
  TRACKING_STEP_LABELS,
} from '../components/OrderTrackingTimeline';

const getFulfillmentIcon = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered') return CheckCircle2;
  if (s === 'in_transit' || s === 'out_for_delivery') return Truck;
  if (s === 'shipped') return Ship;
  if (s === 'processing' || s === 'confirmed') return Clock;
  return Clock;
};

const getPaymentIcon = (paymentStatus) => {
  const p = String(paymentStatus || '').toLowerCase();
  if (p === 'paid') return CheckCircle2;
  if (p === 'failed') return XCircle;
  if (p === 'processing') return RotateCcw;
  return Clock;
};

function safeImageSrc(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  if (u.toLowerCase().startsWith('file:')) return null;
  return u;
}

const getPaymentLabel = (paymentStatus, paymentMethod) => {
  const p = String(paymentStatus || '').toLowerCase();
  if (!p || p === 'none') return paymentMethod ? `Payment: ${paymentMethod}` : 'Payment: —';
  if (p === 'paid') return paymentMethod ? `Payment: ${paymentMethod} (Paid)` : 'Payment: Paid';
  if (p === 'failed') return paymentMethod ? `Payment: ${paymentMethod} (Failed)` : 'Payment: Failed';
  return paymentMethod ? `Payment: ${paymentMethod} (${p})` : `Payment: ${p}`;
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { orderStreamTick, returnStreamTick } = useCustomerInbox();
  const [order, setOrder] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnBusy, setReturnBusy] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const idRef = useRef(id);
  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const loadOrder = async () => {
    const oid = idRef.current;
    if (!oid) return;
    try {
      const token = localStorage.getItem('oceanBazarToken');
      if (!token) {
        setOrder(null);
        return;
      }
      try {
        const res = await orderAPI.get(oid);
        setOrder(res.data);
        try {
          const tr = await orderAPI.getTracking(oid);
          setTracking(tr.data);
        } catch {
          setTracking(null);
        }
      } catch {
        const list = await orderAPI.list({});
        const found = (list.data.orders || []).find(
          (o) => o.id === oid || (o.id && oid && o.id.endsWith(oid))
        );
        setOrder(found || null);
        if (found?.id) {
          try {
            const tr = await orderAPI.getTracking(found.id);
            setTracking(tr.data);
          } catch {
            setTracking(null);
          }
        } else {
          setTracking(null);
        }
      }
    } catch (e) {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadOrder();
  }, [id]);

  const prevTicksRef = useRef({ o: -1, r: -1 });
  useEffect(() => {
    const o = orderStreamTick;
    const r = returnStreamTick;
    const prev = prevTicksRef.current;
    if (prev.o === o && prev.r === r) return undefined;
    prevTicksRef.current = { o, r };
    if (o === 0 && r === 0) return undefined;
    const t = setTimeout(() => {
      loadOrder();
    }, 150);
    return () => clearTimeout(t);
  }, [orderStreamTick, returnStreamTick]);

  const reorder = async () => {
    if (!order?.id) return;
    setReorderBusy(true);
    try {
      await orderAPI.reorder(order.id);
      toast({ title: 'Cart updated', description: 'Items from this order were added to your cart.' });
      navigate('/cart');
    } catch (e) {
      toast({
        title: 'Could not reorder',
        description: e.response?.data?.detail || 'Try again later',
        variant: 'destructive'
      });
    } finally {
      setReorderBusy(false);
    }
  };

  const submitFeedback = async () => {
    if (!order?.id) return;
    const comment = feedbackComment.trim();
    if (!comment && feedbackRating == null) {
      toast({ title: 'Add a rating or comment', variant: 'destructive' });
      return;
    }
    setFeedbackBusy(true);
    try {
      await orderAPI.submitFeedback(order.id, {
        rating: feedbackRating,
        comment: comment || undefined
      });
      toast({ title: 'Thanks for your feedback' });
      const res = await orderAPI.get(order.id);
      setOrder(res.data);
      try {
        const tr = await orderAPI.getTracking(order.id);
        setTracking(tr.data);
      } catch {
        setTracking(null);
      }
      setFeedbackComment('');
    } catch (e) {
      toast({
        title: 'Could not save feedback',
        description: e.response?.data?.detail || 'Try again later',
        variant: 'destructive'
      });
    } finally {
      setFeedbackBusy(false);
    }
  };

  const requestReturn = async () => {
    const reason = window.prompt(
      'Briefly describe why you are requesting a return or refund:',
      ''
    );
    if (reason === null) return;
    setReturnBusy(true);
    try {
      await profileAPI.requestReturn(id, reason || undefined);
      toast({ title: 'Request submitted', description: 'We will review your return or refund request shortly.' });
      const res = await orderAPI.get(id);
      setOrder(res.data);
      try {
        const tr = await orderAPI.getTracking(id);
        setTracking(tr.data);
      } catch {
        setTracking(null);
      }
    } catch (e) {
      toast({
        title: 'Could not submit',
        description: e.response?.data?.detail || 'Try again later',
        variant: 'destructive'
      });
    } finally {
      setReturnBusy(false);
    }
  };

  const rs = order?.returnStatus || 'none';
  const stageIndex = order ? getFulfillmentTimelineIndex(order.status) : 0;
  const currentStepLabel =
    stageIndex === -1 ? 'Cancelled' : TRACKING_STEP_LABELS[stageIndex] || 'Pending';
  const FulfillmentIcon = getFulfillmentIcon(order?.status);
  const PaymentIcon = getPaymentIcon(order?.paymentStatus);
  const paymentLabel = getPaymentLabel(order?.paymentStatus, order?.paymentMethod);

  if (loading) return <AccountLayout><div className="p-8">Loading...</div></AccountLayout>;
  if (!order) return <AccountLayout><div className="p-8">Order not found.</div></AccountLayout>;

  const canRequestReturn =
    ['delivered', 'in_transit', 'processing', 'shipped'].includes(order.status) &&
    (rs === 'none' || rs === 'rejected');

  const hasFeedback =
    (order.buyerRating != null && order.buyerRating > 0) ||
    (order.buyerFeedback && String(order.buyerFeedback).trim().length > 0);
  const canLeaveFeedback = order.status === 'delivered' && !hasFeedback;
  const canReorder =
    Array.isArray(order.items) &&
    order.items.length > 0 &&
    String(order.status || '').toLowerCase() !== 'cancelled';

  const lineProductId = (item) => {
    const pid = item?.productId ?? item?.product_id;
    return pid != null && String(pid).trim() !== '' ? String(pid).trim() : null;
  };

  return (
    <AccountLayout>
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50 font-mono">
            {formatOrderTitle(order)}
          </h1>
          <div className="flex flex-wrap gap-2">
            {canReorder ? (
              <Button
                type="button"
                className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white"
                disabled={reorderBusy}
                onClick={reorder}
              >
                {reorderBusy ? 'Adding…' : 'Reorder'}
              </Button>
            ) : null}
            <Button variant="outline" type="button" onClick={() => navigate('/account/orders')}>
              Back to orders
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500">Order status</p>
            <div className="mt-2 flex items-center gap-2">
              <FulfillmentIcon className="w-5 h-5 text-[#5BA3D0]" />
              <p className="font-semibold capitalize">{order.status?.replace('_', ' ')}</p>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Current step: {currentStepLabel}</p>
          </div>

          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 inline-flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#5BA3D0]" />
              Totals
            </p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Subtotal</span>
                <span className="font-medium">${(order.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> GST</span>
                <span className="font-medium">${(order.gst ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1"><Receipt className="w-3.5 h-3.5" /> Service fee</span>
                <span className="font-medium">${(order.serviceFee ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Shipping</span>
                <span className="font-medium">${(order.shipping || 0).toFixed(2)}</span>
              </div>
              <div className="pt-1 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 font-semibold"><Receipt className="w-4 h-4" /> Total</span>
                <span className="font-bold">${(order.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 inline-flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#5BA3D0]" />
              Payment
            </p>
            <div className="mt-2 flex items-center gap-2">
              <PaymentIcon className="w-5 h-5 text-[#5BA3D0]" />
              <p className="font-semibold">{paymentLabel}</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500">Tracking</p>
            <p className="font-semibold text-[#5BA3D0] mt-2 break-all">{order.trackingNumber || 'N/A'}</p>
          </div>

          <div className="p-4 rounded-lg bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-800 md:col-span-2">
            <p className="text-xs text-gray-500">Customer ID</p>
            <p className="font-semibold break-all">{order.userId || 'N/A'}</p>
          </div>

          <div className="p-4 rounded-lg bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">Reference</p>
            <p className="font-semibold font-mono text-[#5BA3D0] dark:text-[#7BB8DC] mt-2 tracking-wide">{getOrderDisplayCode(order)}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">Internal ID</p>
            <p className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{order.id}</p>
          </div>
        </div>

        {rs !== 'none' && (
          <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Return / refund</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">Status: {rs}</p>
            {order.returnReason ? <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">Reason: {order.returnReason}</p> : null}
          </div>
        )}

        {hasFeedback && (
          <div className="mb-6 p-4 rounded-lg bg-slate-50 dark:bg-gray-800/50 border border-slate-100 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Your feedback</p>
            {order.buyerRating != null ? (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Rating: {order.buyerRating} / 5</p>
            ) : null}
            {order.buyerFeedback ? (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{order.buyerFeedback}</p>
            ) : null}
          </div>
        )}

        {canLeaveFeedback && (
          <div className="mb-6 p-4 rounded-lg border border-[#E4F0F9] dark:border-gray-700 bg-[#F8FBFD] dark:bg-gray-800/40">
            <h2 className="text-lg font-semibold mb-1 text-gray-800 dark:text-gray-100">How was OceanBazar?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your delivery just completed — tell us about packaging, timing, and support. This helps us improve the marketplace.
            </p>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Overall rating</p>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} stars`}
                  onClick={() => setFeedbackRating(n)}
                  className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5BA3D0]"
                >
                  <Star
                    className={`w-8 h-8 ${n <= feedbackRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-gray-500 self-center">{feedbackRating} / 5</span>
            </div>
            <label className="block text-xs text-gray-500 mb-1">Comments (optional)</label>
            <textarea
              className="w-full min-h-[88px] rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="What went well? What could be better?"
            />
            <Button
              type="button"
              className="mt-3 bg-[#5BA3D0] hover:bg-[#4A90B8] text-white"
              disabled={feedbackBusy}
              onClick={submitFeedback}
            >
              {feedbackBusy ? 'Saving…' : 'Submit feedback to OceanBazar'}
            </Button>
          </div>
        )}

        <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-100">Shipment timeline</h2>
        <div className="mb-6">
          <OrderTrackingTimeline status={order.status} tracking={tracking} />
        </div>

        {canRequestReturn && (
          <div className="mb-6">
            <Button
              type="button"
              onClick={requestReturn}
              disabled={returnBusy}
              className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white"
            >
              {returnBusy ? 'Submitting...' : 'Request return or refund'}
            </Button>
          </div>
        )}

        <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">Products in this order</h2>
        <div className="space-y-2">
          {(order.items || []).map((item, idx) => {
            const pid = lineProductId(item);
            const showReview = order.status === 'delivered' && pid;
            return (
              <div key={idx} className="p-3 rounded border border-gray-200 dark:border-gray-700">
                <div className="flex gap-3 items-start">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50 border border-gray-100 flex items-center justify-center shrink-0">
                    {safeImageSrc(item.imageUrl) ? (
                      <img src={safeImageSrc(item.imageUrl)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium break-words">{item.name || item.productName || item.productId || 'Product'}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      Qty: {item.quantity || 0}
                      <span className="mx-2">|</span>
                      Unit: ${(item.unitPrice || 0).toFixed(2)}
                    </div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-1">
                      Line total: ${(item.lineTotal || 0).toFixed(2)}
                    </div>
                    {showReview ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() =>
                          navigate(
                            `/product/${encodeURIComponent(pid)}/reviews?order=${encodeURIComponent(order.id)}`
                          )
                        }
                      >
                        Rate this product
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AccountLayout>
  );
};

export default OrderDetail;
