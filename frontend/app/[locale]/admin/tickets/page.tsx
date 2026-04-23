'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Send, CheckCheck, Check, AlertCircle, Clock,
  CheckCircle2, XCircle, ShoppingBag, Package, Tag, Hash,
  User, ChevronDown,
} from 'lucide-react';
import { adminStudio } from '@/lib/adminApi';
import { connectSocket, getSocket } from '@/lib/socket';
import { useAdminAuthStore } from '@/stores/adminAuthStore';
import { cn } from '@/lib/utils';

const adminTicketsApi = {
  list: (params?: object) => adminStudio.tickets(params),
  get: (id: string) => adminStudio.ticket(id),
  reply: (id: string, message: string, attachments?: string[]) => adminStudio.replyTicket(id, message, attachments),
  update: (id: string, data: object) => adminStudio.updateTicket(id, data),
  markSeen: (id: string) => adminStudio.markSeenTicket(id),
};

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
  user?: { id: string; name: string; email: string | null };
  messages?: ChatMessage[];
  order?: { orderNumber: string; status: string } | null;
  product?: { id: string; titleEn: string } | null;
};

const STATUS_CFG: Record<string, { label: string; Icon: React.ElementType; cls: string; dot: string }> = {
  open:        { label: 'Open',        Icon: AlertCircle,  cls: 'text-blue-600 dark:text-blue-400',    dot: 'bg-blue-500' },
  in_progress: { label: 'In Progress', Icon: Clock,        cls: 'text-amber-600 dark:text-amber-400',  dot: 'bg-amber-500' },
  resolved:    { label: 'Resolved',    Icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  closed:      { label: 'Closed',      Icon: XCircle,      cls: 'text-muted-foreground',                dot: 'bg-muted-foreground/50' },
};

const PRIORITY_CLS: Record<string, string> = {
  low:    'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  high:   'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  urgent: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'] as const;

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function AdminChatPage() {
  const qc = useQueryClient();
  const { admin } = useAdminAuthStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // List
  const { data: listData, isLoading } = useQuery({
    queryKey: ['admin-chat-tickets', filterStatus],
    queryFn: () => adminTicketsApi.list(filterStatus ? { status: filterStatus } : {})
      .then((r) => r.data as { tickets: TicketRow[] }),
    refetchInterval: 15_000,
  });
  const tickets = listData?.tickets ?? [];

  // Detail
  const { data: detailData } = useQuery({
    queryKey: ['admin-chat-ticket', activeId],
    queryFn: () => adminTicketsApi.get(activeId!).then((r) => r.data as { ticket: TicketRow }),
    enabled: !!activeId,
  });
  const activeTicket = detailData?.ticket ?? tickets.find((t) => t.id === activeId);

  useEffect(() => {
    if (detailData?.ticket?.messages) setMessages(detailData.ticket.messages);
  }, [detailData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark seen when opening
  useEffect(() => {
    if (activeId) adminTicketsApi.markSeen(activeId).catch(() => null);
  }, [activeId, messages.length]);

  // Socket
  useEffect(() => {
    const socket = connectSocket();
    socket.emit('join:admin-chat');

    const onMessage = (payload: { ticketId: string; message: ChatMessage }) => {
      if (payload.ticketId === activeId) {
        setMessages((prev) => prev.find((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]);
        adminTicketsApi.markSeen(payload.ticketId).catch(() => null);
      }
      qc.invalidateQueries({ queryKey: ['admin-chat-tickets'] });
    };

    const onNew = () => {
      qc.invalidateQueries({ queryKey: ['admin-chat-tickets'] });
    };

    const onSeen = (payload: { ticketId: string }) => {
      if (payload.ticketId === activeId) {
        setMessages((prev) =>
          prev.map((m) => m.senderType === 'admin' && !m.seenAt ? { ...m, seenAt: new Date().toISOString() } : m)
        );
      }
    };

    socket.on('ticket:message', onMessage);
    socket.on('ticket:new', onNew);
    socket.on('ticket:seen', onSeen);

    return () => {
      socket.off('ticket:message', onMessage);
      socket.off('ticket:new', onNew);
      socket.off('ticket:seen', onSeen);
      socket.emit('leave:admin-chat');
    };
  }, [activeId, qc]);

  // Join ticket room when selected
  useEffect(() => {
    if (!activeId) return;
    const socket = getSocket();
    socket.emit('join:ticket', activeId);
    return () => { socket.emit('leave:ticket', activeId); };
  }, [activeId]);

  // Reply
  const replyMutation = useMutation({
    mutationFn: () => adminTicketsApi.reply(activeId!, draft.trim()),
    onSuccess: (res) => {
      const msg = (res.data as { message: ChatMessage }).message;
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      qc.invalidateQueries({ queryKey: ['admin-chat-tickets'] });
    },
  });

  // Status change
  const statusMutation = useMutation({
    mutationFn: (status: string) => adminTicketsApi.update(activeId!, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-chat-ticket', activeId] });
      qc.invalidateQueries({ queryKey: ['admin-chat-tickets'] });
    },
  });

  const handleSend = useCallback(() => {
    if (!draft.trim() || replyMutation.isPending) return;
    replyMutation.mutate();
  }, [draft, replyMutation]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const unreadCount = (tk: TicketRow) =>
    (tk.messages ?? []).filter((m) => m.senderType === 'customer' && !m.seenAt).length;

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <div className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
          {/* Header */}
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">Support Chat</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {tickets.length}
              </span>
            </div>
            {/* Filter */}
            <div className="relative mt-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <MessageSquare className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No conversations</p>
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
                      'flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-3 text-left transition-colors hover:bg-muted/40',
                      activeId === tk.id && 'bg-primary/5'
                    )}
                  >
                    <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', cfg.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="truncate text-xs font-semibold text-foreground">{tk.subject}</p>
                        {unread > 0 && (
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                            {unread}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {tk.user?.name ?? 'Customer'}
                      </p>
                      {lastMsg && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                          {lastMsg.senderType === 'admin' ? '↩ ' : ''}{lastMsg.message}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground/50">{formatTime(tk.updatedAt)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat Panel ─────────────────────────────────────────────── */}
        {activeId && activeTicket ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Chat header */}
            <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{activeTicket.subject}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {(() => {
                    const cfg = STATUS_CFG[activeTicket.status] ?? STATUS_CFG.open;
                    const Icon = cfg.Icon;
                    return <span className={cn('flex items-center gap-1 font-medium', cfg.cls)}><Icon className="h-3 w-3" />{cfg.label}</span>;
                  })()}
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', PRIORITY_CLS[activeTicket.priority])}>
                    {activeTicket.priority}
                  </span>
                  {activeTicket.user && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {activeTicket.user.name}
                      {activeTicket.user.email && ` · ${activeTicket.user.email}`}
                    </span>
                  )}
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
                  <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{activeTicket.category}</span>
                  <span className="flex items-center gap-1 font-mono"><Hash className="h-3 w-3" />{activeTicket.id}</span>
                </div>
              </div>
              {/* Quick status change */}
              <div className="relative shrink-0">
                <select
                  value={activeTicket.status}
                  onChange={(e) => statusMutation.mutate(e.target.value)}
                  className="appearance-none rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto bg-muted/10 px-5 py-5">
              {messages.map((msg, i) => {
                const isAdmin = msg.senderType === 'admin';
                const isFirst = i === 0 || messages[i - 1].senderType !== msg.senderType;
                return (
                  <div key={msg.id} className={cn('flex gap-2.5', isAdmin ? 'flex-row-reverse' : 'flex-row')}>
                    {isFirst ? (
                      <div className={cn(
                        'mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        isAdmin ? 'bg-primary text-primary-foreground' : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      )}>
                        {isAdmin ? (admin?.name?.[0] ?? 'A') : (activeTicket.user?.name?.[0] ?? 'C')}
                      </div>
                    ) : <div className="w-7 shrink-0" />}

                    <div className={cn('flex max-w-[70%] flex-col', isAdmin ? 'items-end' : 'items-start')}>
                      {isFirst && (
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                          {isAdmin ? (admin?.name ?? 'Support') : (activeTicket.user?.name ?? 'Customer')}
                        </p>
                      )}
                      <div className={cn(
                        'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                        isAdmin
                          ? 'rounded-tr-sm bg-primary text-primary-foreground'
                          : 'rounded-tl-sm bg-card border border-border text-foreground'
                      )}>
                        {msg.message}
                      </div>
                      <div className={cn('mt-1 flex items-center gap-1 text-[11px] text-muted-foreground', isAdmin ? 'flex-row-reverse' : 'flex-row')}>
                        <span>{formatTime(msg.createdAt)}</span>
                        {isAdmin && (msg.seenAt
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

            {/* Reply input */}
            <div className="border-t border-border bg-card px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  placeholder="Reply as support team… (Enter to send)"
                  className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ maxHeight: 120, overflowY: 'auto' }}
                />
                <button
                  type="button"
                  disabled={!draft.trim() || replyMutation.isPending}
                  onClick={handleSend}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground">Select a conversation</p>
            <p className="text-sm text-muted-foreground">Choose from the sidebar to view and reply</p>
          </div>
        )}
      </div>
    </div>
  );
}
