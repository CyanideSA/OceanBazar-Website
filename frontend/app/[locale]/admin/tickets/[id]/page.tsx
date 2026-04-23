'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminStudio } from '@/lib/adminApi';

export default function AdminTicketDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const locale = useLocale();
  const qc = useQueryClient();
  const [productId, setProductId] = useState('');
  const [paymentTxId, setPaymentTxId] = useState('');
  const [reply, setReply] = useState('');

  const { data } = useQuery({
    queryKey: ['admin-ticket', id],
    queryFn: () => adminStudio.ticket(id).then((r) => r.data.ticket),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      adminStudio.updateTicket(id, {
        productId: productId || null,
        paymentTxId: paymentTxId || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ticket', id] }),
  });

  const replyMut = useMutation({
    mutationFn: () => adminStudio.replyTicket(id, reply),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['admin-ticket', id] });
    },
  });

  const t = data as
    | {
        id: string;
        subject: string;
        status: string;
        orderId?: string | null;
        productId?: string | null;
        paymentTxId?: string | null;
        user?: { name?: string; email?: string | null };
        order?: { orderNumber?: string };
        product?: { id: string; titleEn: string } | null;
        paymentTx?: { id: string; amount: unknown; status: string } | null;
        messages?: Array<{ message: string; senderType: string; createdAt: string }>;
      }
    | undefined;

  useEffect(() => {
    if (!data) return;
    const ticket = data as { productId?: string | null; paymentTxId?: string | null };
    setProductId(ticket.productId ?? '');
    setPaymentTxId(ticket.paymentTxId ?? '');
  }, [data]);

  return (
    <div className="space-y-6 p-6">
      <Link href={`/${locale}/admin/tickets`} className="text-sm text-primary hover:underline">
        ← Tickets
      </Link>
      {t ? (
        <>
          <div>
            <h1 className="text-xl font-bold">{t.subject}</h1>
            <p className="text-sm text-muted-foreground">
              {t.user?.name} · {t.status}
            </p>
            {t.order?.orderNumber ? <p className="text-sm">Order: {t.order.orderNumber}</p> : null}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h2 className="font-semibold">Links</h2>
            <label className="block text-xs">
              Product ID
              <input className="mt-1 w-full rounded border border-border px-2 py-1 font-mono text-sm" value={productId || t.productId || ''} onChange={(e) => setProductId(e.target.value)} />
            </label>
            <label className="block text-xs">
              Payment transaction ID
              <input className="mt-1 w-full rounded border border-border px-2 py-1 font-mono text-sm" value={paymentTxId || t.paymentTxId || ''} onChange={(e) => setPaymentTxId(e.target.value)} />
            </label>
            <button type="button" className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={() => updateMut.mutate()}>
              Save links
            </button>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold">Thread</h2>
            {t.messages?.map((m) => (
              <div key={m.createdAt + m.message.slice(0, 20)} className="rounded-lg border border-border p-3 text-sm">
                <span className="text-xs text-muted-foreground">{m.senderType}</span>
                <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <textarea className="min-h-[80px] flex-1 rounded-lg border border-border px-3 py-2 text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" />
            <button type="button" className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => replyMut.mutate()} disabled={!reply.trim()}>
              Send
            </button>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Loading…</p>
      )}
    </div>
  );
}
