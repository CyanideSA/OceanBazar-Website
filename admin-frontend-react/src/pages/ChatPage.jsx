import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiSend, FiSearch, FiCheckCircle,
  FiMessageSquare, FiSlash, FiHeadphones, FiAlertCircle,
  FiEdit3, FiRefreshCw, FiZap, FiChevronDown,
} from "react-icons/fi";
import { adminApi, resolveAdminApiBase } from "../lib/api";
import { getAdminRealtimeToken } from "../lib/realtimeAuth";
import { useToast } from "../components/ToastProvider";
import { isRealUserId } from "../lib/deepLink";
import { format, formatDistanceToNow } from "date-fns";
import { io } from "socket.io-client";

const CANNED_RESPONSES = [
  { id: 1,  label: "Greeting",         text: "Hello! I'm from OceanBazar support. How can I help you today? 😊" },
  { id: 2,  label: "Order number ask", text: "Could you please share your order number so I can look into this for you?" },
  { id: 3,  label: "Checking now",     text: "I'll check on that right away and get back to you in just a moment!" },
  { id: 4,  label: "More detail",      text: "Could you please describe the issue in more detail so I can assist you better?" },
  { id: 5,  label: "Refund processed", text: "Your refund has been processed. Please allow 3–5 business days for it to reflect in your account." },
  { id: 6,  label: "Escalated",        text: "I've escalated your issue to the relevant team. You'll receive an update shortly — we're on it!" },
  { id: 7,  label: "Anything else?",   text: "Is there anything else I can help you with today?" },
  { id: 8,  label: "Resolved thanks",  text: "Thank you for your patience! Your issue has been resolved. Have a great day! 🌟" },
  { id: 9,  label: "Please wait",      text: "Thank you for your patience — please give me a moment while I look into this for you." },
  { id: 10, label: "Apology",          text: "I sincerely apologise for the inconvenience caused. Let me get this sorted for you right away." },
];

const BFF_URL = resolveAdminApiBase();

/* ─── Status config ────────────────────────────────────────────────────────── */
const STATUS = {
  waiting_agent:  { label: "Waiting",      dot: "bg-amber-400 animate-pulse", badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active:         { label: "Active",        dot: "bg-emerald-500",             badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  not_resolved:   { label: "Not Resolved",  dot: "bg-rose-400 animate-pulse", badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" },
  bot:            { label: "Bot",            dot: "bg-violet-400",              badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" },
  finished:       { label: "Finished",       dot: "bg-muted-foreground",        badge: "bg-muted text-muted-foreground" },
};

function fmtTime(ts) {
  if (!ts) return "";
  try { return format(new Date(ts), "HH:mm"); } catch { return ""; }
}
function fmtAgo(ts) {
  if (!ts) return "";
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); } catch { return ""; }
}

function channelBadge(channel) {
  const c = (channel || "web").toLowerCase();
  if (c === "facebook") return { label: "FB", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" };
  if (c === "instagram") return { label: "IG", cls: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300" };
  if (c === "whatsapp") return { label: "WA", cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" };
  return { label: "Web", cls: "bg-crm-bg-hover text-crm-text-dim" };
}

/* ─── Greeting Setup Modal ─────────────────────────────────────────────────── */
function GreetingModal({ onSave }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await adminApi.chatSetGreeting(text.trim());
      onSave(text.trim());
    } catch { /* ignore */ } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <FiHeadphones className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Set Your Greeting</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          This message is sent automatically when you connect to a customer's chat. Make it warm and professional!
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. Hello! I'm Alex from OceanBazar support. I'm happy to help you today 😊"
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          disabled={!text.trim() || saving}
          onClick={save}
          className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50 hover:brightness-110"
        >
          {saving ? "Saving…" : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}

/* ─── Message bubble ───────────────────────────────────────────────────────── */
function Bubble({ msg, myAgentId }) {
  const isMe = msg.sender === "agent" && String(msg.senderId) === String(myAgentId);
  const isSystem = msg.sender === "system";
  const isUser = msg.sender === "user";
  const isBot = msg.sender === "bot";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{msg.message}</span>
      </div>
    );
  }

  const align = isUser ? "justify-start" : "justify-end";
  const bubbleCls = isUser
    ? "bg-muted text-foreground rounded-tl-sm"
    : isBot
    ? "bg-violet-100 text-foreground dark:bg-violet-900/40 rounded-tr-sm"
    : isMe
    ? "bg-primary text-primary-foreground rounded-tr-sm"
    : "bg-emerald-100 text-foreground dark:bg-emerald-900/40 rounded-tr-sm";

  return (
    <div className={`flex ${align} mb-2`}>
      <div className="max-w-[75%]">
        {(isBot || (!isMe && msg.sender === "agent")) && (
          <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
            {isBot ? "🤖 OB Bot" : msg.senderName || "Agent"}
          </p>
        )}
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${bubbleCls}`}>
          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
          {msg.message_type === "product_card" && Array.isArray(msg.content) && (
            <div className="mt-2 space-y-1.5">
              {msg.content.map((p) => (
                <div key={p.id} className="rounded-lg border border-border/50 bg-background/60 p-2 text-xs">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-primary">৳{Number(p.price || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
          {msg.message_type === "order_card" && msg.content && (
            <div className="mt-2 rounded-lg border border-border/50 bg-background/60 p-2 text-xs">
              <p className="font-semibold">{msg.content.orderNumber}</p>
              <p>Status: {msg.content.status}</p>
            </div>
          )}
        </div>
        <div className={`mt-1 flex items-center gap-1 text-[10px] text-muted-foreground ${isUser ? "" : "justify-end"}`}>
          <span>{fmtTime(msg.timestamp)}</span>
          {!isUser && !isBot && (
            msg.readAt
              ? <span className="text-primary" title="Read">✓✓</span>
              : <span title="Sent">✓</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Typing indicator ─────────────────────────────────────────────────────── */
function TypingDots({ name }) {
  return (
    <div className="flex justify-start mb-2">
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
        <p className="text-[11px] text-muted-foreground mb-1">{name} is typing…</p>
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function ContextSection({ title, items, renderItem, empty = "None" }) {
  const rows = Array.isArray(items) ? items : [];
  return (
    <details className="rounded-xl border border-crm-border bg-crm-bg/40" open={title === "Orders"}>
      <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[11px] font-bold text-crm-text-bright">
        <span>{title}</span>
        <span className="rounded-full bg-crm-bg-hover px-2 py-0.5 text-[10px] text-crm-text-dim">{rows.length}</span>
      </summary>
      <div className="max-h-48 space-y-1.5 overflow-y-auto border-t border-crm-border p-2">
        {rows.length ? rows.map(renderItem) : <p className="p-2 text-xs text-crm-text-muted">{empty}</p>}
      </div>
    </details>
  );
}

function CustomerContextPanel({ data, loading }) {
  if (loading) return <div className="m-4 h-28 animate-pulse rounded-xl bg-crm-bg-hover" />;
  if (!data) return <p className="p-4 text-xs text-crm-text-muted">Account context is unavailable for this visitor.</p>;
  const applications = [
    ...(data.applications?.wholesale || []).map((a) => ({ ...a, kind: "Wholesale" })),
    ...(data.applications?.businessInquiries || []).map((a) => ({ ...a, kind: "Business inquiry" })),
  ];
  const row = (primary, secondary, key) => (
    <div key={key} className="rounded-lg bg-crm-bg-hover/70 p-2">
      <p className="truncate text-xs font-semibold text-crm-text-bright">{primary}</p>
      <p className="mt-0.5 truncate text-[10px] text-crm-text-dim">{secondary}</p>
    </div>
  );
  return (
    <div className="space-y-2 px-3 pb-4">
      <ContextSection title="Orders" items={data.recentOrders} renderItem={(o) => row(o.orderNumber || o.id, `৳${Number(o.total || 0).toLocaleString()} · ${o.status}`, o.id)} />
      <ContextSection title="Payments" items={data.recentPayments} renderItem={(p) => row(p.method, `৳${Number(p.amount || 0).toLocaleString()} · ${p.status}`, p.id)} />
      <ContextSection title="Returns" items={data.recentReturns} renderItem={(r) => row(r.reason_category || "Return", r.status, r.id)} />
      <ContextSection title="Reviews" items={data.recentReviews} renderItem={(r) => row(`${r.rating}★ · ${r.product?.titleEn || "Product"}`, r.title || r.body || r.status, r.id)} />
      <ContextSection title="Tickets" items={data.recentTickets} renderItem={(t) => row(t.subject, `${t.status} · ${t.priority}`, t.id)} />
      <ContextSection title="Disputes" items={data.recentDisputes} renderItem={(d) => row(d.title, `${d.status} · ${d.priority}`, d.id)} />
      <ContextSection title="Applications" items={applications} renderItem={(a) => row(a.kind, `${a.business_name || a.full_name || ""} · ${a.status}`, `${a.kind}-${a.id}`)} />
    </div>
  );
}

export default function ChatPage({ liveTick, wsConnected, chatInboundRef, onOpenCustomer, onOpenTimeline }) {
  const toast = useToast();

  /* ── State ─────────────────────────────────────────────────────────────── */
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("queue"); // queue | history
  const [customerTyping, setCustomerTyping] = useState(false);
  const [showGreetingModal, setShowGreetingModal] = useState(false);
  const [showCanned, setShowCanned] = useState(false);
  const [myAgentId, setMyAgentId] = useState(null);
  const [customerContext, setCustomerContext] = useState(null);
  const [customerContextLoading, setCustomerContextLoading] = useState(false);
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingEmit = useRef(0);
  const socketRef = useRef(null);
  const activeSessionRef = useRef(activeSession);

  // Keep ref in sync with state so socket handlers always read the latest value
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  useEffect(() => {
    const userId = activeSession?.user_id;
    if (!isRealUserId(userId)) {
      setCustomerContext(null);
      setCustomerContextLoading(false);
      return;
    }
    let cancelled = false;
    setCustomerContextLoading(true);
    adminApi.customer360(userId)
      .then((data) => { if (!cancelled) setCustomerContext(data); })
      .catch(() => { if (!cancelled) setCustomerContext(null); })
      .finally(() => { if (!cancelled) setCustomerContextLoading(false); });
    return () => { cancelled = true; };
  }, [activeSession?.user_id]);

  /* ── Scroll to bottom ─────────────────────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, customerTyping]);

  /* ── Socket.IO connection ─────────────────────────────────────────────── */
  useEffect(() => {
    let socket = null;
    let cancelled = false;

    const setup = async () => {
      // The BFF only allows joining admin rooms for sockets that present a
      // valid admin JWT in handshake auth — cookies alone are not checked.
      const token = await getAdminRealtimeToken().catch(() => "");
      if (cancelled) return;

      socket = io(BFF_URL, {
        withCredentials: true,
        transports: ["websocket", "polling"],
        auth: { token: token || "" },
      });
      socketRef.current = socket;

      // Join on every (re)connect — server-side room membership is lost on reconnect
      socket.on("connect", () => {
        socket.emit("join", "admin:chat");
        socket.emit("join:admin-chat");
        // #region agent log
        fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'post-fix',hypothesisId:'CHAT-A',location:'admin ChatPage.jsx:socket-connect',message:'Admin chat socket connected and join emitted',data:{hasToken:Boolean(token)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      });

      registerHandlers(socket);
    };

    const registerHandlers = (socket) => {
    const onNewHuman = (payload) => {
      setSessions((prev) => {
        const exists = prev.find((s) => s.id === payload.sessionId);
        if (exists) return prev.map((s) => s.id === payload.sessionId ? { ...s, ...payload.session } : s);
        return payload.session ? [payload.session, ...prev] : prev;
      });
    };

    const onMsg = (payload) => {
      if (activeSessionRef.current?.id === payload.sessionId) {
        setMessages((p) => {
          const alreadyPresent = p.some((m) => m.id === payload.message?.id);
          // #region agent log
          fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'duplicate-pre-fix',hypothesisId:'DUP-A,DUP-B',location:'admin ChatPage.jsx:onMsg',message:'Admin socket message received',data:{messageId:String(payload.message?.id||''),sender:String(payload.message?.sender||''),alreadyPresent,messageCount:p.length},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (alreadyPresent) return p;
          return [...p, payload.message];
        });
        // Mark as read
        adminApi.chatMarkRead(payload.sessionId).catch(() => null);
      }
      setSessions((prev) => prev.map((s) =>
        s.id === payload.sessionId ? { ...s, last_message_at: new Date().toISOString() } : s
      ));
    };

    const onClaimed = (payload) => {
      setSessions((prev) => prev.map((s) =>
        s.id === payload.sessionId ? { ...s, status: "active", agent_id: payload.agentId, agent_name: payload.agentName } : s
      ));
      if (activeSessionRef.current?.id === payload.sessionId) {
        setActiveSession((s) => s ? { ...s, status: "active", agent_id: payload.agentId, agent_name: payload.agentName } : s);
      }
    };

    const onFinished = (payload) => {
      setSessions((prev) => prev.filter((s) => s.id !== payload.sessionId));
      if (activeSessionRef.current?.id === payload.sessionId) {
        setActiveSession((s) => s ? { ...s, status: "finished" } : s);
      }
    };

    const onCustomerTyping = (payload) => {
      if (activeSessionRef.current?.id !== payload.sessionId) return;
      setCustomerTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setCustomerTyping(false), 3500);
    };

    socket.on("chat:human_requested", onNewHuman);
    socket.on("chat:message", onMsg);
    socket.on("chat:agent_claimed", onClaimed);
    socket.on("chat:session_finished", onFinished);
    socket.on("chat:customer_typing", onCustomerTyping);
    };

    setup();

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit("leave", "admin:chat");
        socket.disconnect();
      }
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Fetch me (agent info) ──────────────────────────────────────────────── */
  useEffect(() => {
    adminApi.me().then((res) => {
      const admin = res?.admin || res;
      setMyAgentId(admin?.id || admin?.adminId);
    }).catch(() => null);

    adminApi.chatGetGreeting().then((res) => {
      if (!res?.greeting) setShowGreetingModal(true);
    }).catch(() => null);
  }, []);

  /* ── Fetch session list ─────────────────────────────────────────────────── */
  const fetchSessions = useCallback(async () => {
    try {
      const res = statusFilter === "queue"
        ? await adminApi.chatSessions()
        : await adminApi.chatSessionsAll({ status: "finished" });
      setSessions(Array.isArray(res?.sessions) ? res.sessions : []);
    } catch { toast.error("Failed to load sessions"); }
    finally { setLoading(false); }
  }, [statusFilter, toast]);

  useEffect(() => { fetchSessions(); }, [fetchSessions, liveTick]);

  // Allow App-level BFF socket to trigger an immediate refresh
  useEffect(() => {
    if (!chatInboundRef) return undefined;
    chatInboundRef.current = () => { fetchSessions(); };
    return () => { chatInboundRef.current = null; };
  }, [chatInboundRef, fetchSessions]);

  /* ── Open session ─────────────────────────────────────────────────────── */
  const openSession = async (session) => {
    try {
      const res = await adminApi.chatSession(session.id);
      const s = res?.session || session;
      setActiveSession(s);
      setMessages(Array.isArray(s.messages) ? s.messages : []);
      adminApi.chatMarkRead(s.id).catch(() => null);
    } catch { toast.error("Failed to load session"); }
  };

  /* ── Claim session ─────────────────────────────────────────────────────── */
  const handleClaim = async () => {
    if (!activeSession || claiming) return;
    setClaiming(true);
    try {
      const res = await adminApi.chatClaim(activeSession.id);
      const updated = res?.session || activeSession;
      setActiveSession(updated);
      setMessages(Array.isArray(updated.messages) ? updated.messages : messages);
      setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      toast.success("You've claimed this conversation!");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not claim session");
    } finally { setClaiming(false); }
  };

  /* ── Send message ─────────────────────────────────────────────────────── */
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!draft.trim() || !activeSession || sending) return;
    setSending(true);
    try {
      const res = await adminApi.chatSendMessage(activeSession.id, { message: draft.trim() });
      const newMsg = res?.message;
      if (newMsg) {
        setMessages((p) => {
          // #region agent log
          fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c9155'},body:JSON.stringify({sessionId:'7c9155',runId:'duplicate-pre-fix',hypothesisId:'DUP-A',location:'admin ChatPage.jsx:handleSend',message:'Admin HTTP send response appended',data:{messageId:String(newMsg.id||''),alreadyPresent:p.some((m)=>m.id===newMsg.id),messageCount:p.length},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          return [...p, newMsg];
        });
      }
      setDraft("");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to send");
    } finally { setSending(false); }
  };

  /* ── Typing signal (throttled: max once per 2 s) ──────────────────────────── */
  const handleTyping = () => {
    if (!activeSession) return;
    const now = Date.now();
    if (now - lastTypingEmit.current < 2000) return;
    lastTypingEmit.current = now;
    adminApi.chatTyping(activeSession.id).catch(() => null);
  };

  /* ── Finish session ────────────────────────────────────────────────────── */
  const handleFinish = async () => {
    if (!activeSession) return;
    try {
      await adminApi.chatFinish(activeSession.id);
      toast.success("Conversation resolved ✅");
      setSessions((p) => p.filter((s) => s.id !== activeSession.id));
      setActiveSession(null);
      setMessages([]);
    } catch { toast.error("Failed to finish session"); }
  };

  /* ── Not resolved ──────────────────────────────────────────────────────── */
  const handleNotResolved = async () => {
    if (!activeSession) return;
    try {
      await adminApi.chatNotResolved(activeSession.id);
      toast.success("Session marked as not resolved — returned to queue");
      setSessions((p) => p.filter((s) => s.id !== activeSession.id));
      setActiveSession(null);
      setMessages([]);
      fetchSessions();
    } catch { toast.error("Failed to update session"); }
  };

  /* ── Derived ───────────────────────────────────────────────────────────── */
  const filtered = sessions.filter((s) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (s.customer_name || "").toLowerCase().includes(q) ||
      (s.customer_email || "").toLowerCase().includes(q) ||
      (s.customer_issue || "").toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  const isMyClaim = activeSession && String(activeSession.agent_id) === String(myAgentId);
  const canWrite = activeSession?.status === "active" && isMyClaim;
  const isFinished = activeSession?.status === "finished";

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-[calc(100vh-var(--crm-topbar-height,64px)-2rem)] gap-4 overflow-hidden">

      {/* Greeting setup modal — shown first time */}
      {showGreetingModal && (
        <GreetingModal onSave={() => setShowGreetingModal(false)} />
      )}

      {/* ── LEFT: Session list ────────────────────────────────────────────── */}
      <div className="w-80 flex flex-col crm-card p-0 overflow-hidden shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-crm-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-crm-text-bright">Live Chat</h3>
            <button onClick={fetchSessions} className="p-1.5 rounded-lg text-crm-text-dim hover:text-crm-primary transition-colors">
              <FiRefreshCw size={14} />
            </button>
          </div>
          {/* Filter tabs */}
          <div className="flex rounded-lg bg-crm-bg-hover p-0.5 mb-3">
            {[["queue", "Queue"], ["history", "History"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setStatusFilter(val); setActiveSession(null); setMessages([]); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${statusFilter === val ? "bg-crm-primary text-white" : "text-crm-text-dim hover:text-crm-text-bright"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" size={14} />
            <input
              placeholder="Search customer, issue…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="crm-input pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {/* Session rows */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-8 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-crm-primary border-t-transparent" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-crm-text-dim text-sm">
              <FiMessageSquare className="mx-auto mb-2 opacity-30" size={32} />
              {statusFilter === "queue" ? "No active conversations" : "No history found"}
            </div>
          ) : filtered.map((s) => {
            const st = STATUS[s.status] || STATUS.bot;
            const lastMsgs = Array.isArray(s.messages) ? s.messages : [];
            const last = lastMsgs[lastMsgs.length - 1];
            return (
              <button
                key={s.id}
                onClick={() => openSession(s)}
                className={`w-full text-left p-3.5 border-b border-crm-border/60 transition-colors hover:bg-crm-bg-hover flex gap-3 ${activeSession?.id === s.id ? "bg-crm-bg-hover border-l-4 border-l-crm-primary" : ""}`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="h-9 w-9 rounded-full bg-crm-primary/20 flex items-center justify-center text-sm font-bold text-crm-primary">
                    {(s.customer_name || "?")[0].toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-crm-bg-card ${st.dot}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <p className="text-sm font-semibold text-crm-text-bright truncate">{s.customer_name || "Guest"}</p>
                    <span className="text-[10px] text-crm-text-dim shrink-0">{fmtTime(s.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-crm-text-dim truncate">{s.customer_issue || last?.message || "—"}</p>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.badge}`}>{st.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${channelBadge(s.channel).cls}`}>{channelBadge(s.channel).label}</span>
                    {s.agent_name && <span className="text-[10px] text-crm-text-muted">· {s.agent_name}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Greeting setup button */}
        <div className="border-t border-crm-border p-3">
          <button
            onClick={() => setShowGreetingModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-crm-text-dim border border-crm-border hover:border-crm-primary/40 hover:text-crm-primary transition-colors"
          >
            <FiEdit3 size={12} /> Set my greeting message
          </button>
        </div>
      </div>

      {/* ── CENTER: Chat window ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col crm-card p-0 overflow-hidden min-w-0">
        {!activeSession ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-crm-text-dim p-8 text-center">
            <FiMessageSquare size={48} className="opacity-20" />
            <p className="font-bold text-crm-text-bright">Select a conversation</p>
            <p className="text-sm max-w-xs">Click a session on the left to view the chat history and respond to customers.</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between gap-3 border-b border-crm-border bg-crm-bg-alt/60 px-5 py-3 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="h-10 w-10 rounded-full bg-crm-primary/20 flex items-center justify-center text-sm font-bold text-crm-primary">
                    {(activeSession.customer_name || "?")[0].toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-crm-bg-card ${(STATUS[activeSession.status] || STATUS.bot).dot}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-crm-text-bright text-sm truncate flex items-center gap-2">
                    {activeSession.customer_name || "Guest"}
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${channelBadge(activeSession.channel).cls}`}>{channelBadge(activeSession.channel).label}</span>
                  </p>
                  <p className="text-[11px] text-crm-text-dim truncate">{activeSession.customer_issue || "General inquiry"}</p>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {!isMyClaim && !isFinished && (activeSession.status === "waiting_agent" || activeSession.status === "not_resolved" || activeSession.status === "bot") && (
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="flex items-center gap-1.5 rounded-xl bg-crm-primary px-3 py-1.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    <FiZap size={12} /> {claiming ? "Claiming…" : "Claim"}
                  </button>
                )}
                {canWrite && (
                  <>
                    <button
                      onClick={handleFinish}
                      className="flex items-center gap-1.5 rounded-xl border border-crm-success/40 px-3 py-1.5 text-xs font-bold text-crm-success hover:bg-crm-success/10"
                    >
                      <FiCheckCircle size={12} /> Resolve
                    </button>
                    <button
                      onClick={handleNotResolved}
                      className="flex items-center gap-1.5 rounded-xl border border-crm-warning/40 px-3 py-1.5 text-xs font-bold text-crm-warning hover:bg-crm-warning/10"
                    >
                      <FiSlash size={12} /> Not Resolved
                    </button>
                  </>
                )}
                {isFinished && (
                  <span className="rounded-xl bg-crm-bg-hover px-3 py-1.5 text-xs font-bold text-crm-text-dim">Resolved</span>
                )}
              </div>
            </div>

            {/* Not my session banner */}
            {activeSession.status === "active" && !isMyClaim && activeSession.agent_name && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-5 py-2 text-xs text-amber-700 dark:text-amber-400">
                <FiAlertCircle size={13} />
                This session is being handled by <strong>{activeSession.agent_name}</strong>. You can read but not reply.
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar bg-crm-bg/20">
              {messages.map((msg) => (
                <Bubble key={msg.id} msg={msg} myAgentId={myAgentId} />
              ))}
              {customerTyping && <TypingDots name={activeSession.customer_name || "Customer"} />}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            {!isFinished && (
              <div className="border-t border-crm-border bg-crm-bg-alt/60 px-4 py-3">
                {/* Canned Responses Panel */}
                {showCanned && canWrite && (
                  <div className="mb-3 rounded-xl border border-crm-border bg-crm-bg shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-crm-border bg-crm-bg-hover">
                      <span className="text-[11px] font-black text-crm-text-bright uppercase tracking-wider flex items-center gap-1.5">
                        <FiZap size={11} className="text-crm-primary" /> Quick Replies
                      </span>
                      <button type="button" onClick={() => setShowCanned(false)}
                        className="text-crm-text-dim hover:text-crm-text-bright p-0.5">
                        <FiChevronDown size={13} />
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {CANNED_RESPONSES.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { setDraft(r.text); setShowCanned(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-crm-bg-hover transition-colors border-b border-crm-border/40 last:border-b-0"
                        >
                          <p className="text-[11px] font-bold text-crm-primary mb-0.5">{r.label}</p>
                          <p className="text-xs text-crm-text-dim truncate">{r.text}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!canWrite && (
                  <p className="mb-2 text-center text-xs text-crm-text-dim">
                    {activeSession.status === "waiting_agent" || activeSession.status === "not_resolved"
                      ? <span>Claim this conversation to start replying.</span>
                      : <span>Read-only — another agent is handling this.</span>}
                  </p>
                )}
                <form onSubmit={handleSend} className="flex items-end gap-2">
                  <button
                    type="button"
                    disabled={!canWrite}
                    onClick={() => setShowCanned((v) => !v)}
                    title="Quick replies"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-crm-border text-crm-text-dim hover:border-crm-primary/50 hover:text-crm-primary transition-colors disabled:opacity-30"
                  >
                    <FiZap size={15} />
                  </button>
                  <textarea
                    rows={1}
                    value={draft}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraft(val);
                      handleTyping();
                      if (val.startsWith('/') && canWrite) setShowCanned(true);
                      else if (!val.startsWith('/')) setShowCanned(false);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={!canWrite}
                    placeholder={canWrite ? "Type a reply… or / for quick replies" : "Claim to reply"}
                    className="flex-1 resize-none rounded-xl border border-crm-border bg-crm-bg px-4 py-2.5 text-sm text-crm-text-bright placeholder:text-crm-text-muted focus:outline-none focus:ring-2 focus:ring-crm-primary/40 disabled:opacity-40"
                    style={{ maxHeight: 100, overflowY: "auto" }}
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || !canWrite || sending}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-crm-primary text-white disabled:opacity-40 hover:brightness-110 transition-all"
                  >
                    <FiSend size={16} />
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── RIGHT: Customer details ───────────────────────────────────────── */}
      {activeSession && (
        <div className="w-80 shrink-0 crm-card p-0 overflow-y-auto custom-scrollbar hidden xl:flex flex-col">
          <div className="border-b border-crm-border px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-crm-text-muted">Customer Info</p>
          </div>
          <div className="p-4 space-y-3">
            {[
              ["Name",  activeSession.customer_name],
              ["Email", activeSession.customer_email],
              ["Phone", activeSession.customer_phone],
              ["Issue", activeSession.customer_issue],
            ].map(([label, val]) => val ? (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-crm-text-muted">{label}</p>
                <p className="text-sm text-crm-text-bright break-words">{val}</p>
              </div>
            ) : null)}
            {activeSession.user_id && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-crm-text-muted">User ID</p>
                <p className="text-xs font-mono text-crm-text-dim break-all">{activeSession.user_id}</p>
                {isRealUserId(activeSession.user_id) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {onOpenCustomer && (
                      <button type="button" onClick={() => onOpenCustomer(activeSession.user_id)} className="crm-btn crm-btn-secondary text-xs">
                        View profile
                      </button>
                    )}
                    {onOpenTimeline && (
                      <button type="button" onClick={() => onOpenTimeline(activeSession.user_id)} className="crm-btn crm-btn-secondary text-xs">
                        Timeline
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-crm-border pt-3">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-crm-text-muted">Account snapshot</p>
            <CustomerContextPanel data={customerContext} loading={customerContextLoading} />
          </div>
          <div className="border-t border-crm-border px-4 py-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-crm-text-muted">Session</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-crm-text-dim">Status</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${(STATUS[activeSession.status] || STATUS.bot).badge}`}>
                {(STATUS[activeSession.status] || STATUS.bot).label}
              </span>
            </div>
            {activeSession.agent_name && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-crm-text-dim">Agent</span>
                <span className="text-crm-text-bright font-semibold">{activeSession.agent_name}</span>
              </div>
            )}
            {activeSession.agent_claimed_at && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-crm-text-dim">Claimed</span>
                <span className="text-crm-text-dim">{fmtAgo(activeSession.agent_claimed_at)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-crm-text-dim">Started</span>
              <span className="text-crm-text-dim">{fmtAgo(activeSession.created_at)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
