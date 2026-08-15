import React, { useEffect, useState } from "react";
import { FiMail, FiBell, FiMessageCircle, FiUser } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { isRealUserId } from "../lib/deepLink";

function CustomerLink({ userId, onOpenCustomer, label }) {
  if (!userId || !isRealUserId(userId) || !onOpenCustomer) return null;
  return (
    <button
      type="button"
      onClick={() => onOpenCustomer(userId)}
      className="mt-1 inline-flex items-center gap-1 text-xs text-crm-primary hover:underline"
    >
      <FiUser size={12} />
      {label || `View customer ${userId}`}
    </button>
  );
}

export default function EngagementPage({ onOpenCustomer, onOpenQa }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [newsletter, setNewsletter] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [qaPendingCount, setQaPendingCount] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const [n, s, q] = await Promise.all([
        adminApi.newsletterSubscribers(),
        adminApi.stockAlertSubscribers(),
        adminApi.qaPending(),
      ]);
      setNewsletter(n?.items || []);
      setStockAlerts(s?.items || []);
      setQaPendingCount(Array.isArray(q?.items) ? q.items.length : 0);
    } catch {
      toast.error("Failed to load engagement data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="crm-card">
        <h2 className="text-xl font-bold text-crm-text-bright">Engagement Operations</h2>
        <p className="text-crm-text-dim mt-1 text-sm">
          Manage newsletter subscribers, back-in-stock alerts, and product Q&A moderation.
        </p>
      </div>

      {loading ? (
        <div className="crm-card flex items-center justify-center py-14">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-crm-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="crm-card">
              <p className="text-crm-text-dim text-xs uppercase">Newsletter Subscribers</p>
              <p className="mt-1 text-2xl font-black text-crm-text-bright">{newsletter.length}</p>
            </div>
            <div className="crm-card">
              <p className="text-crm-text-dim text-xs uppercase">Back-In-Stock Alerts</p>
              <p className="mt-1 text-2xl font-black text-crm-warning">{stockAlerts.length}</p>
            </div>
            <div className="crm-card">
              <p className="text-crm-text-dim text-xs uppercase">Pending Q&A</p>
              <p className="mt-1 text-2xl font-black text-crm-primary">{qaPendingCount}</p>
            </div>
          </div>

          <div className="crm-card">
            <h3 className="mb-2 flex items-center gap-2 text-lg font-bold text-crm-text-bright">
              <FiMessageCircle /> Product Q&A
            </h3>
            <p className="text-sm text-crm-text-dim">
              {qaPendingCount} question{qaPendingCount === 1 ? "" : "s"} awaiting approval.
            </p>
            <p className="mt-2 text-sm text-crm-text">
              Full Q&A inbox is under Customers → Q&A
              {onOpenQa && (
                <>
                  {" · "}
                  <button type="button" className="text-crm-primary hover:underline font-semibold" onClick={onOpenQa}>
                    Open Q&A inbox
                  </button>
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="crm-card">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-crm-text-bright"><FiMail /> Newsletter Subscribers</h3>
              <div className="max-h-72 overflow-auto">
                {newsletter.map((n, i) => (
                  <div key={`${n.email}-${i}`} className="border-b border-crm-border py-2 text-sm">
                    <p className="font-medium text-crm-text-bright">{n.email}</p>
                    <CustomerLink userId={n.user_id} onOpenCustomer={onOpenCustomer} />
                  </div>
                ))}
                {newsletter.length === 0 && <p className="text-sm text-crm-text-dim">No subscribers yet.</p>}
              </div>
            </div>

            <div className="crm-card">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-crm-text-bright"><FiBell /> Back-In-Stock Alerts</h3>
              <div className="max-h-72 overflow-auto">
                {stockAlerts.map((a, i) => (
                  <div key={`${a.email}-${a.product_id}-${i}`} className="border-b border-crm-border py-2 text-sm">
                    <p className="font-medium text-crm-text-bright">{a.email}</p>
                    <p className="text-xs text-crm-text-dim">{a.product_title || a.product_id}</p>
                    <CustomerLink userId={a.user_id} onOpenCustomer={onOpenCustomer} />
                  </div>
                ))}
                {stockAlerts.length === 0 && <p className="text-sm text-crm-text-dim">No stock alert subscriptions.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
