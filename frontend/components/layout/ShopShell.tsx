'use client';

import { Suspense, type ReactNode } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/cart/CartDrawer';
import CartBootstrap from '@/components/cart/CartBootstrap';
import FloatingCartButton from '@/components/layout/FloatingCartButton';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import CompareDock from '@/components/product/CompareDock';
import LoginDialog from '@/components/auth/LoginDialog';
import WelcomePopup from '@/components/shared/WelcomePopup';
import ChatWidget from '@/components/chat/ChatWidget';
import NavigationLoadingOverlay from '@/components/shared/NavigationLoadingOverlay';
import { NavigationLoadingProvider } from '@/components/shared/NavigationLoadingContext';
import ChunkLoadRecovery from '@/components/shared/ChunkLoadRecovery';
import type { StorefrontPublicSettings } from '@/lib/fetchStorefrontCatalog';
import type { FlashSaleMeta } from '@/lib/flashDeals';

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
  return (
    <NavigationLoadingProvider>
      <div className="flex min-h-screen flex-col">
        <ChunkLoadRecovery />
        <Suspense fallback={null}>
          <NavigationLoadingOverlay />
        </Suspense>
        <Header initialFlashSale={initialFlashSale} />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer initialSettings={initialSiteSettings} />
        <CartBootstrap />
        <FloatingCartButton />
        <MobileBottomNav />
        <CartDrawer />
        <CompareDock />
        <LoginDialog />
        <WelcomePopup />
        <ChatWidget />
      </div>
    </NavigationLoadingProvider>
  );
}
