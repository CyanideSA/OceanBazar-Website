'use client';

import { Suspense, type ReactNode, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/cart/CartDrawer';
import CartBootstrap from '@/components/cart/CartBootstrap';
import FloatingCartButton from '@/components/layout/FloatingCartButton';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import NavigationLoadingOverlay from '@/components/shared/NavigationLoadingOverlay';
import { NavigationLoadingProvider } from '@/components/shared/NavigationLoadingContext';
import ChunkLoadRecovery from '@/components/shared/ChunkLoadRecovery';
import HydrationProbe from '@/components/shared/HydrationProbe';
import LiteReturnBanner from '@/components/layout/LiteReturnBanner';
import { isLegacyStorefrontDevice } from '@/lib/legacyDevice';
import type { StorefrontPublicSettings } from '@/lib/fetchStorefrontCatalog';
import type { FlashSaleMeta } from '@/lib/flashDeals';

// Keep framer-motion / chat / popup out of the static ShopShell import graph so
// iPhone 7 / Pixel-class phones can hydrate menu, cart, and hero controls
// without parsing the ~150KB motion chunk first.
const LoginDialog = dynamic(() => import('@/components/auth/LoginDialog'), { ssr: false });
const ChatWidget = dynamic(() => import('@/components/chat/ChatWidget'), { ssr: false });
const StorefrontPopups = dynamic(() => import('@/components/shared/StorefrontPopups'), { ssr: false });
const AppDownloadBanner = dynamic(() => import('@/components/layout/AppDownloadBanner'), { ssr: false });
const CompareDock = dynamic(() => import('@/components/product/CompareDock'), { ssr: false });

/**
 * Single client boundary for the shop layout so the server `layout.tsx` only composes
 * one client root — avoids flaky RSC ↔ client chunk wiring (e.g. undefined webpack factories).
 */
export default function ShopShell({
  children,
  initialSiteSettings,
  initialFlashSale,
}: {
  children: ReactNode;
  initialSiteSettings?: StorefrontPublicSettings;
  initialFlashSale?: FlashSaleMeta | null;
}) {
  const [mountSecondary, setMountSecondary] = useState(false);

  useEffect(() => {
    const delay = isLegacyStorefrontDevice() ? 1500 : 0;
    const t = window.setTimeout(() => setMountSecondary(true), delay);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <NavigationLoadingProvider>
      <div className="flex min-h-screen flex-col">
        <HydrationProbe />
        <ChunkLoadRecovery />
        <Suspense fallback={null}>
          <NavigationLoadingOverlay />
        </Suspense>
        <LiteReturnBanner />
        <AppDownloadBanner initialSettings={initialSiteSettings} />
        <Header initialFlashSale={initialFlashSale} />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer initialSettings={initialSiteSettings} />
        <CartBootstrap />
        <FloatingCartButton />
        <MobileBottomNav />
        <CartDrawer />
        {/* Login is dynamic but mounted immediately so the header Login button works. */}
        <LoginDialog />
        {mountSecondary ? (
          <>
            <CompareDock />
            <StorefrontPopups initialSettings={initialSiteSettings} />
            <ChatWidget />
          </>
        ) : null}
      </div>
    </NavigationLoadingProvider>
  );
}
