import React, { useState, useCallback, useEffect } from "react";
import { FiSearch, FiMail, FiMessageSquare, FiHelpCircle, FiPhone } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

function channelIcon(channel) {
  if (channel === "email") return <FiMail className="text-blue-400" />;
  if (channel === "whatsapp") return <FiPhone className="text-green-400" />;
  if (channel === "chat" || channel === "web" || channel === "facebook" || channel === "instagram") return <FiMessageSquare className="text-violet-400" />;
  if (channel === "ticket") return <FiHelpCircle className="text-amber-400" />;
  return <FiMessageSquare className="text-crm-text-muted" />;
}

function channelLabel(item) {
  if (item.type === "ticket") return "Ticket";
  if (item.type === "chat") return (item.channel || "web").toUpperCase();
  return item.channel || item.type;
}

export default function CustomerTimelinePage() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadTimeline = useCallback(async (customer) => {
    if (!customer?.id) return;
    setSelected(customer);
    setLoading(true);
    try {
      const res = await adminApi.communicationsTimeline(customer.id);
      setTimeline(res.timeline || []);
      setCounts(res.counts || null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not load timeline");
      setTimeline([]);
      setCounts(null);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    try {
      const preset = sessionStorage.getItem("oceanbazar_timeline_customer");
      if (!preset) return;
      sessionStorage.removeItem("oceanbazar_timeline_customer");
      setQuery(preset);
      setLoading(true);
      adminApi.communicationsSearch({ q: preset })
        .then(async (res) => {
          const list = res.customers || [];
          setCustomers(list);
          const match = list.find((c) => c.id === preset) || list[0];
          if (!match) {
            toast.error("Customer not found for timeline");
            return;
          }
          await loadTimeline(match);
        })
        .catch(() => toast.error("Could not open customer timeline"))
        .finally(() => setLoading(false));
    } catch { /* ignore */ }
  }, [loadTimeline, toast]);

  const searchCustomers = useCallback(async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await adminApi.communicationsSearch({ q: query.trim() });
      setCustomers(res.customers || []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="crm-card glass-surface p-6 border-crm-border">
        <h1 className="text-xl font-bold text-crm-text-bright mb-1">Customer Communications</h1>
        <p className="text-sm text-crm-text-dim mb-4">Unified timeline across email, chat, WhatsApp, and tickets</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
            <input
              className="crm-input pl-10 h-11 w-full"
              placeholder="Search by name, email, phone, or customer ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchCustomers()}
            />
          </div>
          <button type="button" className="crm-btn crm-btn-primary h-11 px-5" disabled={loading} onClick={searchCustomers}>
            Search
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="crm-card p-4 border-crm-border space-y-2 max-h-[70vh] overflow-y-auto">
          <h2 className="text-sm font-bold text-crm-text-dim uppercase tracking-wider">Customers</h2>
          {customers.length === 0 && <p className="text-xs text-crm-text-muted">Search to find customers</p>}
          {customers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => loadTimeline(c)}
              className={`w-full text-left p-3 rounded-xl border transition ${selected?.id === c.id ? "border-crm-primary bg-crm-primary/10" : "border-crm-border hover:bg-crm-bg-alt"}`}
            >
              <p className="font-semibold text-crm-text-bright text-sm">{c.name || c.id}</p>
              <p className="text-xs text-crm-text-dim truncate">{c.email || c.phone || c.id}</p>
            </button>
          ))}
        </div>

        <div className="md:col-span-2 crm-card p-4 border-crm-border max-h-[70vh] overflow-y-auto">
          {!selected ? (
            <p className="text-sm text-crm-text-muted text-center py-12">Select a customer to view their communication history</p>
          ) : (
            <>
              <div className="mb-4 pb-4 border-b border-crm-border">
                <h2 className="font-bold text-crm-text-bright">{selected.name}</h2>
                <p className="text-xs text-crm-text-dim">{selected.email} · {selected.phone}</p>
                {counts && (
                  <p className="text-[11px] text-crm-text-muted mt-2">
                    {counts.communications} emails/SMS/WA · {counts.chats} chats · {counts.tickets} tickets
                  </p>
                )}
              </div>
              {loading && <p className="text-sm text-crm-text-muted text-center py-8">Loading timeline…</p>}
              {!loading && timeline.length === 0 && <p className="text-sm text-crm-text-muted">No communications yet</p>}
              <div className="space-y-3">
                {!loading && timeline.map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl border border-crm-border bg-crm-bg-alt/50 backdrop-blur-sm">
                    <div className="mt-1">{channelIcon(item.channel || item.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-crm-primary/15 text-crm-primary">
                          {channelLabel(item)}
                        </span>
                        {item.direction && (
                          <span className="text-[10px] text-crm-text-muted">{item.direction}</span>
                        )}
                        <span className="text-[10px] text-crm-text-muted ml-auto">
                          {item.at ? format(new Date(item.at), "MMM d, yyyy HH:mm") : ""}
                        </span>
                      </div>
                      {item.subject && <p className="text-sm font-semibold text-crm-text-bright mt-1">{item.subject}</p>}
                      <p className="text-sm text-crm-text-dim mt-1 line-clamp-3">{item.preview || item.body || item.status}</p>
                      {(item.provider || item.fromAddress || item.toAddress) && (
                        <p className="text-[10px] text-crm-text-muted mt-1 truncate">
                          {[item.provider, item.fromAddress && `from ${item.fromAddress}`, item.toAddress && `to ${item.toAddress}`].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
