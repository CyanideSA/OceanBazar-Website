'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MessageCircle, X, Minus, Send, Paperclip, Bot,
  CheckCheck, RefreshCw, HelpCircle
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ChatMessageRenderer, type ChatMessage } from './ChatMessageRenderer';

const BFF_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

const QUICK_ACTIONS = [
  'Track Order',
  'Browse Products',
  'My Cart',
  'Return Item',
  'Talk to Human',
  'Payment Help',
] as const;

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('ob_visitor_id');
  if (!id) {
    id = `visitor-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('ob_visitor_id', id);
  }
  return id;
}

interface ChatSession {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_issue: string | null;
  messages: ChatMessage[];
  is_active: boolean;
  agent_engaged: boolean;
  status: string;
  last_message_at: string | null;
}

type WidgetState = 'closed' | 'open' | 'minimised';
type ChatPhase = 'pre_chat' | 'chatting';

export default function ChatWidget() {
  const t = useTranslations('chat');
  const { user, isAuthenticated } = useAuthStore();
  const [visitorId, setVisitorId] = useState('');
  useEffect(() => { setVisitorId(getVisitorId()); }, []);
  const [widgetState, setWidgetState] = useState<WidgetState>('closed');
  const [session, setSession] = useState<ChatSession | null>(null);
  const [phase, setPhase] = useState<ChatPhase>('pre_chat');
  const [inputText, setInputText] = useState('');
  const [issueText, setIssueText] = useState('');
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [unread, setUnread] = useState(0);
  const [agentTyping, setAgentTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const widgetStateRef = useRef(widgetState);
  const agentTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmit = useRef(0);
  useEffect(() => { widgetStateRef.current = widgetState; }, [widgetState]);

  /* ── Scroll to bottom ── */
  useEffect(() => {
    if (widgetState === 'open') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.messages, widgetState]);

  /* ── Clear unread when opened ── */
  useEffect(() => {
    if (widgetState === 'open') setUnread(0);
  }, [widgetState]);

  /* ── Load existing session on open ── */
  const loadSession = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/session', { params: { visitorId: isAuthenticated ? undefined : visitorId } });
      const s = data?.session ?? null;
      setSession(s);
      if (s && Array.isArray(s.messages) && s.messages.length > 0) {
        setPhase('chatting');
      } else if (s) {
        setPhase('chatting');
      } else {
        setPhase('pre_chat');
      }
    } catch {
      setSession(null);
      setPhase('pre_chat');
    }
  }, [isAuthenticated, visitorId]);

  useEffect(() => {
    if (widgetState === 'open') loadSession();
  }, [widgetState, loadSession]);

  /* ── Socket.IO connection to BFF ── */
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const socket = io(BFF_URL, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setWsConnected(true);
      // Join the user-specific room for realtime events
      socket.emit('join:user', user.id);
    });

    socket.on('disconnect', () => setWsConnected(false));

    // Agent sent a message
    socket.on('chat:message', (payload: { sessionId: string; message: ChatMessage }) => {
      setSession((prev) => {
        if (!prev || prev.id !== payload.sessionId) return prev;
        const exists = prev.messages.find((m) => m.id === payload.message?.id);
        if (exists) return prev;
        return { ...prev, messages: [...prev.messages, payload.message] };
      });
      if (widgetStateRef.current !== 'open') {
        setUnread((n) => n + 1);
      }
    });

    // Agent joined
    socket.on('chat:agent_joined', (payload: { sessionId: string; agentName: string; message: ChatMessage; systemMessage: ChatMessage }) => {
      setSession((prev) => {
        if (!prev || prev.id !== payload.sessionId) return prev;
        const newMsgs = [...prev.messages];
        if (payload.systemMessage && !newMsgs.find((m) => m.id === payload.systemMessage.id)) {
          newMsgs.push(payload.systemMessage);
        }
        if (payload.message && !newMsgs.find((m) => m.id === payload.message.id)) {
          newMsgs.push(payload.message);
        }
        return { ...prev, messages: newMsgs, agent_engaged: true, status: 'active' };
      });
      if (widgetStateRef.current !== 'open') setUnread((n) => n + 1);
    });

    // Session finished by agent
    socket.on('chat:session_finished', () => {
      setSession((prev) => prev ? { ...prev, status: 'finished', is_active: false } : null);
    });

    // Agent typing
    socket.on('chat:agent_typing', () => {
      setAgentTyping(true);
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
      agentTypingTimer.current = setTimeout(() => setAgentTyping(false), 3500);
    });

    // Messages read by agent
    socket.on('chat:messages_read', () => {
      setSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.sender === 'user' && !m.readAt ? { ...m, readAt: new Date().toISOString(), status: 'read' } : m
          ),
        };
      });
    });

    // Not resolved — re-queued
    socket.on('chat:not_resolved', (payload: { message: string }) => {
      setSession((prev) => {
        if (!prev) return null;
        const sysMsg: ChatMessage = { id: `sys-${Date.now()}`, sender: 'system', message: payload.message, timestamp: new Date().toISOString() };
        return { ...prev, messages: [...prev.messages, sysMsg], status: 'waiting_agent', agent_engaged: false };
      });
    });

    return () => {
      socket.emit('leave:user', user.id);
      socket.disconnect();
      socketRef.current = null;
      setWsConnected(false);
      if (agentTypingTimer.current) clearTimeout(agentTypingTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  /* ── Start chat session (pre-chat form submit) ── */
  const handleStartChat = async () => {
    if (!issueText.trim() || starting) return;
    setStarting(true);
    try {
      const { data } = await api.post('/chat/start', {
        name: user?.name || 'Guest',
        email: user?.email || null,
        phone: user?.phone || null,
        issue: issueText.trim(),
        visitorId: isAuthenticated ? undefined : visitorId,
      });
      const s = data?.session ?? null;
      setSession(s);
      setPhase('chatting');
      setIssueText('');
    } catch {
      /* ignore */
    } finally {
      setStarting(false);
    }
  };

  /* ── Customer typing emission (throttled to once per 2 s) ── */
  const emitCustomerTyping = useCallback(() => {
    if (!session?.id) return;
    const now = Date.now();
    if (now - lastTypingEmit.current < 2000) return;
    lastTypingEmit.current = now;
    api.post('/chat/typing', { sessionId: session.id }).catch(() => {});
  }, [session?.id]);

  /* ── Send message ── */
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text && pendingFiles.length === 0) return;
    if (sending) return;
    setSending(true);

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      message: text,
      sender: 'user',
      timestamp: new Date().toISOString(),
      attachments: pendingFiles,
    };

    setSession((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, optimistic] }
        : null
    );
    setInputText('');
    setPendingFiles([]);

    try {
      const { data } = await api.post('/chat/message', {
        sessionId: session?.id,
        message: text || '📎 Attachment',
        visitorId: isAuthenticated ? undefined : visitorId,
      });
      if (data?.session) {
        setSession(data.session as ChatSession);
      }
    } catch {
      // Revert optimistic message
      setSession((prev) =>
        prev
          ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimistic.id) }
          : null
      );
    } finally {
      setSending(false);
    }
  }, [inputText, pendingFiles, sending, session?.id, isAuthenticated, visitorId]);

  const runQuickAction = useCallback(async (action: string) => {
    const key = action.toLowerCase().replace(/\s+/g, '_');
    if (key === 'talk_to_human') {
      try {
        await api.post('/chat/escalate', { sessionId: session?.id, visitorId: isAuthenticated ? undefined : visitorId });
        loadSession();
      } catch { /* ignore */ }
      return;
    }
    try {
      const { data } = await api.post('/chat/action', {
        sessionId: session?.id,
        action: key,
        visitorId: isAuthenticated ? undefined : visitorId,
      });
      if (data?.session) setSession(data.session);
      else if (!session) {
        await api.post('/chat/start', { name: user?.name || 'Guest', issue: action, visitorId: isAuthenticated ? undefined : visitorId });
        loadSession();
      }
    } catch { /* ignore */ }
  }, [session?.id, isAuthenticated, visitorId, user?.name, loadSession]);

  const handleQuickReply = useCallback((text: string) => {
    if (text.toLowerCase().includes('human')) {
      void runQuickAction('Talk to Human');
      return;
    }
    setInputText(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [runQuickAction]);

  /* ── File upload ── */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/tickets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPendingFiles((prev) => [...prev, data.url]);
    } catch { /* ignore */ } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ── Close session ── */
  const closeSession = async () => {
    try { await api.post('/chat/session/close', { sessionId: session?.id }); } catch { /* ignore */ }
    setSession(null);
    setPhase('pre_chat');
    setWidgetState('closed');
  };

  /* ── Keyboard send ── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const messages = session?.messages ?? [];
  const isFinished = session?.status === 'finished';

  // Launcher button
  const Launcher = (
    <button
      type="button"
      onClick={() => setWidgetState('open')}
      className={cn(
        'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-xl ring-4 ring-primary/20 transition-transform hover:scale-105 active:scale-95'
      )}
      aria-label="Open chat"
    >
      <MessageCircle className="h-6 w-6 text-primary-foreground" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );

  if (widgetState === 'closed') return Launcher;

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] sm:hidden',
          widgetState !== 'open' ? 'hidden' : ''
        )}
        onClick={() => setWidgetState('minimised')}
      />
      <div
        className={cn(
          'fixed bottom-6 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-border/60 glass shadow-2xl transition-all sm:right-6 sm:w-[420px]',
          widgetState === 'minimised' ? 'h-14' : 'h-[500px] max-h-[80vh]',
        )}
      >
        {/* Header */}
        <div className="flex h-14 flex-none items-center justify-between gap-2 border-b border-border/60 bg-primary/95 px-4 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Bot className="h-4 w-4 text-primary-foreground" />
              <span className={cn(
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary',
                wsConnected ? 'bg-emerald-400' : 'bg-amber-400'
              )} />
            </span>
            <div>
              <p className="text-sm font-semibold text-primary-foreground">{t('title')}</p>
              <p className="text-[10px] font-medium text-primary-foreground/70">{t('subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWidgetState(widgetState === 'minimised' ? 'open' : 'minimised')}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary-foreground/80 hover:bg-white/10"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={closeSession}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary-foreground/80 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {widgetState === 'open' && (
          <>
            {/* ── Pre-chat form (query only for logged-in users) ── */}
            {phase === 'pre_chat' && !session && (
              <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <HelpCircle className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">Hi{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Tell us what you need help with and we&apos;ll connect you right away.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">What do you need help with?</label>
                    <select
                      value={issueText}
                      onChange={(e) => setIssueText(e.target.value)}
                      className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Select a topic…</option>
                      <option value="Order Status">Order Status</option>
                      <option value="Shipping & Delivery">Shipping &amp; Delivery</option>
                      <option value="Returns & Refunds">Returns &amp; Refunds</option>
                      <option value="Payment Issue">Payment Issue</option>
                      <option value="Product Question">Product Question</option>
                      <option value="Account Issue">Account Issue</option>
                      <option value="Coupon / Discount">Coupon / Discount</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={!issueText.trim() || starting}
                    onClick={handleStartChat}
                    className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                  >
                    {starting ? 'Starting…' : 'Start Live Chat'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Chat messages ── */}
            {(phase === 'chatting' || session) && (
              <>
                <div className="flex-1 overflow-y-auto scroll-smooth px-3 py-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                      <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">How can we help you today?</p>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <ChatMessageRenderer
                      key={msg.id}
                      msg={msg}
                      userInitial={user?.name?.[0]?.toUpperCase() ?? 'G'}
                      onQuickReply={handleQuickReply}
                      onAction={(action, payload) => void runQuickAction(action)}
                    />
                  ))}
                  {agentTyping && (
                    <div className="flex items-end gap-2">
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </span>
                      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                        <div className="flex gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {!isFinished && (
                  <div className="flex flex-none gap-1 overflow-x-auto border-t border-border/60 px-2 py-2">
                    {QUICK_ACTIONS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => void runQuickAction(a)}
                        className="shrink-0 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold text-foreground hover:bg-primary/10"
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                )}

                {/* Finished banner */}
                {isFinished && (
                  <div className="border-t border-border bg-muted/50 px-4 py-3 text-center">
                    <p className="text-xs text-muted-foreground">This conversation has been resolved.</p>
                    <button
                      type="button"
                      onClick={() => { setSession(null); setPhase('pre_chat'); }}
                      className="mt-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Start a new conversation
                    </button>
                  </div>
                )}

                {/* Pending file chips */}
                {!isFinished && pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
                    {pendingFiles.map((url, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Paperclip className="h-3 w-3" />
                        File {i + 1}
                        <button type="button" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Input */}
                {!isFinished && (
                  <div className="flex flex-none items-end gap-2 border-t border-border bg-background px-3 py-3">
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                    >
                      {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile}
                      accept="image/*,.pdf,.doc,.docx,.txt" />
                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={inputText}
                      onChange={(e) => { setInputText(e.target.value); emitCustomerTyping(); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message…"
                      className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      style={{ maxHeight: 80, overflowY: 'auto' }}
                    />
                    <button
                      type="button"
                      disabled={sending || (!inputText.trim() && pendingFiles.length === 0)}
                      onClick={sendMessage}
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
