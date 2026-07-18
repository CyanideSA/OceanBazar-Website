import React, { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiCheck, FiRefreshCw, FiUser } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { isRealUserId } from "../lib/deepLink";

export default function ClientErrorsPage({ onOpenCustomer }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.clientErrors({ page });
      setReports(Array.isArray(res?.reports) ? res.reports : []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load client errors");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id) => {
    try {
      const res = await adminApi.clientErrorDetail(id);
      setSelected(res?.report || null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load report");
    }
  };

  const markReviewed = async (id) => {
    try {
      await adminApi.markClientErrorReviewed(id);
      toast.success("Marked reviewed");
      await load();
      if (selected?.id === id) {
        const res = await adminApi.clientErrorDetail(id);
        setSelected(res?.report || null);
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update");
    }
  };

  return (
    <div className="space-y-6">
      <div className="crm-card p-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-crm-text flex items-center gap-2">
            <FiAlertTriangle className="text-amber-400" />
            Storefront Error Reports
          </h1>
          <p className="text-sm text-crm-text-dim mt-1">
            Full snapshots from <code className="text-xs">/error</code> and error boundaries on oceanbazar.com.bd
          </p>
        </div>
        <button type="button" onClick={load} className="crm-btn-secondary inline-flex items-center gap-2">
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="crm-card overflow-hidden">
          <div className="px-4 py-3 border-b border-crm-border text-sm font-semibold text-crm-text">
            Recent ({total})
          </div>
          <div className="divide-y divide-crm-border max-h-[70vh] overflow-y-auto">
            {loading && !reports.length ? (
              <p className="p-4 text-sm text-crm-text-dim">Loading…</p>
            ) : null}
            {!loading && !reports.length ? (
              <p className="p-4 text-sm text-crm-text-dim">No client errors recorded yet.</p>
            ) : null}
            {reports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => openDetail(r.id)}
                className={`w-full text-left px-4 py-3 hover:bg-crm-surface-2 transition ${
                  selected?.id === r.id ? "bg-crm-surface-2" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-amber-300">{r.digest || r.id.slice(0, 8)}</span>
                  <span className="text-[10px] text-crm-text-dim">
                    {r.reviewedAt ? "reviewed" : "new"}
                  </span>
                </div>
                <p className="text-sm text-crm-text mt-1 line-clamp-2">{r.message || "(no message)"}</p>
                <p className="text-xs text-crm-text-dim mt-1 truncate">{r.url}</p>
                {r.userId ? (
                  <p className="text-[10px] text-crm-primary mt-1 font-mono">User: {r.userId}</p>
                ) : null}
                <p className="text-[10px] text-crm-text-dim mt-1">{new Date(r.createdAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
          {total > 25 ? (
            <div className="flex justify-between px-4 py-3 border-t border-crm-border text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="crm-btn-secondary">
                Prev
              </button>
              <span className="text-crm-text-dim">Page {page}</span>
              <button type="button" disabled={page * 25 >= total} onClick={() => setPage((p) => p + 1)} className="crm-btn-secondary">
                Next
              </button>
            </div>
          ) : null}
        </div>

        <div className="crm-card p-4 min-h-[320px]">
          {!selected ? (
            <p className="text-sm text-crm-text-dim">Select a report to inspect the full snapshot.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-crm-text">Report detail</h2>
                  <p className="font-mono text-xs text-crm-text-dim mt-1">{selected.id}</p>
                </div>
                {!selected.reviewedAt ? (
                  <button type="button" onClick={() => markReviewed(selected.id)} className="crm-btn-primary inline-flex items-center gap-2 text-sm">
                    <FiCheck />
                    Mark reviewed
                  </button>
                ) : (
                  <span className="text-xs text-emerald-400">Reviewed {new Date(selected.reviewedAt).toLocaleString()}</span>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div><dt className="text-crm-text-dim">Digest</dt><dd className="font-mono">{selected.digest || "—"}</dd></div>
                <div><dt className="text-crm-text-dim">URL</dt><dd className="break-all">{selected.url || "—"}</dd></div>
                <div><dt className="text-crm-text-dim">Locale</dt><dd>{selected.locale || "—"}</dd></div>
                <div>
                  <dt className="text-crm-text-dim">User ID</dt>
                  <dd>
                    {selected.userId ? (
                      isRealUserId(selected.userId) && onOpenCustomer ? (
                        <button
                          type="button"
                          onClick={() => onOpenCustomer(selected.userId)}
                          className="inline-flex items-center gap-1 font-mono text-crm-primary hover:underline"
                        >
                          <FiUser size={12} />
                          {selected.userId}
                        </button>
                      ) : (
                        <span className="font-mono">{selected.userId}</span>
                      )
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div><dt className="text-crm-text-dim">User agent</dt><dd className="break-all text-xs">{selected.userAgent || "—"}</dd></div>
                <div><dt className="text-crm-text-dim">Message</dt><dd className="whitespace-pre-wrap">{selected.message || "—"}</dd></div>
              </dl>
              {selected.stack ? (
                <div>
                  <h3 className="text-sm font-semibold text-crm-text mb-2">Stack</h3>
                  <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{selected.stack}</pre>
                </div>
              ) : null}
              {selected.snapshot ? (
                <div>
                  <h3 className="text-sm font-semibold text-crm-text mb-2">Snapshot</h3>
                  <pre className="text-xs bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64">
                    {JSON.stringify(selected.snapshot, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
