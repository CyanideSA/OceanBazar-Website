import React, { useCallback, useEffect, useState } from 'react';
import AccountLayout from '@/components/AccountLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { paymentMethodsAPI } from '@/api/service';
import { toast } from '@/hooks/use-toast';
import {
  CreditCard,
  Landmark,
  Smartphone,
  Trash2,
  Star,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

const TYPE_OPTIONS = [
  { value: 'CARD', label: 'Debit / Credit card', icon: CreditCard },
  { value: 'BKASH', label: 'bKash', icon: Smartphone },
  { value: 'NAGAD', label: 'Nagad', icon: Smartphone },
  { value: 'BANK', label: 'Bank account', icon: Landmark },
];

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function detectCardBrand(num) {
  const d = digitsOnly(num);
  if (/^4/.test(d)) return 'Visa';
  if (/^5[1-5]/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'Amex';
  if (/^6(?:011|5)/.test(d)) return 'Discover';
  if (/^(?:2131|1800|35)/.test(d)) return 'JCB';
  if (d.length >= 4) return 'Card';
  return 'Card';
}

const PaymentMethodsPage = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [methods, setMethods] = useState([]);
  const [formType, setFormType] = useState('CARD');

  const [nickname, setNickname] = useState('');
  const [cardNumberInput, setCardNumberInput] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [walletLast4, setWalletLast4] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankLast4, setBankLast4] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await paymentMethodsAPI.list();
      const raw = res?.data?.paymentMethods;
      setMethods(Array.isArray(raw) ? raw.filter((m) => m && typeof m === 'object') : []);
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.message ||
        e?.message ||
        'Try again later.';
      setLoadError(detail);
      setMethods([]);
      toast({
        title: 'Could not load methods',
        description: detail,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setNickname('');
    setCardNumberInput('');
    setExpMonth('');
    setExpYear('');
    setWalletLast4('');
    setBankName('');
    setBankLast4('');
    setSetAsDefault(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let body = {
        type: formType,
        nickname: nickname.trim() || undefined,
        setAsDefault,
      };

      if (formType === 'CARD') {
        const d = digitsOnly(cardNumberInput);
        if (d.length < 13) {
          toast({ title: 'Invalid card', description: 'Enter a valid card number.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const last4 = d.slice(-4);
        const m = parseInt(expMonth, 10);
        let y = parseInt(expYear, 10);
        if (!m || m < 1 || m > 12) {
          toast({ title: 'Expiry', description: 'Enter month (1–12).', variant: 'destructive' });
          setSaving(false);
          return;
        }
        if (String(expYear).length === 2) y = 2000 + y;
        if (!y || y < 2000) {
          toast({ title: 'Expiry', description: 'Enter a valid year.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        body = {
          ...body,
          cardBrand: detectCardBrand(d),
          last4,
          expiryMonth: m,
          expiryYear: y,
        };
      } else if (formType === 'BKASH' || formType === 'NAGAD') {
        const w = digitsOnly(walletLast4);
        if (w.length !== 4) {
          toast({ title: 'Wallet', description: 'Enter last 4 digits of your wallet number.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        body = { ...body, walletLast4: w };
      } else if (formType === 'BANK') {
        const b = digitsOnly(bankLast4);
        if (!bankName.trim()) {
          toast({ title: 'Bank name required', variant: 'destructive' });
          setSaving(false);
          return;
        }
        if (b.length !== 4) {
          toast({ title: 'Account', description: 'Enter last 4 digits of account number.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        body = { ...body, bankName: bankName.trim(), bankAccountLast4: b };
      }

      await paymentMethodsAPI.add(body);
      toast({ title: 'Saved', description: 'Payment method saved securely (last digits only).' });
      resetForm();
      setCardNumberInput('');
      await load();
    } catch (e) {
      toast({
        title: 'Could not save',
        description: e?.response?.data?.detail || e?.message || 'Try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this saved payment method?')) return;
    try {
      await paymentMethodsAPI.remove(id);
      toast({ title: 'Removed' });
      await load();
    } catch (e) {
      toast({
        title: 'Remove failed',
        description: e?.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
    }
  };

  const handleDefault = async (id) => {
    try {
      await paymentMethodsAPI.setDefault(id);
      toast({ title: 'Default updated' });
      await load();
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e?.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
    }
  };

  const TypeIcon = TYPE_OPTIONS.find((t) => t.value === formType)?.icon || CreditCard;

  return (
    <AccountLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">Payment methods</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Add ways you usually pay. We only store non-sensitive labels (e.g. brand and last 4 digits) — never full card numbers or CVV.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-start gap-3 mb-6 p-4 rounded-xl bg-[#F5F9FC] dark:bg-gray-900/50 border border-[#E4F0F9] dark:border-gray-700">
            <ShieldCheck className="w-5 h-5 text-[#5BA3D0] shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your full card number is used only in this browser to derive the last 4 digits before save. It is not sent to our servers.
              For production, connect a PCI-certified gateway (e.g. Stripe) for tokenization.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <Label className="text-gray-700 dark:text-gray-300 mb-2 block">Method type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormType(value)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                      formType === value
                        ? 'border-[#5BA3D0] bg-[#5BA3D0]/10 text-[#5BA3D0] dark:text-[#7BB8DC]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="pm-nick" className="text-gray-700 dark:text-gray-300">
                Label <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="pm-nick"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Personal Visa, Work bKash"
                className="mt-1.5 dark:bg-gray-900/50 dark:border-gray-600"
                maxLength={60}
              />
            </div>

            {formType === 'CARD' && (
              <div className="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-medium text-sm">
                  <TypeIcon className="w-4 h-4 text-[#5BA3D0]" />
                  Card details
                </div>
                <div>
                  <Label htmlFor="pm-card">Card number</Label>
                  <Input
                    id="pm-card"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={cardNumberInput}
                    onChange={(e) => setCardNumberInput(e.target.value)}
                    placeholder="•••• •••• •••• ••••"
                    className="mt-1.5 font-mono dark:bg-gray-900/50 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Only the last 4 digits are saved.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pm-exp-m">Expiry month</Label>
                    <Input
                      id="pm-exp-m"
                      inputMode="numeric"
                      value={expMonth}
                      onChange={(e) => setExpMonth(e.target.value)}
                      placeholder="MM"
                      maxLength={2}
                      className="mt-1.5 dark:bg-gray-900/50 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pm-exp-y">Expiry year</Label>
                    <Input
                      id="pm-exp-y"
                      inputMode="numeric"
                      value={expYear}
                      onChange={(e) => setExpYear(e.target.value)}
                      placeholder="YYYY"
                      maxLength={4}
                      className="mt-1.5 dark:bg-gray-900/50 dark:border-gray-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {(formType === 'BKASH' || formType === 'NAGAD') && (
              <div className="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700">
                <Label htmlFor="pm-wallet">Last 4 digits of {formType === 'BKASH' ? 'bKash' : 'Nagad'} number</Label>
                <Input
                  id="pm-wallet"
                  inputMode="numeric"
                  value={walletLast4}
                  onChange={(e) => setWalletLast4(digitsOnly(e.target.value).slice(0, 4))}
                  placeholder="••••"
                  maxLength={4}
                  className="mt-1.5 font-mono tracking-widest dark:bg-gray-900/50 dark:border-gray-600"
                />
              </div>
            )}

            {formType === 'BANK' && (
              <div className="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700">
                <div>
                  <Label htmlFor="pm-bank">Bank name</Label>
                  <Input
                    id="pm-bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. BRAC Bank"
                    className="mt-1.5 dark:bg-gray-900/50 dark:border-gray-600"
                  />
                </div>
                <div>
                  <Label htmlFor="pm-bank4">Last 4 digits of account</Label>
                  <Input
                    id="pm-bank4"
                    inputMode="numeric"
                    value={bankLast4}
                    onChange={(e) => setBankLast4(digitsOnly(e.target.value).slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    className="mt-1.5 font-mono dark:bg-gray-900/50 dark:border-gray-600"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="pm-default"
                checked={setAsDefault}
                onCheckedChange={(v) => setSetAsDefault(!!v)}
              />
              <Label htmlFor="pm-default" className="font-normal text-gray-700 dark:text-gray-300 cursor-pointer">
                Save as default payment method
              </Label>
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white min-w-[140px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save payment method'
              )}
            </Button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Saved methods</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500 py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading…
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 px-4 py-6 text-sm">
              <p className="font-medium mb-2">Could not load saved methods</p>
              <p className="opacity-90 mb-4">{loadError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => load()}>
                Retry
              </Button>
            </div>
          ) : methods.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No saved payment methods yet.</p>
          ) : (
            <ul className="space-y-3">
              {methods.map((m, idx) => (
                <li
                  key={m.id != null ? String(m.id) : `pm-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-gray-100 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {typeof m.displaySummary === 'string' && m.displaySummary.trim()
                          ? m.displaySummary
                          : 'Saved method'}
                      </span>
                      {(m.defaultMethod === true || m.default === true) && (
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#5BA3D0]/15 text-[#5BA3D0] dark:text-[#7BB8DC]">
                          Default
                        </span>
                      )}
                    </div>
                    {m.nickname && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{m.nickname}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.id != null && String(m.id).trim() !== '' && !(m.defaultMethod === true || m.default === true) && (
                      <Button type="button" variant="outline" size="sm" onClick={() => handleDefault(m.id)}>
                        <Star className="w-3.5 h-3.5 mr-1" />
                        Set default
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/40"
                      disabled={m.id == null || String(m.id).trim() === ''}
                      onClick={() => handleRemove(m.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AccountLayout>
  );
};

export default PaymentMethodsPage;
