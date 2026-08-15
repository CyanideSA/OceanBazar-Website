'use client';

import { useState } from 'react';
import { ordersApi } from '@/lib/api';

export default function PublicOrderTrackingPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await ordersApi.trackPublic(orderNumber.trim(), phone.trim());
      setResult(r.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not find order');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Track Your Order</h1>
      <p className="mt-1 text-sm text-muted-foreground">No login required. Enter order number and phone used during checkout.</p>

      <form onSubmit={submit} className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-4">
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order number (e.g. OB1234AB)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          required
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Track Order'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {result && (
        <div className="mt-5 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Order: <span className="font-semibold text-foreground">{result.orderNumber}</span></p>
          <p className="text-sm text-muted-foreground">Status: <span className="font-semibold capitalize text-foreground">{result.status}</span></p>
          <p className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">৳{Number(result.total || 0).toLocaleString()}</span></p>
          <div className="mt-3 space-y-2">
            {(result.timeline || []).map((t: any) => (
              <div key={`${t.status}-${t.createdAt}`} className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-sm font-semibold capitalize">{t.status}</p>
                <p className="text-xs text-muted-foreground">{t.note || ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
