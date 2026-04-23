import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/cart/CartDrawer';
import FloatingCartButton from '@/components/layout/FloatingCartButton';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import CompareDock from '@/components/product/CompareDock';
import LoginDialog from '@/components/auth/LoginDialog';
import WelcomePopup from '@/components/shared/WelcomePopup';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <FloatingCartButton />
      <MobileBottomNav />
      <CartDrawer />
      <CompareDock />
      <LoginDialog />
      <WelcomePopup />
    </div>
  );
}
