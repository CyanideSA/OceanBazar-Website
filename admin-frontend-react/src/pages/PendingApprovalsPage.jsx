import React, { useCallback, useEffect, useState } from "react";
import { FiCheck, FiX, FiShield, FiClock } from "react-icons/fi";
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

const BASE = "/api/admin/governance";

export default function PendingApprovalsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [reviewing, setReviewing] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/pending`, { params: { status: filter } });
      setItems(res.data?.items || []);
    } catch {
      toast.error("Failed to load pending changes");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(id, approve) {
    const note = approve ? "" : window.prompt("Rejection reason (optional):") || "";
    setReviewing((r) => ({ ...r, [id]: true }));
    try {
      await api.post(`${BASE}/pending/${id}/review`, { approve, note });
      toast.success(approve ? "Approved" : "Rejected");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Review failed");
    } finally {
      setReviewing((r) => ({ ...r, [id]: false }));
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-crm-warning-dim text-crm-warning">
          <FiShield size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright">Verification Queue</h2>
          <p className="text-crm-text-dim text-sm">Admin & staff changes awaiting Super Admin approval</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${
              filter === s ? "bg-crm-primary-dim text-crm-primary" : "bg-crm-bg text-crm-text-dim"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 border-b-2 border-crm-primary rounded-full" /></div>
      ) : items.length === 0 ? (
        <div className="crm-card text-center py-16 text-crm-text-dim">No {filter} items.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="crm-card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-crm-text-bright">{item.summary}</p>
                  <p className="text-xs text-crm-text-dim mt-1 flex flex-wrap gap-3">
                    <span className="capitalize">{item.module} · {item.action}</span>
                    <span>By {item.requested_by_name || item.requested_by}</span>
                    <span className="flex items-center gap-1"><FiClock size={11} />{format(new Date(item.created_at), "MMM d, yyyy HH:mm")}</span>
                  </p>
                </div>
                {filter === "pending" && (
                  <div className="flex gap-2">
                    <button type="button" disabled={reviewing[item.id]} onClick={() => review(item.id, true)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-crm-success-dim text-crm-success">
                      <FiCheck size={14} /> Approve
                    </button>
                    <button type="button" disabled={reviewing[item.id]} onClick={() => review(item.id, false)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold bg-crm-danger-dim text-crm-danger">
                      <FiX size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
              {item.resource_label && (
                <p className="text-xs text-crm-text-muted">Resource: {item.resource_label} {item.resource_id ? `(${item.resource_id})` : ""}</p>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer text-crm-primary font-semibold">View change payload</summary>
                <pre className="mt-2 p-3 rounded-lg bg-crm-bg border border-crm-border overflow-x-auto text-crm-text-dim max-h-64">
                  {JSON.stringify(item.payload, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
