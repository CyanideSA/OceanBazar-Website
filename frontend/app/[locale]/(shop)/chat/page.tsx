'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, CheckCheck, Check, HeadphonesIcon, Loader2, Bot, User, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type MsgSender = 'user' | 'bot' | 'agent' | 'system';

type Msg = {
  id: string;
  sender: MsgSender;
  senderName?: string;
  message: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  readAt?: string | null;
  quickReplies?: string[];
};

type Session = {
  id: string;
  user_id: string;
  status: 'bot' | 'waiting_agent' | 'active' | 'finished' | 'not_resolved';
  messages: Msg[];
  customer_name: string;
  customer_issue: string | null;
  agent_name: string | null;
};

type IntakeForm = { name: string; email: string; phone: string; issue: string };

/* ─── helpers ────────────────────────────────────────────────────────────────── */

const VISITOR_KEY = 'ob_visitor_id';

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) { id = `vis-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; localStorage.setItem(VISITOR_KEY, id); }
  return id;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ─── Quick reply pills ──────────────────────────────────────────────────────── */

function QuickReplies({ replies, onSelect }: { replies: string[]; onSelect: (r: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {replies.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onSelect(r)}
          className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          {r}
        </button>
      ))}
    </div>
  );
}

/* ─── Message bubble ─────────────────────────────────────────────────────────── */

function MessageBubble({ msg, isLast }: { msg: Msg; isLast: boolean }) {
  const isUser = msg.sender === 'user';
  const isSystem = msg.sender === 'system';
  const isBot = msg.sender === 'bot';

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{msg.message}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-end gap-2 mb-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        isUser ? 'bg-primary text-primary-foreground' : isBot ? 'bg-violet-500/20 text-violet-600' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
      )}>
        {isUser ? <User className="h-3.5 w-3.5" /> : isBot ? <Bot className="h-3.5 w-3.5" /> : <HeadphonesIcon className="h-3.5 w-3.5" />}
      </div>

      <div className={cn('flex max-w-[78%] flex-col', isUser ? 'items-end' : 'items-start')}>
        {!isUser && msg.senderName && (
          <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{msg.senderName}</p>
        )}
        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm',
          isUser
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : isBot
              ? 'rounded-tl-sm bg-violet-50 text-foreground dark:bg-violet-950/40'
              : 'rounded-tl-sm bg-muted text-foreground',
        )}>
          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
        </div>

        {/* Quick replies */}
        {!isUser && msg.quickReplies && msg.quickReplies.length > 0 && isLast && (
          <QuickReplies replies={msg.quickReplies} onSelect={() => {}} />
        )}

        {/* Timestamp + read receipt */}
        <div className={cn('mt-1 flex items-center gap-1 text-[10px] text-muted-foreground', isUser ? 'flex-row-reverse' : 'flex-row')}>
          <span>{fmtTime(msg.timestamp)}</span>
          {isUser && (
            msg.readAt
              ? <CheckCheck className="h-3 w-3 text-primary" />
              : msg.status === 'delivered'
                ? <CheckCheck className="h-3 w-3" />
                : <Check className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Typing indicator ───────────────────────────────────────────────────────── */

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700">
        <HeadphonesIcon className="h-3.5 w-3.5" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
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

/* ─── Intake form ────────────────────────────────────────────────────────────── */

function IntakeFormModal({ onStart, loading }: { onStart: (f: IntakeForm) => void; loading: boolean }) {
  const [form, setForm] = useState<IntakeForm>({ name: '', email: '', phone: '', issue: '' });
  const set = (k: keyof IntakeForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Welcome to OceanBazar Support 👋</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us a bit about yourself and we'll connect you right away!
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Your Name *</label>
            <input
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Rahim Uddin"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="01XXXXXXXXX"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">What do you need help with? *</label>
            <select
              value={form.issue}
              onChange={set('issue')}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select an issue…</option>
              <option value="Order & Tracking">Order & Tracking</option>
              <option value="Returns & Refunds">Returns & Refunds</option>
              <option value="Payment Issue">Payment Issue</option>
              <option value="Product Inquiry">Product Inquiry</option>
              <option value="Account & Login">Account & Login</option>
              <option value="Delivery & Shipping">Delivery & Shipping</option>
              <option value="Coupon & Offers">Coupon & Offers</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <button
            type="button"
            disabled={!form.name.trim() || !form.issue || loading}
            onClick={() => onStart(form)}
            className="mt-2 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:brightness-110 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            {loading ? 'Starting chat…' : 'Start Live Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Status bar ──────────────────────────────────────────────────────────────── */

function StatusBar({ status, agentName }: { status: Session['status']; agentName: string | null }) {
  const cfg = {
    bot: { dot: 'bg-violet-500', label: 'OB Assistant', sub: 'AI-powered support • Online 24/7' },
    waiting_agent: { dot: 'bg-amber-400 animate-pulse', label: 'Connecting you…', sub: 'Finding an available agent' },
    active: { dot: 'bg-emerald-500', label: agentName || 'OB Agent', sub: 'Human agent • Online' },
    finished: { dot: 'bg-muted-foreground', label: 'Conversation closed', sub: 'Resolved' },
    not_resolved: { dot: 'bg-amber-400 animate-pulse', label: 'OceanBazar Support', sub: 'Waiting for agent' },
  }[status] || { dot: 'bg-muted-foreground', label: 'OceanBazar Support', sub: '' };

  return (
    <div className="flex items-center gap-3 border-b border-border bg-primary px-5 py-3.5">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
        {status === 'active' ? <HeadphonesIcon className="h-5 w-5 text-primary-foreground" /> : <Bot className="h-5 w-5 text-primary-foreground" />}
        <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary', cfg.dot)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary-foreground truncate">{cfg.label}</p>
        <p className="text-[11px] text-primary-foreground/70">{cfg.sub}</p>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────────── */

export default function ChatPage() {
  const { user } = useAuthStore();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);
  const [visitorId] = useState(() => getVisitorId());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sessionId = session?.id;
  const userId = user ? (user as any).userId || (user as any).id : visitorId;

  /* ── Load existing session on mount ─────────── */
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/chat/session?visitorId=${encodeURIComponent(visitorId)}`);
        if (data.session) {
          setSession(data.session);
          setMessages(Array.isArray(data.session.messages) ? data.session.messages : []);
        }
      } catch { /* no session yet */ }
    };
    load();
  }, [visitorId]);

  /* ── Scroll to bottom ─────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentTyping]);

  /* ── Socket.IO ─────────────────────────────── */
  useEffect(() => {
    if (!sessionId) return;
    const socket = connectSocket();

    socket.emit('join:user', userId);
    socket.emit('join:chat', sessionId);

    const onMsg = (payload: { sessionId: string; message: Msg }) => {
      if (payload.sessionId !== sessionId) return;
      setAgentTyping(false);
      setMessages((p) => {
        if (p.find((m) => m.id === payload.message.id)) return p;
        return [...p, payload.message];
      });
      api.post('/chat/read', { sessionId, visitorId }).catch(() => null);
    };

    const onAgentJoined = (payload: { sessionId: string; agentName: string; message: Msg; systemMessage: Msg }) => {
      if (payload.sessionId !== sessionId) return;
      setAgentTyping(false);
      setSession((s) => s ? { ...s, status: 'active', agent_name: payload.agentName } : s);
      setMessages((p) => [...p, payload.systemMessage, payload.message]);
    };

    const onTyping = (payload: { sessionId: string }) => {
      if (payload.sessionId !== sessionId) return;
      setAgentTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setAgentTyping(false), 4000);
    };

    const onRead = (payload: { sessionId: string; at: string }) => {
      if (payload.sessionId !== sessionId) return;
      setMessages((p) => p.map((m) => m.sender === 'user' && !m.readAt ? { ...m, readAt: payload.at, status: 'read' } : m));
    };

    const onFinished = (payload: { sessionId: string }) => {
      if (payload.sessionId !== sessionId) return;
      setSession((s) => s ? { ...s, status: 'finished' } : s);
    };

    const onNotResolved = (payload: { sessionId: string; message: string }) => {
      if (payload.sessionId !== sessionId) return;
      setSession((s) => s ? { ...s, status: 'not_resolved', agent_name: null } : s);
      setMessages((p) => [...p, { id: `sys-${Date.now()}`, sender: 'system', message: payload.message, timestamp: new Date().toISOString() }]);
    };

    socket.on('chat:message', onMsg);
    socket.on('chat:agent_joined', onAgentJoined);
    socket.on('chat:agent_typing', onTyping);
    socket.on('chat:messages_read', onRead);
    socket.on('chat:session_finished', onFinished);
    socket.on('chat:not_resolved', onNotResolved);

    return () => {
      socket.emit('leave:chat', sessionId);
      socket.off('chat:message', onMsg);
      socket.off('chat:agent_joined', onAgentJoined);
      socket.off('chat:agent_typing', onTyping);
      socket.off('chat:messages_read', onRead);
      socket.off('chat:session_finished', onFinished);
      socket.off('chat:not_resolved', onNotResolved);
    };
  }, [sessionId, userId, visitorId]);

  /* ── Start session ─────────────────────────── */
  const handleStart = useCallback(async (form: IntakeForm) => {
    setStarting(true);
    try {
      const { data } = await api.post('/chat/start', { ...form, visitorId });
      setSession(data.session);
      setMessages(Array.isArray(data.session.messages) ? data.session.messages : []);
    } catch { /* ignore */ } finally {
      setStarting(false);
    }
  }, [visitorId]);

  /* ── Send message ──────────────────────────── */
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? draft).trim();
    if (!msg || !sessionId || sending) return;
    setDraft('');
    setSending(true);

    const optimistic: Msg = { id: `opt-${Date.now()}`, sender: 'user', message: msg, timestamp: new Date().toISOString(), status: 'sent' };
    setMessages((p) => [...p, optimistic]);

    try {
      const { data } = await api.post('/chat/message', { sessionId, message: msg, visitorId });
      setMessages((p) => {
        const without = p.filter((m) => m.id !== optimistic.id);
        const updated = Array.isArray(data.session?.messages) ? data.session.messages : without;
        return updated;
      });
      if (data.escalated) {
        setSession((s) => s ? { ...s, status: 'waiting_agent' } : s);
      }
    } catch { /* keep optimistic */ } finally {
      setSending(false);
    }
  }, [draft, sessionId, visitorId, sending]);

  /* ── Typing indicator ──────────────────────── */
  const handleTyping = () => {
    if (!sessionId) return;
    api.post('/chat/typing', { sessionId }).catch(() => null);
  };

  /* ── Quick reply select ────────────────────── */
  const handleQuickReply = (reply: string) => {
    if (reply === 'Talk to a human' || reply === 'Yes, connect me to an agent') {
      api.post('/chat/escalate', { sessionId, visitorId })
        .then(({ data }) => {
          if (data.session) setSession((s) => s ? { ...s, status: 'waiting_agent' } : s);
        }).catch(() => null);
    } else {
      handleSend(reply);
    }
  };

  /* ── Keyboard send ─────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isFinished = session?.status === 'finished';

  /* ── Render ────────────────────────────────── */
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" style={{ height: 'calc(100vh - 130px)', minHeight: 560, display: 'flex', flexDirection: 'column' }}>

        {/* No session yet — show intake form */}
        {!session ? (
          <IntakeFormModal onStart={handleStart} loading={starting} />
        ) : (
          <>
            {/* Status header */}
            <StatusBar status={session.status} agentName={session.agent_name} />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isLast={i === messages.length - 1}
                />
              ))}

              {/* Quick replies for last bot message */}
              {(() => {
                const last = [...messages].reverse().find((m) => m.sender === 'bot' && m.quickReplies?.length);
                if (!last || session.status !== 'bot') return null;
                return (
                  <div className="mb-3 ml-9">
                    <QuickReplies replies={last.quickReplies!} onSelect={handleQuickReply} />
                  </div>
                );
              })()}

              {/* Agent typing */}
              {agentTyping && session.agent_name && (
                <TypingIndicator name={session.agent_name} />
              )}

              {/* Waiting state */}
              {session.status === 'waiting_agent' && (
                <div className="flex justify-center py-4">
                  <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Connecting you to an available agent…
                  </div>
                </div>
              )}

              {/* Finished state */}
              {isFinished && (
                <div className="py-4 text-center">
                  <div className="inline-flex flex-col items-center gap-2 rounded-2xl border border-border bg-muted/50 px-6 py-4">
                    <p className="text-sm font-medium text-foreground">This conversation has been resolved ✅</p>
                    <p className="text-xs text-muted-foreground">Thank you for contacting OceanBazar!</p>
                    <button
                      type="button"
                      onClick={() => { setSession(null); setMessages([]); }}
                      className="mt-1 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110"
                    >
                      Start New Chat
                    </button>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {!isFinished && (
              <div className="border-t border-border bg-background px-4 py-3">
                {/* Escalate button for bot mode */}
                {session.status === 'bot' && (
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleQuickReply('Talk to a human')}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <HeadphonesIcon className="h-3 w-3" />
                      Talk to a human agent
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); handleTyping(); }}
                    onKeyDown={handleKeyDown}
                    disabled={session.status === 'waiting_agent' || isFinished}
                    placeholder={session.status === 'waiting_agent' ? 'Waiting for an agent…' : 'Type a message…'}
                    className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm leading-snug placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                    style={{ maxHeight: 100, overflowY: 'auto' }}
                  />
                  <button
                    type="button"
                    disabled={!draft.trim() || sending || session.status === 'waiting_agent'}
                    onClick={() => handleSend()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-opacity hover:brightness-110"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground/50 px-1">Enter to send · Shift+Enter for new line</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
