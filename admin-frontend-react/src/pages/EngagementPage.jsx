import React, { useEffect, useState } from "react";
import { FiMail, FiBell, FiMessageCircle, FiCheck, FiX, FiUser } from "react-icons/fi";
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

export default function EngagementPage({ onOpenCustomer }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [newsletter, setNewsletter] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [qaPending, setQaPending] = useState([]);
  const [answerDraft, setAnswerDraft] = useState({});

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
      setQaPending(q?.items || []);
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

  async function moderateQa(id, approved) {
    try {
      await adminApi.moderateQa(id, { approved, answer: answerDraft[id] || null });
      setQaPending((prev) => prev.filter((x) => x.id !== id));
      toast.success(approved ? "Question approved" : "Question rejected");
    } catch {
      toast.error("Failed to update Q&A item");
    }
  }

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
              <p className="mt-1 text-2xl font-black text-crm-primary">{qaPending.length}</p>
            </div>
          </div>

          <div className="crm-card">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-crm-text-bright"><FiMessageCircle /> Pending Product Q&A</h3>
            {qaPending.length === 0 ? (
              <p className="text-sm text-crm-text-dim">No pending Q&A items.</p>
            ) : (
              <div className="space-y-3">
                {qaPending.map((item) => (
                  <div key={item.id} className="rounded-xl border border-crm-border bg-crm-bg p-3">
                    <p className="text-xs text-crm-text-dim">{item.product_title || item.product_id}</p>
                    <p className="mt-1 text-sm font-semibold text-crm-text-bright">{item.question}</p>
                    {(item.asker_name || item.asker_email) && (
                      <p className="text-xs text-crm-text-dim mt-1">
                        {item.asker_name || "Anonymous"}{item.asker_email ? ` · ${item.asker_email}` : ""}
                      </p>
                    )}
                    <CustomerLink userId={item.user_id} onOpenCustomer={onOpenCustomer} label="View asker profile" />
                    <textarea
                      className="crm-input mt-2 min-h-[70px] w-full"
                      value={answerDraft[item.id] || ""}
                      onChange={(e) => setAnswerDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Optional answer shown on product page"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button className="crm-btn-primary flex items-center gap-1.5" onClick={() => moderateQa(item.id, true)}>
                        <FiCheck /> Approve
                      </button>
                      <button className="crm-btn-secondary flex items-center gap-1.5" onClick={() => moderateQa(item.id, false)}>
                        <FiX /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
