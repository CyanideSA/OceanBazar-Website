import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { adminApi, api, resetAdminAuthErrorFlag, resolveAdminApiBase, markAdminLoginSuccess, isWithinAdminLoginGrace } from "./lib/api";
import { clearSession, getAdminUser, getToken, setSession } from "./lib/auth";
import { hasPermission, setCustomRolePermissions } from "./auth/permissionMatrix";
import Layout from "./components/LayoutV2";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import CatalogExplorerPage from "./pages/CatalogExplorerPage";
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
  const [adminUnreadAlerts, setAdminUnreadAlerts] = useState(0);
  const [overviewCounts, setOverviewCounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("oceanbazar_admin_theme") : null;
    return saved === "light" ? "light" : "dark";
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
    const styles = getComputedStyle(document.documentElement);
    // #region agent log
    fetch("http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9a9989" },
      body: JSON.stringify({
        sessionId: "9a9989",
        runId: "color-debug",
        hypothesisId: "H1",
        location: "src/App.jsx:theme-effect",
        message: "Theme attribute and CSS variables after apply",
        data: {
          theme,
          domTheme: document.documentElement.getAttribute("data-crm-theme"),
          lsTheme: localStorage.getItem("oceanbazar_admin_theme"),
          bg: styles.getPropertyValue("--crm-bg").trim(),
          text: styles.getPropertyValue("--crm-text").trim(),
          primary: styles.getPropertyValue("--crm-primary").trim(),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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

  if (!token || !admin) return <LoginPage onLogin={handleLogin} loading={loading} />;

  const denied = !canAccess(role, active);

  useEffect(() => {
    if (!token || !admin) return;
    // #region agent log
    fetch("http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9a9989" },
      body: JSON.stringify({
        sessionId: "9a9989",
        runId: "crm-visibility-check",
        hypothesisId: "H2",
        location: "src/App.jsx:denied-check",
        message: "App auth/permission state",
        data: {
          marker: "enterprise-ui-build-v1",
          role,
          active,
          denied,
          theme,
          hasSecurityPage: Object.prototype.hasOwnProperty.call(contentMap, "security"),
          hasRolePermissionsPage: Object.prototype.hasOwnProperty.call(contentMap, "rolePermissions"),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [token, admin, role, active, denied, theme]);
  
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
    products: <ProductsPage initialSearch={productsSearch} />,
    catalog: <CatalogExplorerPage />,
    inventory: <InventoryPage />,
    customers: (
      <CustomersPage
        onOpenTimeline={(customerId) => {
          try { sessionStorage.setItem("oceanbazar_timeline_customer", customerId || ""); } catch { /* ignore */ }
          setActive("customerTimeline");
        }}
      />
    ),
    orders: <OrdersPage initialSearch={ordersSearch} liveTick={mergedTicks.orders} />,
    delivery: <DeliveryPage />,
    adminUsers: <AdminUsersPage liveTick={mergedTicks.users} />,
    payments: <PaymentsPage liveTick={mergedTicks.payments} />,
    returns: <ReturnsPage returnsInboundRef={adminReturnsInboundRef} returnLiveTick={mergedTicks.returns} wsConnected={bffSocketConnected} />,
    reviews: <ReviewsPage />,
    coupons: <CouponsPage />,
    analytics: <AnalyticsPage liveTick={mergedTicks.payments + mergedTicks.orders} />,
    chat: <ChatPage liveTick={mergedTicks.chats} wsConnected={bffSocketConnected} chatInboundRef={adminChatInboundRef} />,
    applications: <ApplicationsPage />,
    notifications: <NotificationsPage onInboxChanged={refreshAdminUnread} />,
    engagement: <EngagementPage />,
    disputes: <DisputesPage />,
    audit: <AuditLogsPage />,
    settings: <GlobalSettingsPage />,
    obPoints: <OBPointsPage />,
    tickets: <TicketsPage />,
    abTests: <ABTestsPage />,
    flashSales: <FlashSalesPage />,
    pendingApprovals: <PendingApprovalsPage />,
    searchAnalytics: <SearchAnalyticsPage />,
    rolePermissions: <RolePermissionsPage />,
    security: <SecurityCenterPage />,
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
      // #region agent log
      fetch("http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9a9989" },
        body: JSON.stringify({
          sessionId: "9a9989",
          runId: "crm-visibility-check",
          hypothesisId: "H3",
          location: "src/App.jsx:renderContent",
          message: "Module denied by permission guard",
          data: { role, active },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
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
