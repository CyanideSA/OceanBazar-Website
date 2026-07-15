'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { referralApi } from '@/lib/api';
import { Copy, Check, Users, Gift, TrendingUp, Link2 } from 'lucide-react';
import { format } from 'date-fns';

interface ReferralStats {
  code: string | null;
  shareUrl: string;
  clickCount: number;
  signupCount: number;
  earnedPoints: number;
  events: { event: string; pointsAwarded: number; createdAt: string }[];
}

export default function ReferralPage() {
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);

  const { data, isLoading } = useQuery<ReferralStats>({
    queryKey: ['referral-stats'],
    queryFn: () => referralApi.stats().then((r) => r.data),
    staleTime: 60_000,
  });

  const copy = async (text: string, type: 'code' | 'url') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const stats = data ?? { code: null, shareUrl: '', clickCount: 0, signupCount: 0, earnedPoints: 0, events: [] };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Gift className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Refer & Earn</h1>
          <p className="text-sm text-muted-foreground">Invite friends and earn OB Points for every signup</p>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-primary/0 p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">How it works</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { step: '1', icon: '🔗', title: 'Share your link', desc: 'Send to friends via WhatsApp, Facebook, etc.' },
            { step: '2', icon: '👤', title: 'Friend signs up', desc: 'They register using your referral code' },
            { step: '3', icon: '🎁', title: 'Earn 200 points', desc: 'Get credited automatically on their signup' },
          ].map((item) => (
            <div key={item.step} className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground font-bold shadow">
                {item.icon}
              </div>
              <p className="text-xs font-semibold text-foreground">{item.title}</p>
              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral code + share URL */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground">Your Referral Code</p>

        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="font-mono text-2xl font-black tracking-widest text-primary">
              {stats.code ?? '—'}
            </span>
          </div>
          <button
            onClick={() => stats.code && copy(stats.code, 'code')}
            disabled={!stats.code}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
          >
            {copied === 'code' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <p className="text-xs font-medium text-muted-foreground">Share link</p>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            {stats.shareUrl || '—'}
          </div>
          <button
            onClick={() => stats.shareUrl && copy(stats.shareUrl, 'url')}
            disabled={!stats.shareUrl}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            {copied === 'url' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Share quick-access */}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`Join OceanBazar using my referral link and get exclusive deals! ${stats.shareUrl}`)}`, color: 'bg-green-500' },
            { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(stats.shareUrl)}`, color: 'bg-blue-600' },
            { label: 'Copy link', href: '#', color: 'bg-primary', onClick: () => copy(stats.shareUrl, 'url') },
          ].map((btn) => (
            <a
              key={btn.label}
              href={btn.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={btn.onClick ? (e) => { e.preventDefault(); btn.onClick(); } : undefined}
              className={`${btn.color} rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90`}
            >
              {btn.label}
            </a>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Link Clicks', value: stats.clickCount, icon: TrendingUp, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
          { label: 'Signups', value: stats.signupCount, icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'Points Earned', value: stats.earnedPoints.toLocaleString(), icon: Gift, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
            <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black text-foreground">{s.value}</p>
            <p className="text-[11px] font-medium text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Event history */}
      {stats.events.length > 0 && (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Referral History</h2>
          </div>
          <ul className="divide-y divide-border">
            {stats.events.map((ev, i) => (
              <li key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {ev.event === 'signup' ? '👤 New signup' : '🛍️ First purchase'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(ev.createdAt), 'MMM dd, yyyy · HH:mm')}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                  +{ev.pointsAwarded} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {stats.events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-4xl mb-3">🌊</p>
          <p className="font-semibold text-foreground">No referrals yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Share your link above and start earning OB Points!</p>
        </div>
      )}

      {/* Reward note */}
      <div className="rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">💡 Referral Rewards</p>
        <ul className="space-y-0.5">
          <li>• You earn <strong>200 OB Points</strong> when a friend signs up with your code</li>
          <li>• Referral points expire after 365 days if unused</li>
          <li>• Both you and your friend benefit — they get access to exclusive deals</li>
        </ul>
      </div>
    </div>
  );
}
