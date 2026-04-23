'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminStudio } from '@/lib/adminApi';

export default function AdminCouponsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: () => adminStudio.coupons().then((r) => r.data.coupons),
  });
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed' | 'free_shipping'>('percent');
  const [value, setValue] = useState('10');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));

  const createMut = useMutation({
    mutationFn: () =>
      adminStudio.createCoupon({
        code,
        type,
        value: parseFloat(value) || 0,
        startsAt: new Date(startsAt).toISOString(),
        active: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] });
      setCode('');
    },
  });

  const coupons = data ?? [];

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Coupons</h1>
      <div className="max-w-md space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold">Create</h2>
        <input className="w-full rounded border border-border px-2 py-1 text-sm" placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <select className="w-full rounded border border-border px-2 py-1 text-sm" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="percent">percent</option>
          <option value="fixed">fixed (BDT)</option>
          <option value="free_shipping">free_shipping</option>
        </select>
        <input className="w-full rounded border border-border px-2 py-1 text-sm" value={value} onChange={(e) => setValue(e.target.value)} />
        <input type="date" className="w-full rounded border border-border px-2 py-1 text-sm" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        <button type="button" className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground" onClick={() => createMut.mutate()} disabled={!code}>
          Create
        </button>
      </div>
      <ul className="space-y-2">
        {coupons.map((c: { id: number; code: string; type: string; value: unknown; active: boolean }) => (
          <li key={c.id} className="rounded-lg border border-border px-3 py-2 text-sm">
            <span className="font-mono font-semibold">{c.code}</span> · {c.type} · {String(c.value)} · {c.active ? 'on' : 'off'}
          </li>
        ))}
      </ul>
    </div>
  );
}
