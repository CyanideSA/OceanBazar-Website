'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Plus, Send, CheckCheck, Check,
  AlertCircle, Clock, CheckCircle2, XCircle,
  ShoppingBag, Package, Tag, Hash, X, ChevronLeft,
} from 'lucide-react';
import { ticketsApi } from '@/lib/api';
import { connectSocket, getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

type ChatMessage = {
  id: number;
  ticketId: string;
  senderType: 'customer' | 'admin';
  senderId: string;
  message: string;
  attachments: string[];
  seenAt: string | null;
  createdAt: string;
};

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  orderId?: string | null;
  productId?: string | null;
  updatedAt: string;
  createdAt: string;
  messages?: ChatMessage[];
  order?: { orderNumber: string; status: string } | null;
  product?: { id: string; titleEn: string } | null;
};

const STATUS_CFG: Record<string, { label: string; Icon: React.ElementType; cls: string; dot: string }> = {
  open:        { label: 'Open',        Icon: AlertCircle,  cls: 'text-blue-600 dark:text-blue-400',    dot: 'bg-blue-500' },
  in_progress: { label: 'In Progress', Icon: Clock,        cls: 'text-amber-600 dark:text-amber-400',  dot: 'bg-amber-500' },
  resolved:    { label: 'Resolved',    Icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  closed:      { label: 'Closed',      Icon: XCircle,      cls: 'text-muted-foreground',                dot: 'bg-muted-foreground' },
};

const PRIORITY_CLS: Record<string, string> = {
  low:    'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  high:   'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  urgent: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

const CATEGORIES = ['payment', 'delivery', 'product', 'other'];

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatPage() {
  const locale = useLocale();
  const tc = useTranslations('common');
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newOrderId, setNewOrderId] = useState('');
  const [newProductId, setNewProductId] = useState('');
  const [createError, setCreateError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch ticket list
  const { data: listData } = useQuery({
    queryKey: ['chat-tickets'],
    queryFn: () => ticketsApi.list().then((r) => r.data as { tickets: TicketRow[] }),
    refetchInterval: 30_000,
  });
  const tickets = listData?.tickets ?? [];

  // Fetch active ticket detail
  const { data: detailData } = useQuery({
    queryKey: ['chat-ticket', activeId],
    queryFn: () => ticketsApi.get(activeId!).then((r) => r.data as { ticket: TicketRow }),
    enabled: !!activeId,
  });
  const activeTicket = detailData?.ticket ?? tickets.find((t) => t.id === activeId);

  // Sync messages from detail fetch
  useEffect(() => {
    if (detailData?.ticket?.messages) {
      setMessages(detailData.ticket.messages);
    }
  }, [detailData]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark seen when opening a ticket
  useEffect(() => {
    if (activeId) {
      ticketsApi.markSeen(activeId).catch(() => null);
    }
  }, [activeId, messages.length]);

  // Socket.io real-time
  useEffect(() => {
    const socket = connectSocket();

    const onMessage = (payload: { ticketId: string; message: ChatMessage }) => {
      if (payload.ticketId === activeId) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
        ticketsApi.markSeen(payload.ticketId).catch(() => null);
      }
      qc.invalidateQueries({ queryKey: ['chat-tickets'] });
    };

    const onSeen = (payload: { ticketId: string }) => {
      if (payload.ticketId === activeId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderType === 'customer' && !m.seenAt
              ? { ...m, seenAt: new Date().toISOString() }
              : m
          )
        );
      }
    };

    socket.on('ticket:message', onMessage);
    socket.on('ticket:seen', onSeen);

    return () => {
      socket.off('ticket:message', onMessage);
      socket.off('ticket:seen', onSeen);
    };
  }, [activeId, qc]);

  // Join/leave ticket room on active change
  useEffect(() => {
    if (!activeId) return;
    const socket = getSocket();
    socket.emit('join:ticket', activeId);
    return () => { socket.emit('leave:ticket', activeId); };
  }, [activeId]);

  // Send reply
  const replyMutation = useMutation({
    mutationFn: () => ticketsApi.reply(activeId!, draft.trim()),
    onSuccess: (res) => {
      const msg = (res.data as { message: ChatMessage }).message;
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      qc.invalidateQueries({ queryKey: ['chat-tickets'] });
    },
  });

  const handleSend = useCallback(() => {
    if (!draft.trim() || replyMutation.isPending) return;
    replyMutation.mutate();
  }, [draft, replyMutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Create new ticket
  const createMutation = useMutation({
    mutationFn: () =>
      ticketsApi.create({
        subject: newSubject.trim(),
        message: newMessage.trim(),
        category: newCategory,
        priority: 'medium',
        orderId: newOrderId.trim() || undefined,
        productId: newProductId.trim() || undefined,
      }).then((r) => r.data as { ticket: TicketRow }),
    onSuccess: (res) => {
      setShowNew(false);
      setNewSubject(''); setNewMessage(''); setNewOrderId(''); setNewProductId('');
      setCreateError('');
      qc.invalidateQueries({ queryKey: ['chat-tickets'] });
      setActiveId(res.ticket.id);
    },
    onError: (e: unknown) => {
      setCreateError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to create ticket.');
    },
  });

  const unreadCount = (tk: TicketRow) => {
    if (!tk.messages) return 0;
    return tk.messages.filter((m) => m.senderType === 'admin' && !m.seenAt).length;
  };

  const isClosed = activeTicket && ['resolved', 'closed'].includes(activeTicket.status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <MessageSquare className="h-5 w-5 text-primary" />
            Support Chat
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Real-time support conversations</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowNew(true); setActiveId(null); }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="flex overflow-hidden rounded-2xl border border-border bg-card shadow-soft" style={{ height: 'calc(100vh - 200px)', minHeight: 520 }}>

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className={cn(
          'flex w-full flex-col border-r border-border lg:w-80 lg:flex-shrink-0',
          activeId && 'hidden lg:flex'
        )}>
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tickets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
              </div>
            ) : (
              tickets.map((tk) => {
                const cfg = STATUS_CFG[tk.status] ?? STATUS_CFG.open;
                const unread = unreadCount(tk);
                const lastMsg = tk.messages?.[0];
                return (
                  <button
                    key={tk.id}
                    type="button"
                    onClick={() => setActiveId(tk.id)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-border/60 px-4 py-3.5 text-left transition-colors hover:bg-muted/40',
                      activeId === tk.id && 'bg-primary/5 hover:bg-primary/5'
                    )}
                  >
                    <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{tk.subject}</p>
                        {unread > 0 && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {unread}
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {lastMsg.senderType === 'admin' ? '↩ ' : ''}{lastMsg.message}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{formatTime(tk.updatedAt)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* New ticket dialog — outside chat panel so it's visible on mobile */}
        {showNew && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowNew(false)}>
            <div
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <Plus className="h-4 w-4 text-primary" />
                  New Support Chat
                </h2>
                <button type="button" onClick={() => setShowNew(false)} className="rounded-lg p-1 hover:bg-muted transition-colors">
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                {createError && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{createError}</p>
                )}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Subject *</label>
                  <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="What do you need help with?"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Category</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Order ID (optional)</label>
                  <div className="relative">
                    <ShoppingBag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input value={newOrderId} onChange={(e) => setNewOrderId(e.target.value)}
                      placeholder="ORD-1234"
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Product ID (optional)</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input value={newProductId} onChange={(e) => setNewProductId(e.target.value)}
                      placeholder="PROD-5678"
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Message *</label>
                  <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                    rows={4} placeholder="Describe your issue in detail..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <button type="button"
                  disabled={!newSubject.trim() || !newMessage.trim() || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 transition-all hover:brightness-110">
                  {createMutation.isPending ? tc('loading') : 'Start Conversation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Chat Panel ───────────────────────────────────────────── */}
        <div className={cn('flex flex-1 flex-col', !activeId && 'hidden lg:flex')}>

          {activeId && activeTicket ? (
            /* Active conversation */
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Chat header */}
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => setActiveId(null)} className="mt-0.5 lg:hidden">
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{activeTicket.subject}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {(() => {
                        const cfg = STATUS_CFG[activeTicket.status] ?? STATUS_CFG.open;
                        const Icon = cfg.Icon;
                        return (
                          <span className={cn('flex items-center gap-1 font-medium', cfg.cls)}>
                            <Icon className="h-3 w-3" />{cfg.label}
                          </span>
                        );
                      })()}
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', PRIORITY_CLS[activeTicket.priority])}>
                        {activeTicket.priority}
                      </span>
                      {activeTicket.orderId && (
                        <span className="flex items-center gap-1">
                          <ShoppingBag className="h-3 w-3" />
                          {activeTicket.order?.orderNumber ?? activeTicket.orderId}
                        </span>
                      )}
                      {activeTicket.productId && (
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {activeTicket.product?.titleEn ?? activeTicket.productId}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />{activeTicket.category}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="mt-1 shrink-0 text-xs text-muted-foreground">
                  <Hash className="inline h-3 w-3" />{activeTicket.id}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {messages.map((msg, i) => {
                  const isMe = msg.senderType === 'customer';
                  const isFirst = i === 0 || messages[i - 1].senderType !== msg.senderType;
                  return (
                    <div key={msg.id} className={cn('flex gap-2.5', isMe ? 'flex-row-reverse' : 'flex-row')}>
                      {/* Avatar dot */}
                      {isFirst && (
                        <div className={cn(
                          'mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        )}>
                          {isMe ? (user?.name?.[0] ?? 'U') : 'S'}
                        </div>
                      )}
                      {!isFirst && <div className="w-7 shrink-0" />}

                      <div className={cn('flex max-w-[72%] flex-col', isMe ? 'items-end' : 'items-start')}>
                        {isFirst && (
                          <p className="mb-1 text-xs font-semibold text-muted-foreground">
                            {isMe ? 'You' : 'Support Team'}
                          </p>
                        )}
                        <div className={cn(
                          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                          isMe
                            ? 'rounded-tr-sm bg-primary text-primary-foreground'
                            : 'rounded-tl-sm bg-muted text-foreground'
                        )}>
                          {msg.message}
                        </div>
                        {/* Time + seen */}
                        <div className={cn('mt-1 flex items-center gap-1 text-[11px] text-muted-foreground', isMe ? 'flex-row-reverse' : 'flex-row')}>
                          <span>{formatTime(msg.createdAt)}</span>
                          {isMe && (
                            msg.seenAt
                              ? <CheckCheck className="h-3 w-3 text-primary" />
                              : <Check className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              {isClosed ? (
                <div className="border-t border-border px-5 py-4 text-center text-sm text-muted-foreground">
                  This conversation is {activeTicket.status}. <Link href={`/${locale}/chat`} className="text-primary hover:underline" onClick={() => { setShowNew(true); setActiveId(null); }}>Open a new one</Link>
                </div>
              ) : (
                <div className="border-t border-border px-4 py-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder="Write a message… (Enter to send, Shift+Enter for newline)"
                      className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ maxHeight: 120, overflowY: 'auto' }}
                    />
                    <button
                      type="button"
                      disabled={!draft.trim() || replyMutation.isPending}
                      onClick={handleSend}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground/60 px-1">Enter to send · Shift+Enter for new line</p>
                </div>
              )}
            </div>
          ) : (
            /* Empty state — desktop */
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 text-center lg:flex">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="font-semibold text-foreground">Select a conversation</p>
              <p className="text-sm text-muted-foreground">Choose from the left or start a new chat</p>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <Plus className="h-4 w-4" />New Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
