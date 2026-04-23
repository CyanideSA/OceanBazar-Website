'use client';

import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationsStore } from '@/stores/notificationsStore';

export default function AccountNotificationsPage() {
  const t = useTranslations('notifications');
  const { items, markRead, markAllRead } = useNotifications();
  const remove = useNotificationsStore((s) => s.remove);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        </div>
        {items.some((i) => !i.read) ? (
          <button
            type="button"
            onClick={() => markAllRead()}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t('markAllAsRead')}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground">
          {t('noNotifications')}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border px-4 py-3 ${
                n.read ? 'border-border bg-card' : 'border-primary/40 bg-primary/5'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => !n.read && markRead(n.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="font-medium text-foreground">{n.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
                </button>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  className="text-sm text-muted-foreground hover:text-destructive"
                >
                  {t('remove')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
