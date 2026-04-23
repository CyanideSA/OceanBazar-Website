'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import { Building2, CreditCard, Smartphone } from 'lucide-react';
import {
  usePaymentMethodsStore,
  type MobileProvider,
  type SavedBank,
  type SavedCard,
  type SavedMobile,
} from '@/stores/paymentMethodsStore';

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
      <Icon className="h-5 w-5 text-primary" />
      {children}
    </h2>
  );
}

export default function AccountPaymentsPage() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const tCheckout = useTranslations('checkout');
  const { methods, add, remove } = usePaymentMethodsStore();

  const mobile = methods.filter((m): m is SavedMobile => m.kind === 'mobile');
  const cards = methods.filter((m): m is SavedCard => m.kind === 'card');
  const banks = methods.filter((m): m is SavedBank => m.kind === 'bank');

  const [open, setOpen] = useState<'mobile' | 'card' | 'bank' | null>(null);

  const [mForm, setMForm] = useState({
    provider: 'bkash' as MobileProvider,
    number: '',
    label: '',
  });
  const [cForm, setCForm] = useState({ brand: 'Visa', last4: '', label: '' });
  const [bForm, setBForm] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    branch: '',
    label: '',
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('paymentMethods')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('payEmpty')}</p>
      </div>

      <section>
        <SectionTitle icon={Smartphone}>{t('payMobile')}</SectionTitle>
        {mobile.length === 0 && !open ? (
          <p className="text-sm text-muted-foreground">{t('payEmpty')}</p>
        ) : null}
        <ul className="mb-3 space-y-2">
          {mobile.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">
                  {m.label || (m.provider === 'other' ? 'Other' : tCheckout(m.provider))}
                </p>
                <p className="text-sm text-muted-foreground">{m.number}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="text-sm font-medium text-destructive hover:underline"
              >
                {t('removeMethod')}
              </button>
            </li>
          ))}
        </ul>
        {open === 'mobile' ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">{t('provider')}</label>
            <select
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={mForm.provider}
              onChange={(e) => setMForm((f) => ({ ...f, provider: e.target.value as MobileProvider }))}
            >
              <option value="bkash">{tCheckout('bkash')}</option>
              <option value="nagad">{tCheckout('nagad')}</option>
              <option value="rocket">{tCheckout('rocket')}</option>
              <option value="upay">{tCheckout('upay')}</option>
              <option value="other">Other</option>
            </select>
            <label className="block text-xs font-medium text-muted-foreground">{t('mobileNumber')}</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={mForm.number}
              onChange={(e) => setMForm((f) => ({ ...f, number: e.target.value }))}
            />
            <label className="block text-xs font-medium text-muted-foreground">{t('nickname')}</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={mForm.label}
              onChange={(e) => setMForm((f) => ({ ...f, label: e.target.value }))}
              placeholder=""
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                disabled={!mForm.number.trim()}
                onClick={() => {
                  add({ kind: 'mobile', ...mForm, number: mForm.number.trim() });
                  setMForm({ provider: 'bkash', number: '', label: '' });
                  setOpen(null);
                }}
              >
                {t('addSavedMethod')}
              </button>
              <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => setOpen(null)}>
                {tc('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen('mobile')}
            className="text-sm font-semibold text-primary hover:underline"
          >
            + {t('addSavedMethod')}
          </button>
        )}
      </section>

      <section>
        <SectionTitle icon={CreditCard}>{t('payCards')}</SectionTitle>
        <ul className="mb-3 space-y-2">
          {cards.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">{c.label || c.brand}</p>
                <p className="text-sm text-muted-foreground">
                  •••• {c.last4}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="text-sm font-medium text-destructive hover:underline"
              >
                {t('removeMethod')}
              </button>
            </li>
          ))}
        </ul>
        {open === 'card' ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">{t('cardBrand')}</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={cForm.brand}
              onChange={(e) => setCForm((f) => ({ ...f, brand: e.target.value }))}
            />
            <label className="block text-xs font-medium text-muted-foreground">{t('last4')}</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              maxLength={4}
              value={cForm.last4}
              onChange={(e) => setCForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            />
            <label className="block text-xs font-medium text-muted-foreground">{t('nickname')}</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={cForm.label}
              onChange={(e) => setCForm((f) => ({ ...f, label: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                disabled={cForm.last4.length !== 4}
                onClick={() => {
                  add({
                    kind: 'card',
                    brand: cForm.brand.trim() || 'Card',
                    last4: cForm.last4,
                    label: cForm.label.trim() || undefined,
                  });
                  setCForm({ brand: 'Visa', last4: '', label: '' });
                  setOpen(null);
                }}
              >
                {t('addSavedMethod')}
              </button>
              <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => setOpen(null)}>
                {tc('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen('card')}
            className="text-sm font-semibold text-primary hover:underline"
          >
            + {t('addSavedMethod')}
          </button>
        )}
      </section>

      <section>
        <SectionTitle icon={Building2}>{t('payBank')}</SectionTitle>
        <ul className="mb-3 space-y-2">
          {banks.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium text-foreground">{b.label || b.bankName}</p>
                <p className="text-sm text-muted-foreground">
                  {b.accountName} · {b.accountNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(b.id)}
                className="text-sm font-medium text-destructive hover:underline"
              >
                {t('removeMethod')}
              </button>
            </li>
          ))}
        </ul>
        {open === 'bank' ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            {(['bankName', 'accountName', 'accountNumber'] as const).map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium text-muted-foreground">{t(field)}</label>
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={bForm[field]}
                  onChange={(e) => setBForm((f) => ({ ...f, [field]: e.target.value }))}
                />
              </div>
            ))}
            <label className="block text-xs font-medium text-muted-foreground">{t('branch')}</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={bForm.branch}
              onChange={(e) => setBForm((f) => ({ ...f, branch: e.target.value }))}
            />
            <label className="block text-xs font-medium text-muted-foreground">{t('nickname')}</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              value={bForm.label}
              onChange={(e) => setBForm((f) => ({ ...f, label: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                disabled={!bForm.bankName.trim() || !bForm.accountName.trim() || !bForm.accountNumber.trim()}
                onClick={() => {
                  add({
                    kind: 'bank',
                    bankName: bForm.bankName.trim(),
                    accountName: bForm.accountName.trim(),
                    accountNumber: bForm.accountNumber.trim(),
                    branch: bForm.branch.trim() || undefined,
                    label: bForm.label.trim() || undefined,
                  });
                  setBForm({ bankName: '', accountName: '', accountNumber: '', branch: '', label: '' });
                  setOpen(null);
                }}
              >
                {t('addSavedMethod')}
              </button>
              <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => setOpen(null)}>
                {tc('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen('bank')}
            className="text-sm font-semibold text-primary hover:underline"
          >
            + {t('addSavedMethod')}
          </button>
        )}
      </section>
    </div>
  );
}
