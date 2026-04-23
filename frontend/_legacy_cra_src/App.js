import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { SiteSettingsProvider } from "@/context/SiteSettingsContext";
import { ComparisonProvider } from "@/context/ComparisonContext";
import { WishlistProvider } from "@/context/WishlistContext";
import Header from "@/components/Header";
import HomePage from "@/pages/HomePage";
import ProductsPage from "@/pages/ProductsPage";
import EnhancedProductDetail from "@/pages/EnhancedProductDetail";
import CartPage from "@/pages/CartPage";
import WishlistPage from "@/pages/WishlistPage";
import CheckoutPage from "@/pages/CheckoutPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ForgotPassword from "@/pages/ForgotPassword";
import HelpCenter from "@/pages/HelpCenter";
import CustomerSupport from "@/pages/CustomerSupport";
import OpenDispute from "@/pages/OpenDispute";
import ReportIssue from "@/pages/ReportIssue";
import OrderProtections from "@/pages/OrderProtections";
import ProtectionSafePayments from "@/pages/ProtectionSafePayments";
import ProtectionShippingLogistics from "@/pages/ProtectionShippingLogistics";
import ProtectionAfterSales from "@/pages/ProtectionAfterSales";
import ProtectionRefundReturn from "@/pages/ProtectionRefundReturn";
import WholesaleHub from "@/pages/WholesaleHub";
import Dashboard from "@/pages/Dashboard";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import AccountSettings from "@/pages/AccountSettings";
import PaymentMethodsPage from "@/pages/PaymentMethodsPage";
import BusinessInquiryPage from "@/pages/BusinessInquiryPage";
import ProductComparison from "@/pages/ProductComparison";
import ReviewsPage from "@/pages/ReviewsPage";
import ReturnRequestPage from "@/pages/ReturnRequestPage";
import SellerStorePage from "@/pages/SellerStorePage";
import NotificationsPage from "@/pages/NotificationsPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import WhoWeArePage from "@/pages/WhoWeArePage";
import MarketplacePage from "@/pages/MarketplacePage";
import { NotificationProvider } from "@/context/NotificationContext";
import { CustomerInboxProvider } from "@/context/CustomerInboxContext";
import LiveChat from "@/components/LiveChat";
import Footer from "@/components/Footer";
import CompareDock from "@/components/CompareDock";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { cartAPI, profileAPI, getApiErrorMessage } from "@/api/service";
import { logger } from "@/utils/logger";
import { useToast } from "@/hooks/use-toast";
import { STOREFRONT_PROFILE_UPDATED, replaceStorefrontUser } from "@/utils/storefrontUserSync";

function App() {
  const [cartItems, setCartItems] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('oceanBazarUser');
    const token = localStorage.getItem('oceanBazarToken');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
      fetchCart();
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const onProfile = (e) => {
      const d = e?.detail;
      if (d && typeof d === "object" && d.id) {
        setUser(d);
      }
    };
    window.addEventListener(STOREFRONT_PROFILE_UPDATED, onProfile);
    return () => window.removeEventListener(STOREFRONT_PROFILE_UPDATED, onProfile);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('oceanBazarToken');
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await profileAPI.get();
        if (cancelled || !res?.data) return;
        const raw = localStorage.getItem('oceanBazarUser');
        let base = {};
        if (raw) {
          try {
            base = JSON.parse(raw);
          } catch {
            /* ignore */
          }
        }
        const next = { ...base, ...res.data };
        localStorage.setItem('oceanBazarUser', JSON.stringify(next));
        setUser(next);
      } catch {
        /* offline or session invalid — keep cached user */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchCart = async () => {
    try {
      const response = await cartAPI.get();
      // Convert backend cart format to frontend format
      const backendCart = response.data;
      if (backendCart.items) {
        const formattedItems = backendCart.items.map(item => ({
          id: item.product.id,
          name: item.product.name,
          price: item.price ?? item.product.price,
          retailPrice: item.product.retailPrice ?? item.product.price,
          wholesalePrice: item.product.wholesalePrice ?? item.product.price,
          quantity: item.quantity,
          image: item.product.image,
          supplier: item.product.supplier,
          moq: item.product.moq,
          rating: item.product.rating,
          category: item.product.category
        }));
        setCartItems(formattedItems);
      }
    } catch (error) {
      logger.error("Error fetching cart:", error);
      // If unauthorized, fall back to empty cart
      if (error.response?.status === 401) {
        setCartItems([]);
      } else {
        toast({
          title: "Cart error",
          description: getApiErrorMessage(error, "Failed to load cart."),
          variant: "destructive",
        });
      }
    }
  };

  const handleAddToCart = async (product) => {
    const token = localStorage.getItem('oceanBazarToken');
    const productId = product?.id || product?._id;

    if (!productId) {
      toast({
        title: "Add to cart failed",
        description: "Product id is missing.",
        variant: "destructive",
      });
      return;
    }
    
    if (!token) {
      // Not logged in - use localStorage
      setCartItems((prevItems) => {
        const existingItem = prevItems.find((item) => item.id === productId);
        if (existingItem) {
          return prevItems.map((item) =>
            item.id === productId
              ? { ...item, quantity: item.quantity + (product.quantity || 1) }
              : item
          );
        }
        return [...prevItems, { ...product, id: productId, quantity: product.quantity || 1 }];
      });
    } else {
      // Logged in - use backend
      try {
        await cartAPI.add({
          productId,
          quantity: product.quantity || 1
        });
        await fetchCart();
      } catch (error) {
        logger.error("Error adding to cart:", error);
        toast({
          title: "Add to cart failed",
          description: getApiErrorMessage(error),
          variant: "destructive",
        });
      }
    }
  };

  const handleUpdateQuantity = async (productId, newQuantity) => {
    const token = localStorage.getItem('oceanBazarToken');
    
    if (!token) {
      setCartItems((prevItems) =>
        prevItems.map((item) =>
          item.id === productId ? { ...item, quantity: newQuantity } : item
        )
      );
    } else {
      try {
        await cartAPI.update({ productId, quantity: newQuantity });
        await fetchCart();
      } catch (error) {
        logger.error("Error updating cart:", error);
        toast({
          title: "Update cart failed",
          description: getApiErrorMessage(error),
          variant: "destructive",
        });
      }
    }
  };

  const handleRemoveFromCart = async (productId) => {
    const token = localStorage.getItem('oceanBazarToken');
    
    if (!token) {
      setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId));
    } else {
      try {
        await cartAPI.remove(productId);
        await fetchCart();
      } catch (error) {
        logger.error("Error removing from cart:", error);
        toast({
          title: "Remove failed",
          description: getApiErrorMessage(error),
          variant: "destructive",
        });
      }
    }
  };

  const handleLogin = (userData, token) => {
    localStorage.setItem('oceanBazarToken', token);
    replaceStorefrontUser(userData);
    setUser(userData);
    fetchCart();
  };

  const handleSignup = (userData, token) => {
    localStorage.setItem('oceanBazarToken', token);
    replaceStorefrontUser(userData);
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    setCartItems([]);
    localStorage.removeItem('oceanBazarUser');
    localStorage.removeItem('oceanBazarToken');
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <ThemeProvider>
      <SiteSettingsProvider>
      <ComparisonProvider>
        <WishlistProvider>
        <NotificationProvider>
        <CustomerInboxProvider isLoggedIn={!!user}>
        <ErrorBoundary>
        <div className="App">
          <BrowserRouter>
            <Header cartCount={cartCount} isLoggedIn={!!user} user={user} onLogout={handleLogout} />
            <Routes>
              <Route path="/" element={<HomePage onAddToCart={handleAddToCart} />} />
              <Route path="/products" element={<ProductsPage onAddToCart={handleAddToCart} />} />
              <Route path="/product/:id" element={<EnhancedProductDetail onAddToCart={handleAddToCart} />} />
              <Route path="/comparison" element={<ProductComparison />} />
              <Route
                path="/cart"
                element={
                  <CartPage
                    cartItems={cartItems}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveFromCart={handleRemoveFromCart}
                    onAddToCart={handleAddToCart}
                  />
                }
              />
              <Route path="/wishlist" element={<WishlistPage onAddToCart={handleAddToCart} />} />
              <Route path="/checkout" element={<CheckoutPage cartItems={cartItems} />} />
              <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
              <Route path="/signup" element={<SignupPage onSignup={handleSignup} />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/help/customer-support" element={<CustomerSupport />} />
              <Route path="/help/dispute" element={<OpenDispute />} />
              <Route path="/help/report-issue" element={<ReportIssue />} />
              <Route path="/protections" element={<OrderProtections />} />
              <Route path="/protections/payments" element={<ProtectionSafePayments />} />
              <Route path="/protections/shipping" element={<ProtectionShippingLogistics />} />
              <Route path="/protections/after-sales" element={<ProtectionAfterSales />} />
              <Route path="/protections/refunds" element={<ProtectionRefundReturn />} />
              <Route path="/wholesale-hub" element={<WholesaleHub />} />
              <Route
                path="/account/dashboard"
                element={user ? <Dashboard user={user} /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/account/orders"
                element={user ? <Orders /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/account/orders/:id"
                element={user ? <OrderDetail /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/account/settings"
                element={user ? <AccountSettings /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/account/payments"
                element={user ? <PaymentMethodsPage /> : <Navigate to="/login" replace />}
              />
              <Route path="/business-inquiry" element={<BusinessInquiryPage />} />
              <Route path="/product/:productId/reviews" element={<ReviewsPage />} />
              <Route path="/account/returns" element={user ? <ReturnRequestPage /> : <Navigate to="/login" replace />} />
              <Route path="/account/returns/:orderId" element={user ? <ReturnRequestPage /> : <Navigate to="/login" replace />} />
              <Route path="/seller/:sellerId" element={<SellerStorePage onAddToCart={handleAddToCart} />} />
              <Route path="/notifications" element={user ? <NotificationsPage /> : <Navigate to="/login" replace />} />
              <Route path="/terms-of-service" element={<TermsOfServicePage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/who-we-are" element={<WhoWeArePage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
            </Routes>
            <LiveChat user={user} />
            <CompareDock />
            <Footer />
            <Toaster />
          </BrowserRouter>
        </div>
        </ErrorBoundary>
        </CustomerInboxProvider>
        </NotificationProvider>
        </WishlistProvider>
      </ComparisonProvider>
      </SiteSettingsProvider>
    </ThemeProvider>
  );
}

export default App;
