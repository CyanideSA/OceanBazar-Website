'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Plus, ChevronDown, ChevronUp, Send,
  AlertCircle, Clock, CheckCircle2, XCircle, Hash,
  ShoppingBag, Package, Tag, Paperclip, RefreshCw, X as XIcon,
} from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ticketsApi, api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { TicketRowSkeleton } from '@/components/shared/Skeleton';
import { useToast } from '@/hooks/useToast';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost:8000').replace(/\/$/, '');

type TicketMessage = { id?: string; message: string; createdAt: string; senderType?: string; attachments?: string[] };

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  updatedAt: string;
  createdAt?: string;
  orderId?: string | null;
  productId?: string | null;
  messages?: TicketMessage[];
};

const STATUS_CONFIG: Record<string, { icon: React.ElementType; cls: string }> = {
  open:        { icon: AlertCircle,   cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  in_progress: { icon: Clock,         cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  resolved:    { icon: CheckCircle2,  cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  closed:      { icon: XCircle,       cls: 'bg-muted text-muted-foreground' },
};

const PRIORITY_CONFIG: Record<string, { cls: string }> = {
  low:    { cls: 'bg-muted text-muted-foreground' },
  medium: { cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  high:   { cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  urgent: { cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400' },
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', cfg.cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', cfg.cls)}>
      {priority}
    </span>
  );
}

function TicketThread({ ticket, refetch }: { ticket: TicketRow; refetch: () => void }) {
  const [reply, setReply] = useState('');
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('tickets');
  const tc = useTranslations('common');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket.messages?.length]);

  const replyMutation = useMutation({
    mutationFn: () => ticketsApi.reply(ticket.id, reply.trim(), pendingFiles),
    onSuccess: async () => {
      setReply('');
      setPendingFiles([]);
      success(t('replySent'));
      refetch();
    },
    onError: () => toastError(tc('error')),
  });

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
      setPendingFiles((p) => [...p, data.url]);
    } catch { toastError(tc('error')); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const messages = ticket.messages ?? [];

  return (
    <div className="mt-4 border-t border-border pt-4">
      {/* Meta row */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {ticket.orderId && (
          <span className="flex items-center gap-1">
            <ShoppingBag className="h-3 w-3" />
            {t('orderId')}: <span className="font-mono font-semibold text-foreground">{ticket.orderId}</span>
          </span>
        )}
        {ticket.productId && (
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {t('productId')}: <span className="font-mono font-semibold text-foreground">{ticket.productId}</span>
          </span>
        )}
        <span className="flex items-center gap-1">
          <Tag className="h-3 w-3" />
          {ticket.category}
        </span>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('noMessages')}</p>
        ) : (
          messages.map((msg, i) => {
            const isAgent = msg.senderType === 'admin';
            return (
              <div key={i} className={cn(
                'flex gap-3',
                isAgent ? 'justify-start' : 'justify-end'
              )}>
                {isAgent && (
                  <span className="mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">S</span>
                )}
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm',
                  isAgent
                    ? 'rounded-tl-sm bg-primary/8 border border-primary/20 text-foreground'
                    : 'rounded-tr-sm bg-primary text-primary-foreground'
                )}>
                  <p className="mb-1 text-[11px] font-semibold opacity-70">
                    {isAgent ? t('supportTeam') : t('you')}
                  </p>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {msg.attachments.map((url, ai) => (
                        <a key={ai} href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-current/30 px-2 py-0.5 text-[11px] opacity-80 hover:opacity-100">
                          <Paperclip className="h-3 w-3" />Attachment
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words leading-snug">{msg.message}</p>
                  <p className="mt-1.5 text-[10px] opacity-60">{new Date(msg.createdAt).toLocaleString()}</p>
                </div>
                {!isAgent && (
                  <span className="mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">Me</span>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box — only if not closed/resolved */}
      {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
        <div className="mt-4 space-y-2">
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pendingFiles.map((url, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  <Paperclip className="h-3 w-3" />File {i + 1}
                  <button type="button" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}>
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-primary disabled:opacity-40">
              {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
              accept="image/*,.pdf,.doc,.docx,.txt" />
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (reply.trim() || pendingFiles.length) replyMutation.mutate(); }}}
              rows={2}
              placeholder={t('replyPlaceholder')}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              disabled={(!reply.trim() && pendingFiles.length === 0) || replyMutation.isPending}
              onClick={() => replyMutation.mutate()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, refetch }: { ticket: TicketRow; refetch: () => void }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('tickets');
  const statusLabel = t(`status_${ticket.status}` as Parameters<typeof t>[0]);
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-soft">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-semibold text-foreground">{ticket.subject}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} label={statusLabel} />
            <PriorityBadge priority={ticket.priority} />
            <span className="text-xs text-muted-foreground">
              {new Date(ticket.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        {open ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4">
          <TicketThread ticket={ticket} refetch={refetch} />
        </div>
      )}
    </li>
  );
}

export default function TicketsPage() {
  const locale = useLocale();
  const t = useTranslations('tickets');
  const tc = useTranslations('common');

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');
  const [category, setCategory] = useState('other');
  const [priority, setPriority] = useState('medium');
  const [orderId, setOrderId]   = useState('');
  const [productId, setProductId] = useState('');
  const [error, setError]       = useState('');

  const qc = useQueryClient();
  const stompRef = useRef<Client | null>(null);

  /* STOMP: subscribe to /user/queue/tickets for real-time pushes */
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const client = new Client({
      webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 12000,
    });
    client.onConnect = () => {
      client.subscribe('/user/queue/tickets', () => {
        qc.invalidateQueries({ queryKey: ['tickets'] });
      });
    };
    client.activate();
    stompRef.current = client;
    return () => { client.deactivate(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => ticketsApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      ticketsApi.create({
        subject: subject.trim(),
        message: message.trim(),
        category,
        priority,
        orderId: orderId.trim() || undefined,
        productId: productId.trim() || undefined,
      }).then((r) => r.data),
    onSuccess: async () => {
      setSubject(''); setMessage(''); setOrderId(''); setProductId('');
      setError(''); setShowForm(false);
      await refetch();
    },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? tc('error'));
    },
  });

  /* Backend returns flat array */
  const tickets: TicketRow[] = Array.isArray(rawData) ? rawData : (rawData as any)?.tickets ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:py-8">

      {/* Page header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6 sm:gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
            <MessageSquare className="h-6 w-6 text-primary" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('pageDesc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/account`} className="text-sm font-semibold text-primary hover:underline">
            {tc('back')}
          </Link>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            {t('newTicket')}
          </button>
        </div>
      </div>

      {/* How it works callout */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3 sm:mb-6 sm:p-5">
        {([
          { icon: Plus,         label: t('howStep1'),  sub: t('howStep1Sub') },
          { icon: Clock,        label: t('howStep2'),  sub: t('howStep2Sub') },
          { icon: CheckCircle2, label: t('howStep3'),  sub: t('howStep3Sub') },
        ] as { icon: React.ElementType; label: string; sub: string }[]).map((step) => (
          <div key={step.label} className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <step.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create form (collapsible) */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-card p-5 shadow-soft">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            {t('newTicket')}
          </h2>

          {error && (
            <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">{t('subject')} *</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('subjectPlaceholder')}
                className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">{t('orderIdOptional')}</label>
                <div className="relative mt-1">
                  <ShoppingBag className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="e.g. ORD-1234"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-8 pr-4 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">{t('productIdOptional')}</label>
                <div className="relative mt-1">
                  <Package className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    placeholder="e.g. PROD-5678"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-8 pr-4 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">{t('category')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                >
                  {Object.entries(t.raw('categories') as Record<string, string>).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">{t('priority')}</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                >
                  {['low', 'medium', 'high', 'urgent'].map((p) => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">{t('message')} *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={t('messagePlaceholder')}
                className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex flex-col gap-2 xs:flex-row">
              <button
                type="button"
                disabled={!subject.trim() || !message.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 min-h-[44px]"
              >
                {createMutation.isPending ? tc('loading') : t('submit')}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(''); }}
                className="rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground min-h-[44px]"
              >
                {tc('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket list */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">{t('yourTickets')}</h2>
          {tickets.length > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {tickets.length}
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <TicketRowSkeleton key={i} />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">{t('noTickets')}</p>
            <p className="text-sm text-muted-foreground">{t('noTicketsDesc')}</p>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              {t('newTicket')}
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {tickets.map((tk) => (
              <TicketCard key={tk.id} ticket={tk} refetch={refetch} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
