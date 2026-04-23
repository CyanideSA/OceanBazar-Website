import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { returnAPI, orderAPI } from "@/api/service";
import { useToast } from "@/hooks/use-toast";
import { useCustomerInbox } from "@/context/CustomerInboxContext";
import { formatOrderTitle } from "@/utils/orderDisplay";
import { getApiErrorMessage } from "@/utils/apiError";
import { logger } from "@/utils/logger";

export default function ReturnRequestPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonCategory, setReasonCategory] = useState("changed_mind");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userReturns, setUserReturns] = useState([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderFetchError, setOrderFetchError] = useState("");
  const { returnStreamTick, orderStreamTick } = useCustomerInbox();

  const returnsDebounceRef = useRef(null);

  const loadReturnsList = useCallback(async () => {
    const token = localStorage.getItem("oceanBazarToken");
    if (!token) {
      setUserReturns([]);
      return;
    }
    setReturnsLoading(true);
    try {
      const res = await returnAPI.list();
      setUserReturns(Array.isArray(res.data) ? res.data : []);
    } catch {
      setUserReturns([]);
    } finally {
      setReturnsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (returnsDebounceRef.current) {
      clearTimeout(returnsDebounceRef.current);
    }
    returnsDebounceRef.current = setTimeout(() => {
      returnsDebounceRef.current = null;
      loadReturnsList();
    }, 120);
    return () => {
      if (returnsDebounceRef.current) {
        clearTimeout(returnsDebounceRef.current);
        returnsDebounceRef.current = null;
      }
    };
  }, [returnStreamTick, loadReturnsList]);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      return;
    }
    let cancelled = false;
    const token = localStorage.getItem("oceanBazarToken");
    if (!token) {
      setOrder(null);
      return;
    }
    setOrderLoading(true);
    setOrderFetchError("");
    (async () => {
      try {
        const res = await orderAPI.get(orderId);
        if (!cancelled) {
          setOrder(res.data);
          setOrderFetchError("");
        }
      } catch (e) {
        if (!cancelled) {
          logger.error(e);
          setOrder(null);
          setOrderFetchError(getApiErrorMessage(e, "Could not load this order."));
        }
      } finally {
        if (!cancelled) setOrderLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, orderStreamTick]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await returnAPI.create({
        orderId,
        reason,
        reasonCategory,
        description,
        items: (order?.items || []).map((item) => ({
          productId: item.productId || item.id,
          productName: item.name || item.productName,
          quantity: item.quantity,
          price: item.unitPrice ?? item.price,
        })),
      });
      toast({ title: "Return submitted", description: "Your return request has been submitted for review." });
      navigate("/account/orders");
    } catch (e) {
      toast({
        title: "Failed",
        description: getApiErrorMessage(e, "Could not submit return"),
        variant: "destructive",
      });
    }
    setSubmitting(false);
  };

  const statusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
      refunded: "bg-blue-100 text-blue-700",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${colors[status] || "bg-gray-100 text-gray-700"}`}>
        {(status || "").replace(/_/g, " ")}
      </span>
    );
  };

  const showOrderBlock = orderId && (orderLoading || order);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-6">Request a Return</h1>

        {orderId && orderLoading && !order ? (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 text-center text-gray-500">Loading order…</div>
        ) : null}

        {orderId && !orderLoading && !order && orderFetchError ? (
          <div
            className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 mb-6 text-sm"
            role="alert"
          >
            {orderFetchError}
          </div>
        ) : null}

        {showOrderBlock && order ? (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3">Order Details</h2>
            <p className="text-base font-semibold font-mono text-[#5BA3D0] mb-1">{formatOrderTitle(order)}</p>
            <p className="text-xs text-gray-400 mb-2 break-all">Internal: {order.id}</p>
            <p className="text-sm text-gray-500 mb-4">
              Placed: {new Date(order.createdAt).toLocaleDateString()} — Total: ${order.total}
            </p>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Reason Category</label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="changed_mind">Changed My Mind</option>
                  <option value="defective">Defective Product</option>
                  <option value="wrong_item">Wrong Item Received</option>
                  <option value="not_as_described">Not As Described</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Brief reason for return"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Details</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Additional details..."
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Return Request"}
              </button>
            </form>
          </div>
        ) : null}

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Your Return Requests</h2>
            {returnsLoading ? <span className="text-xs text-gray-400">Updating…</span> : null}
          </div>
          {userReturns.length === 0 && !returnsLoading ? (
            <p className="text-gray-500 text-center py-4">No return requests</p>
          ) : (
            <div className="space-y-3">
              {userReturns.map((r) => (
                <div key={r.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono">Order: {r.orderId?.substring(0, 12)}...</span>
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-sm text-gray-600">{r.reason || r.reasonCategory}</p>
                  {r.refundAmount > 0 && (
                    <p className="text-sm text-green-600 font-medium mt-1">Refund: ${r.refundAmount}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
