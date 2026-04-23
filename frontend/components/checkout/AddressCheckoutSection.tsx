'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { profileApi } from '@/lib/api';
import type { SavedAddress } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  addresses: SavedAddress[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const emptyForm = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  district: '',
  postalCode: '',
  isDefault: false,
};

export default function AddressCheckoutSection({ addresses, selectedId, onSelect }: Props) {
  const t = useTranslations('checkout');
  const tc = useTranslations('common');
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });

  const createMut = useMutation({
    mutationFn: async () => (await profileApi.addAddress(form)).data,
    onSuccess: () => {
      invalidate();
      setMode('list');
      setForm(emptyForm);
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => (await profileApi.updateAddress(editId!, form)).data,
    onSuccess: () => {
      invalidate();
      setMode('list');
      setEditId(null);
      setForm(emptyForm);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => profileApi.deleteAddress(id),
    onSuccess: () => invalidate(),
  });

  function startAdd() {
    setForm(emptyForm);
    setEditId(null);
    setMode('add');
  }

  function startEdit(addr: SavedAddress) {
    setEditId(addr.id);
    setForm({
      label: addr.label,
      line1: addr.line1,
      line2: addr.line2 ?? '',
      city: addr.city,
      district: addr.district,
      postalCode: addr.postalCode ?? '',
      isDefault: addr.isDefault,
    });
    setMode('edit');
  }

  if (mode === 'add' || mode === 'edit') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-foreground">{mode === 'add' ? t('addAddress') : t('editAddress')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{t('addrLabel')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{t('addrLine1')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.line1}
              onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
            />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{t('addrLine2')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.line2}
              onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
            />
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">{t('addrCity')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">{t('addrDistrict')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.district}
              onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
            />
          </label>
          <label>
            <span className="text-xs font-medium text-muted-foreground">{t('addrPostal')}</span>
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={form.postalCode}
              onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            <span className="text-sm text-foreground">{t('addrDefault')}</span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('list');
              setEditId(null);
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            {tc('cancel')}
          </button>
          <button
            type="button"
            disabled={!form.label || !form.line1 || !form.city || !form.district || createMut.isPending || updateMut.isPending}
            onClick={() => (mode === 'add' ? createMut.mutate() : updateMut.mutate())}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t('saveAddress')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <MapPin className="h-5 w-5 text-primary" />
          {t('shippingAddress')}
        </h2>
        <button
          type="button"
          onClick={startAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
        >
          <Plus className="h-4 w-4" />
          {t('addAddress')}
        </button>
      </div>

      {addresses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {t('addressRequiredHint')}
        </p>
      ) : (
        <ul className="space-y-2">
          {addresses.map((addr) => (
            <li key={addr.id}>
              <div
                className={cn(
                  'flex gap-3 rounded-xl border-2 p-4 transition-colors',
                  selectedId === addr.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                )}
              >
                <input
                  type="radio"
                  name="ship-addr"
                  checked={selectedId === addr.id}
                  onChange={() => onSelect(addr.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{addr.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.district}
                    {addr.postalCode ? ` — ${addr.postalCode}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(addr)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.confirm(tc('confirmDelete'))) deleteMut.mutate(addr.id);
                    }}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
