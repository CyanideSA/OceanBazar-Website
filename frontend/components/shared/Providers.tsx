'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import ScrollToTop from '@/components/shared/ScrollToTop';
import Toaster from '@/components/shared/Toaster';
import CatalogSyncProvider from '@/components/shared/CatalogSyncProvider';
import NotificationListener from '@/components/shared/NotificationListener';
import WishlistSync from '@/components/shared/WishlistSync';
import ChatVisitorClaim from '@/components/chat/ChatVisitorClaim';
import DynamicFavicon from '@/components/shared/DynamicFavicon';
import PushNotificationInit from '@/components/shared/PushNotificationInit';
import PwaAnalyticsInit from '@/components/shared/PwaAnalyticsInit';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1 * 60 * 1000, // 1 min for faster updates on mobile
            gcTime: 5 * 60 * 1000, // 5 min to reduce memory on mobile
            retry: (failureCount, error) => {
              const status = (error as { response?: { status?: number } })?.response?.status;
              if (status === 401 || status === 403 || status === 404) return false;
              return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <ThemeProvider>
      <DynamicFavicon />
      <QueryClientProvider client={queryClient}>
        <CatalogSyncProvider />
        <NotificationListener />
        <PushNotificationInit />
        <PwaAnalyticsInit />
        <WishlistSync />
        <ChatVisitorClaim />
        <ScrollToTop />
        {children}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
