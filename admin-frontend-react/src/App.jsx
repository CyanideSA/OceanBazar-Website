import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { adminApi, api, resetAdminAuthErrorFlag, resolveAdminApiBase, markAdminLoginSuccess, isWithinAdminLoginGrace } from "./lib/api";
import { clearSession, getAdminUser, getToken, setSession } from "./lib/auth";
import { hasPermission, setCustomRolePermissions } from "./auth/permissionMatrix";
import Layout from "./components/LayoutV2";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import CatalogExplorerPage from "./pages/CatalogExplorerPage";
import { useCatalogStore } from "./stores/catalogStore";
import CustomersPage from "./pages/CustomersPage";
import OrdersPage from "./pages/OrdersPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import PaymentsPage from "./pages/PaymentsPage";
import ChatPage from "./pages/ChatPage";
import ApplicationsPage from "./pages/ApplicationsPage";
import NotificationsPage from "./pages/NotificationsPage";
import DisputesPage from "./pages/DisputesPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import GlobalSettingsPage from "./pages/GlobalSettingsPage";
import DeliveryPage from "./pages/DeliveryPage";
import { ToastProvider } from "./components/ToastProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import useAdminLive from "./hooks/useAdminLive";
import useAdminBffSocket from "./hooks/useAdminBffSocket";
import useTokenAutoRefresh from "./hooks/useTokenAutoRefresh";
import { clearAdminRealtimeTokenCache } from "./lib/realtimeAuth";

const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ReturnsPage = lazy(() => import("./pages/ReturnsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const CouponsPage = lazy(() => import("./pages/CouponsPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage"));
const OBPointsPage = lazy(() => import("./pages/OBPointsPage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));
const ABTestsPage = lazy(() => import("./pages/ABTestsPage"));
const FlashSalesPage = lazy(() => import("./pages/FlashSalesPage"));
const EngagementPage = lazy(() => import("./pages/EngagementPage"));
const PendingApprovalsPage = lazy(() => import("./pages/PendingApprovalsPage"));
const SearchAnalyticsPage = lazy(() => import("./pages/SearchAnalyticsPage"));
const RolePermissionsPage = lazy(() => import("./pages/RolePermissionsPage"));
const SecurityCenterPage = lazy(() => import("./pages/SecurityCenterPage"));
const ClientErrorsPage = lazy(() => import("./pages/ClientErrorsPage"));
const EmailInboxPage = lazy(() => import("./pages/EmailInboxPage"));
const MetaPage = lazy(() => import("./pages/MetaPage"));
const CustomerTimelinePage = lazy(() => import("./pages/CustomerTimelinePage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const SeoCenterPage = lazy(() => import("./pages/SeoCenterPage"));
const CrmIntelligencePage = lazy(() => import("./pages/CrmIntelligencePage"));
const AnalyticsAiPage = lazy(() => import("./pages/AnalyticsAiPage"));
const AiMarketingPage = lazy(() => import("./pages/AiMarketingPage"));

function canAccess(role, moduleKey) {
  return hasPermission(role, moduleKey, "view");
}

export default function App() {
  const [token, setToken] = useState(getToken());
  const [admin, setAdmin] = useState(getAdminUser());
  const [active, setActive] = useState("dashboard");
  const [ordersSearch, setOrdersSearch] = useState("");
  const [productsSearch, setProductsSearch] = useState("");
  const [customerDetailId, setCustomerDetailId] = useState("");
  const [returnDetailId, setReturnDetailId] = useState("");
  const [paymentDetailId, setPaymentDetailId] = useState("");
  const [adminUnreadAlerts, setAdminUnreadAlerts] = useState(0);
  const [overviewCounts, setOverviewCounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => {
    // Default: light. Only use dark when the admin previously chose it.
    const saved = typeof window !== "undefined" ? localStorage.getItem("oceanbazar_admin_theme") : null;
    return saved === "dark" ? "dark" : "light";
  });
  
  const adminChatInboundRef = useRef(null);
  const adminReturnsInboundRef = useRef(null);
  
  const { snapshot: liveSnapshot, counters: liveCounters, connected: liveConnected, lastUpdatedAt, connMeta } = useAdminLive(
    Boolean(token && admin)
  );
  
  const role = useMemo(() => String(admin?.role || "STAFF").toUpperCase(), [admin]);
  const adminForLayout = useMemo(
    () => ({ ...admin, role, roleLabel: admin?.roleLabel || admin?.role }),
    [admin, role]
  );

  const refreshAdminUnread = useCallback(async () => {
    try {
      const r = await adminApi.notificationsUnreadCount();
      setAdminUnreadAlerts(Number(r?.count) || 0);
    } catch {
      /* ignore */
    }
  }, []);

  const {
    connected: bffSocketConnected,
    eventTicks,
    soundEnabled,
    toggleSound,
  } = useAdminBffSocket(
    Boolean(token && admin),
    { onNotification: refreshAdminUnread },
    adminChatInboundRef,
    adminReturnsInboundRef
  );

  const mergedTicks = eventTicks;

  const refreshOverviewCounts = useCallback(async () => {
    try {
      const r = await adminApi.overview();
      setOverviewCounts({
        orders:    Number(r?.totalOrders  ?? 0),
        customers: Number(r?.totalUsers   ?? r?.totalCustomers ?? 0),
        products:  Number(r?.totalProducts ?? 0),
        messages:  Number(r?.activeChats  ?? 0),
        tickets:   Number(r?.pendingTickets ?? 0),
        payments:  null,
        disputes:  null,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!token || !admin) return;
    if (typeof liveSnapshot?.adminUnreadNotifications === "number") {
      setAdminUnreadAlerts(liveSnapshot.adminUnreadNotifications);
      return;
    }
    refreshAdminUnread();
  }, [token, admin, active, refreshAdminUnread, liveSnapshot]);

  useEffect(() => {
    if (!token || !admin) return;
    refreshOverviewCounts();
  }, [token, admin, refreshOverviewCounts]);

  // Proactively refresh realtime token before it expires (silent refresh)
  useTokenAutoRefresh({
    enabled: Boolean(token && admin),
    onRefreshed: () => {
      // New token cached — next SSE/STOMP reconnect will pick it up automatically
    },
    onExpired: () => {
      // Realtime token expiry must not wipe the admin session — only clear SSE cache.
      clearAdminRealtimeTokenCache();
    },
  });

  // Listen for global 401 events from the axios interceptor and softly log out.
  useEffect(() => {
    const onAuthCleared = () => {
      clearAdminRealtimeTokenCache();
      setToken("");
      setAdmin(null);
      setActive("dashboard");
    };
    window.addEventListener("admin-auth-cleared", onAuthCleared);
    return () => window.removeEventListener("admin-auth-cleared", onAuthCleared);
  }, []);

  useEffect(() => {
    if (!admin?.role) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/admin/governance/permissions/all");
        if (cancelled) return;
        const data = res?.data || res || {};
        setCustomRolePermissions({
          admin: data.admin || {},
          staff: data.staff || {},
        });
      } catch { /* use defaults */ }
    })();
    return () => { cancelled = true; };
  }, [admin?.role]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoCode = params.get("sso_code");
    if (!ssoCode || getToken()) return;
    setLoading(true);
    adminApi
      .ssoExchange({ code: ssoCode })
      .then((res) => {
        if (!res?.token || !res?.admin?.id) throw new Error("SSO exchange failed");
        setSession(res.token, res.admin);
        markAdminLoginSuccess();
        resetAdminAuthErrorFlag();
        setToken(res.token);
        setAdmin(res.admin);
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const verifySession = async () => {
      if (!token) return;
      try {
        const me = await adminApi.me();
        if (cancelled) return;
        const normalized = me?.admin || me;
        if (normalized?.id) {
          setAdmin(normalized);
          setSession(token, normalized);
        }
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        const isAuthFailure = status === 401 || status === 403;
        if (!isAuthFailure || isWithinAdminLoginGrace()) return;
        clearAdminRealtimeTokenCache();
        clearSession();
        setToken("");
        setAdmin(null);
      }
    };
    verifySession();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    document.documentElement.setAttribute("data-crm-theme", theme);
    localStorage.setItem("oceanbazar_admin_theme", theme);
  }, [theme]);

  const handleLogin = async (payload) => {
    setLoading(true);
    try {
      clearAdminRealtimeTokenCache();

      if (payload?.session?.token) {
        const res = payload.session;
        setSession(res.token, res.admin);
        markAdminLoginSuccess();
        resetAdminAuthErrorFlag();
        setToken(res.token);
        setAdmin(res.admin);
        return res;
      }

      const res = payload?.tempToken
        ? await adminApi.login2fa({ tempToken: payload.tempToken, otp: payload.otp })
        : await adminApi.login({ username: payload.username, password: payload.password });

      if (res?.requires2fa || res?.requiresPasswordChange || res?.requires2faSetup) {
        return res;
      }

      if (!res?.token || !res?.admin?.id) {
        throw new Error(res?.error || "Login failed: server did not return a session token.");
      }
      setSession(res.token, res.admin);
      markAdminLoginSuccess();
      resetAdminAuthErrorFlag();
      setToken(res.token);
      setAdmin(res.admin);
      return res;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAdminRealtimeTokenCache();
    clearSession();
    setToken("");
    setAdmin(null);
  };

  const openOrderFromDashboard = (orderId) => {
    setOrdersSearch(orderId || "");
    setActive("orders");
  };

  const openProductFromDashboard = (productId) => {
    setProductsSearch(productId || "");
    setActive("products");
  };

  const openProductInExplorer = useCallback((productId, categoryId) => {
    const store = useCatalogStore.getState();
    if (categoryId) {
      store.setCurrentCategoryId(categoryId);
      store.setExpanded(categoryId, true);
    } else {
      store.setCurrentCategoryId(null);
    }
    if (productId) store.openProduct(productId);
    setActive("catalog");
  }, []);

  const navigateTo = useCallback((module, opts = {}) => {
    if (opts.customerId) {
      try { sessionStorage.setItem("oceanbazar_customer_detail", opts.customerId); } catch { /* ignore */ }
      setCustomerDetailId(opts.customerId);
    }
    if (opts.timelineCustomerId) {
      try { sessionStorage.setItem("oceanbazar_timeline_customer", opts.timelineCustomerId); } catch { /* ignore */ }
    }
    if (opts.orderId) {
      setOrdersSearch(opts.orderId);
      try { sessionStorage.setItem("oceanbazar_order_detail", opts.orderId); } catch { /* ignore */ }
    }
    if (opts.productId) setProductsSearch(opts.productId);
    if (opts.returnId) setReturnDetailId(opts.returnId);
    if (opts.paymentId) setPaymentDetailId(opts.paymentId);
    setActive(module);
  }, []);

  const denied = Boolean(token && admin) && !canAccess(role, active);

  // All hooks must run unconditionally — never place useEffect below the auth early-return.
  useEffect(() => {
    if (!token || !admin) return;
    // Keep dashboard as a safe landing module when permissions change after login.
    if (denied && active !== "dashboard") {
      setActive("dashboard");
    }
  }, [token, admin, denied, active]);

  if (!token || !admin) {
    return <LoginPage onLogin={handleLogin} loading={loading} />;
  }

  const contentMap = {
    dashboard: (
      <DashboardPage
        onOpenOrder={openOrderFromDashboard}
        onOpenProduct={openProductFromDashboard}
        onAlertsChanged={refreshAdminUnread}
        liveSnapshot={liveSnapshot}
        liveConnected={liveConnected}
        liveLastUpdatedAt={lastUpdatedAt}
      />
    ),
    products: (
      <ProductsPage
        initialSearch={productsSearch}
        onOpenInExplorer={openProductInExplorer}
      />
    ),
    catalog: <CatalogExplorerPage />,
    inventory: <InventoryPage />,
    customers: (
      <CustomersPage
        initialCustomerId={customerDetailId}
        onOpenTimeline={(customerId) => {
          try { sessionStorage.setItem("oceanbazar_timeline_customer", customerId || ""); } catch { /* ignore */ }
          setActive("customerTimeline");
        }}
      />
    ),
    orders: (
      <OrdersPage
        initialSearch={ordersSearch}
        liveTick={mergedTicks.orders}
        onOpenCustomer={(id) => navigateTo("customers", { customerId: id })}
        onOpenProduct={(id) => navigateTo("products", { productId: id })}
      />
    ),
    delivery: (
      <DeliveryPage
        onOpenOrder={(id) => navigateTo("orders", { orderId: id })}
        onOpenCustomer={(id) => navigateTo("customers", { customerId: id })}
      />
    ),
    adminUsers: <AdminUsersPage liveTick={mergedTicks.users} />,
    payments: (
      <PaymentsPage
        liveTick={mergedTicks.payments}
        initialPaymentId={paymentDetailId}
        onOpenOrder={(id) => navigateTo("orders", { orderId: id })}
        onOpenCustomer={(id) => navigateTo("customers", { customerId: id })}
        onOpenProduct={(id) => navigateTo("products", { productId: id })}
      />
    ),
    returns: (
      <ReturnsPage
        returnsInboundRef={adminReturnsInboundRef}
        returnLiveTick={mergedTicks.returns}
        wsConnected={bffSocketConnected}
        initialReturnId={returnDetailId}
        onOpenOrder={(id) => navigateTo("orders", { orderId: id })}
        onOpenCustomer={(id) => navigateTo("customers", { customerId: id })}
        onOpenProduct={(id) => navigateTo("products", { productId: id })}
      />
    ),
    reviews: <ReviewsPage />,
    coupons: <CouponsPage />,
    analytics: <AnalyticsPage liveTick={mergedTicks.payments + mergedTicks.orders} />,
    chat: (
      <ChatPage
        liveTick={mergedTicks.chats}
        wsConnected={bffSocketConnected}
        chatInboundRef={adminChatInboundRef}
        onOpenCustomer={(id) => navigateTo("customers", { customerId: id })}
        onOpenTimeline={(id) => navigateTo("customerTimeline", { timelineCustomerId: id })}
      />
    ),
    applications: <ApplicationsPage />,
    notifications: <NotificationsPage onInboxChanged={refreshAdminUnread} />,
    engagement: (
      <EngagementPage
        onOpenCustomer={(id) => navigateTo("customers", { customerId: id })}
      />
    ),
    disputes: <DisputesPage />,
    audit: <AuditLogsPage />,
    settings: <GlobalSettingsPage />,
    obPoints: <OBPointsPage />,
    tickets: (
      <TicketsPage
        onOpenCustomer={(id) => navigateTo("customers", { customerId: id })}
        onOpenTimeline={(id) => navigateTo("customerTimeline", { timelineCustomerId: id })}
      />
    ),
    abTests: <ABTestsPage />,
    flashSales: <FlashSalesPage />,
    pendingApprovals: <PendingApprovalsPage />,
    searchAnalytics: <SearchAnalyticsPage />,
    rolePermissions: <RolePermissionsPage />,
    security: <SecurityCenterPage />,
    clientErrors: (
      <ClientErrorsPage
        onOpenCustomer={(id) => navigateTo("customers", { customerId: id })}
      />
    ),
    email: <EmailInboxPage />,
    meta: <MetaPage />,
    customerTimeline: <CustomerTimelinePage />,
    integrations: <IntegrationsPage />,
    seo: <SeoCenterPage />,
    crmIntelligence: <CrmIntelligencePage />,
    analyticsAi: <AnalyticsAiPage />,
    aiMarketing: <AiMarketingPage />,
  };

  const renderContent = () => {
    if (denied) {
      return <div className="crm-card border-crm-danger text-crm-danger bg-crm-danger-dim p-8 text-center font-bold">You do not have permission for this module.</div>;
    }
    return contentMap[active] || contentMap.dashboard;
  };

  return (
    <ToastProvider>
      <ErrorBoundary>
        <Layout
          active={active}
          onSelect={setActive}
          admin={adminForLayout}
          onLogout={handleLogout}
          onAdminUpdate={(next) => {
            setAdmin(next);
            setSession(token, next);
          }}
          adminUnreadCount={adminUnreadAlerts}
          liveCounters={{ ...overviewCounts, ...liveCounters }}
          liveConnected={liveConnected}
          wsConnected={bffSocketConnected}
          connMeta={connMeta}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          <ErrorBoundary>
            <Suspense fallback={<div className="flex items-center justify-center p-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div></div>}>
              {renderContent()}
            </Suspense>
          </ErrorBoundary>
        </Layout>
      </ErrorBoundary>
    </ToastProvider>
  );
}
