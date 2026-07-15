import React, { useCallback, useEffect, useState } from "react";
import { FiMail, FiSend, FiInbox, FiRefreshCw, FiList, FiCornerUpLeft, FiAlertTriangle } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";

const FOLDERS = [
  { key: "Inbox", label: "Inbox" },
  { key: "SentItems", label: "Sent" },
  { key: "Drafts", label: "Drafts" },
  { key: "JunkEmail", label: "Spam" },
];

const TABS = [
  { key: "inbox", label: "Mailbox", icon: FiInbox },
  { key: "compose", label: "Compose", icon: FiSend },
  { key: "templates", label: "Templates", icon: FiList },
  { key: "logs", label: "Sent Log", icon: FiList },
];

export default function EmailInboxPage() {
  const toast = useToast();
  const [tab, setTab] = useState("inbox");
  const [status, setStatus] = useState(null);
  const [mailbox, setMailbox] = useState("");
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [compose, setCompose] = useState({ to: "", subject: "", body: "", from: "", cc: "", bcc: "" });
  const [folder, setFolder] = useState("Inbox");
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({ name: "", subject: "", bodyHtml: "", category: "support_reply" });
  const [junkFolderId, setJunkFolderId] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const s = await adminApi.emailStatus();
      setStatus(s);
      if (s?.mailboxes?.length && !mailbox) setMailbox(s.mailboxes[0]);
      if (s?.defaultSender) setCompose((c) => ({ ...c, from: c.from || s.defaultSender }));
    } catch {
      /* ignore */
    }
  }, [mailbox]);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.emailInbox({ mailbox: mailbox || undefined, folder, top: 25 });
      setMessages(r?.messages || []);
    } catch {
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [mailbox, folder, toast]);

  const loadFolders = useCallback(async () => {
    try {
      const r = await adminApi.emailFolders({ mailbox: mailbox || undefined });
      const junk = (r?.folders || []).find((f) => f.displayName === "Junk Email" || f.displayName === "Spam");
      if (junk) setJunkFolderId(junk.id);
    } catch { /* ignore */ }
  }, [mailbox]);

  const loadTemplates = useCallback(async () => {
    try {
      const r = await adminApi.emailTemplates();
      setTemplates(r?.templates || []);
    } catch {
      toast.error("Failed to load templates");
    }
  }, [toast]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.emailLogs({ channel: "email", limit: 100 });
      setLogs(r?.logs || []);
    } catch {
      toast.error("Failed to load email log");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => {
    if (tab === "inbox" && status?.graphConfigured) { loadInbox(); loadFolders(); }
    if (tab === "logs") loadLogs();
    if (tab === "templates") loadTemplates();
  }, [tab, status, loadInbox, loadLogs, loadTemplates, loadFolders]);

  const openMessage = async (m) => {
    try {
      const r = await adminApi.emailMessage(m.id, { mailbox: mailbox || undefined });
      setSelected(r?.message || null);
      setReply("");
    } catch {
      toast.error("Failed to open message");
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    try {
      await adminApi.emailReply(selected.id, { body: reply, mailbox: mailbox || undefined });
      toast.success("Reply sent");
      setReply("");
    } catch {
      toast.error("Reply failed");
    }
  };

  const sendCompose = async () => {
    if (!compose.to || !compose.subject || !compose.body) {
      toast.error("To, subject and body are required");
      return;
    }
    try {
      await adminApi.emailSend(compose);
      toast.success("Email sent");
      setCompose((c) => ({ ...c, to: "", subject: "", body: "" }));
    } catch {
      toast.error("Send failed");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiMail size={24} /></div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright">Email · Microsoft 365</h2>
            <p className="text-crm-text-dim text-sm">Shared mailbox inbox, compose and full send log</p>
          </div>
        </div>
        {status?.mailboxes?.length > 0 && (
          <select className="crm-input max-w-xs" value={mailbox} onChange={(e) => setMailbox(e.target.value)}>
            {status.mailboxes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {status && !status.graphConfigured && (
        <div className="crm-card flex items-start gap-3 border-crm-warning text-crm-warning bg-crm-warning-dim/30">
          <FiAlertTriangle className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>Microsoft 365 Graph is not configured.</strong> Set <code>MS_TENANT_ID</code>, <code>MS_CLIENT_ID</code>,
            <code> MS_CLIENT_SECRET</code> and <code>MS_SENDER_ADDRESSES</code> to enable the shared-mailbox inbox.
            {status.smtpConfigured ? " Outbound email is currently sent via SMTP fallback." : " No email provider is currently active (dev log only)."}
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-crm-border">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${tab === t.key ? "border-crm-primary text-crm-primary" : "border-transparent text-crm-text-dim hover:text-crm-text-bright"}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
        <button onClick={() => (tab === "logs" ? loadLogs() : loadInbox())} className="ml-auto crm-btn-ghost flex items-center gap-2 text-sm">
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading && <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-b-2 border-crm-primary rounded-full" /></div>}

      {tab === "inbox" && status?.graphConfigured && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr_1fr] gap-4">
          <div className="crm-card p-2 space-y-1">
            {FOLDERS.map((f) => (
              <button key={f.key} onClick={() => setFolder(f.key)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium ${folder === f.key ? "bg-crm-primary-dim text-crm-primary" : "text-crm-text-dim hover:bg-crm-bg-hover"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="crm-card overflow-hidden">
            <ul className="divide-y divide-crm-border/50 max-h-[560px] overflow-y-auto">
              {messages.map((m) => (
                <li key={m.id}>
                  <button onClick={() => openMessage(m)} className={`w-full text-left py-3 px-2 hover:bg-crm-primary-dim/30 rounded-lg ${selected?.id === m.id ? "bg-crm-primary-dim/40" : ""}`}>
                    <div className="flex justify-between gap-2">
                      <span className={`truncate text-sm ${m.isRead ? "text-crm-text-dim" : "font-bold text-crm-text-bright"}`}>{m.fromName || m.from}</span>
                      <span className="text-[11px] text-crm-text-dim shrink-0">{m.receivedAt ? format(new Date(m.receivedAt), "MMM d HH:mm") : ""}</span>
                    </div>
                    <div className="text-sm text-crm-text-bright truncate">{m.subject}</div>
                    <div className="text-xs text-crm-text-dim truncate">{m.preview}</div>
                  </button>
                </li>
              ))}
              {messages.length === 0 && <li className="py-10 text-center text-crm-text-dim text-sm">No messages</li>}
            </ul>
          </div>
          <div className="crm-card">
            {selected ? (
              <div className="space-y-3">
                <h3 className="font-bold text-crm-text-bright">{selected.subject}</h3>
                <p className="text-xs text-crm-text-dim">From: {selected.fromName} &lt;{selected.from}&gt;</p>
                <div className="border border-crm-border rounded-lg p-3 max-h-[320px] overflow-y-auto bg-white text-black text-sm"
                  dangerouslySetInnerHTML={{ __html: selected.bodyHtml || selected.preview }} />
                <textarea className="crm-input w-full" rows={4} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <button onClick={sendReply} className="crm-btn-primary flex items-center gap-2"><FiCornerUpLeft size={16} /> Send reply</button>
                  {junkFolderId && folder !== "JunkEmail" && (
                    <button onClick={() => adminApi.emailMove(selected.id, { mailbox, destinationFolderId: junkFolderId }).then(() => { toast.success("Moved to spam"); loadInbox(); })} className="crm-btn-ghost text-sm">Mark spam</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-crm-text-dim text-sm">Select a message to read</div>
            )}
          </div>
        </div>
      )}

      {tab === "compose" && (
        <div className="crm-card max-w-2xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-crm-text-dim uppercase font-bold">From</label>
              {status?.mailboxes?.length ? (
                <select className="crm-input w-full" value={compose.from} onChange={(e) => setCompose({ ...compose, from: e.target.value })}>
                  {status.mailboxes.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input className="crm-input w-full" value={compose.from} onChange={(e) => setCompose({ ...compose, from: e.target.value })} placeholder="no-reply@oceanbazar.com.bd" />
              )}
            </div>
            <div>
              <label className="text-xs text-crm-text-dim uppercase font-bold">To</label>
              <input className="crm-input w-full" value={compose.to} onChange={(e) => setCompose({ ...compose, to: e.target.value })} placeholder="customer@example.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-crm-text-dim uppercase font-bold">CC</label>
              <input className="crm-input w-full" value={compose.cc} onChange={(e) => setCompose({ ...compose, cc: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-crm-text-dim uppercase font-bold">BCC</label>
              <input className="crm-input w-full" value={compose.bcc} onChange={(e) => setCompose({ ...compose, bcc: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-crm-text-dim uppercase font-bold">Subject</label>
            <input className="crm-input w-full" value={compose.subject} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
          </div>
          {templates.length > 0 && (
            <select className="crm-input" onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (t) setCompose((c) => ({ ...c, subject: t.subject, body: t.bodyHtml }));
            }}>
              <option value="">Insert template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
            </select>
          )}
          <div>
            <label className="text-xs text-crm-text-dim uppercase font-bold">Message (HTML allowed)</label>
            <textarea className="crm-input w-full" rows={8} value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
          </div>
          <button onClick={sendCompose} className="crm-btn-primary flex items-center gap-2"><FiSend size={16} /> Send email</button>
        </div>
      )}

      {tab === "templates" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="crm-card space-y-3">
            <h3 className="font-bold">New template</h3>
            <input className="crm-input" placeholder="Name" value={newTemplate.name} onChange={(e) => setNewTemplate((t) => ({ ...t, name: e.target.value }))} />
            <select className="crm-input" value={newTemplate.category} onChange={(e) => setNewTemplate((t) => ({ ...t, category: e.target.value }))}>
              <option value="order_confirmation">Order confirmation</option>
              <option value="refund">Refund</option>
              <option value="marketing">Marketing</option>
              <option value="support_reply">Support reply</option>
            </select>
            <input className="crm-input" placeholder="Subject" value={newTemplate.subject} onChange={(e) => setNewTemplate((t) => ({ ...t, subject: e.target.value }))} />
            <textarea className="crm-input" rows={6} placeholder="HTML body with {{name}} variables" value={newTemplate.bodyHtml} onChange={(e) => setNewTemplate((t) => ({ ...t, bodyHtml: e.target.value }))} />
            <button className="crm-btn-primary" onClick={() => adminApi.emailTemplateCreate(newTemplate).then(() => { toast.success("Template saved"); loadTemplates(); })}>Save template</button>
          </div>
          <div className="crm-card">
            <h3 className="font-bold mb-2">Saved templates</h3>
            <ul className="space-y-2 text-sm">
              {templates.map((t) => (
                <li key={t.id} className="border-b border-crm-border pb-2">
                  <p className="font-semibold">{t.name} <span className="text-crm-text-dim">({t.category})</span></p>
                  <p className="text-xs text-crm-text-dim truncate">{t.subject}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "logs" && !loading && (
        <div className="crm-card overflow-hidden">
          <div className="crm-table-container">
            <table className="crm-table text-sm">
              <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Provider</th><th>Status</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="text-xs text-crm-text-dim">{l.createdAt ? format(new Date(l.createdAt), "MMM d HH:mm") : "—"}</td>
                    <td className="truncate max-w-[180px]">{l.toAddress || "—"}</td>
                    <td className="truncate max-w-[260px]">{l.subject || "—"}</td>
                    <td className="text-xs">{l.provider || "—"}</td>
                    <td><span className={`text-xs font-semibold ${l.status === "sent" ? "text-crm-success" : l.status === "failed" ? "text-crm-danger" : "text-crm-text-dim"}`}>{l.status}</span></td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-crm-text-dim">No email activity yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
