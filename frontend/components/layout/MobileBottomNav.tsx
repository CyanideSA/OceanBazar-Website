'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Home, MessageCircle, User, LayoutGrid } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import LiveChatLink from '@/components/chat/LiveChatLink';
import { LIVE_CHAT_ENABLED } from '@/lib/features';

export default function MobileBottomNav() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { isAuthenticated } = useAuthStore();
  const chatHref = `/${locale}/chat`;
  const chatActive = Boolean(pathname?.includes('/chat'));

  const tabs = [
    { href: `/${locale}`, label: t('home'), icon: Home },
    { href: `/${locale}/products`, label: t('products'), icon: LayoutGrid },
    { href: '__live_chat__', label: t('chat'), icon: MessageCircle },
    { href: isAuthenticated ? `/${locale}/account` : `/${locale}/auth/login`, label: t('account'), icon: User },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[55] border-t border-border/60 bg-background md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: 'hsl(var(--background, 0 0% 100%))',
      }}
    >
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const isLiveChat = tab.href === '__live_chat__';
          const isActive = isLiveChat ? chatActive : pathname === tab.href;

          if (isLiveChat) {
            return (
              <LiveChatLink
                key="live-chat"
                href={chatHref}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors active:text-primary',
                  !LIVE_CHAT_ENABLED && 'pointer-events-none',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
                onOpen={() => {
                }}
              >
                <tab.icon className="h-5 w-5" />
                <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>{tab.label}</span>
                {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              </LiveChatLink>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors active:text-primary',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>{tab.label}</span>
              {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
