'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { LIVE_CHAT_ENABLED } from '@/lib/features';

type Props = {
  href: string;
  className?: string;
  children: React.ReactNode;
  onOpen?: () => void;
};

export default function LiveChatLink({ href, className, children, onOpen }: Props) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!LIVE_CHAT_ENABLED) {
    return (
      <span
        className={`${className ?? ''} cursor-not-allowed opacity-50`}
        aria-disabled="true"
        title="Live chat is temporarily unavailable"
      >
        {children}
      </span>
    );
  }

  if (!isAuthenticated) {
    return (
      <Link
        href={href}
        className={className}
        onClick={() => {
          onOpen?.();
        }}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onOpen?.();
        window.dispatchEvent(new Event('ob:open-chat'));
      }}
    >
      {children}
    </button>
  );
}
