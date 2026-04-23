import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { adminApi } from "./lib/api";
import { clearSession, getAdminUser, getToken, setSession } from "./lib/auth";
import { hasPermission } from "./auth/permissionMatrix";
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
import useAdminRealtimeSocket from "./hooks/useAdminRealtimeSocket";

const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const ReturnsPage = lazy(() => import("./pages/ReturnsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const CouponsPage = lazy(() => import("./pages/CouponsPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage"));
const FileImportPage = lazy(() => import("./pages/FileImportPage"));
const OBPointsPage = lazy(() => import("./pages/OBPointsPage"));
const TicketsPage = lazy(() => import("./pages/TicketsPage"));

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
  
  const adminChatInboundRef = useRef(null);
  const adminReturnsInboundRef = useRef(null);
  
  const { snapshot: liveSnapshot, counters: liveCounters, connected: liveConnected, lastUpdatedAt } = useAdminLive(
    Boolean(token && admin)
  );
  
  const {
    connected: wsConnected,
    eventTicks,
    soundEnabled,
    toggleSound
  } = useAdminRealtimeSocket(Boolean(token && admin), adminChatInboundRef, adminReturnsInboundRef);

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

  const refreshOverviewCounts = useCallback(async () => {
    try {
      const r = await adminApi.overview();
      setOverviewCounts({
        orders: Number(r?.totalOrders ?? 0),
        customers: Number(r?.totalCustomers ?? 0),
        products: Number(r?.totalProducts ?? 0),
        messages: Number(r?.activeChats ?? 0),
        payments: null,
        disputes: null
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
      } catch {
        if (cancelled) return;
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

  const handleLogin = async (payload) => {
    setLoading(true);
    try {
      const res = await adminApi.login(payload);
      setSession(res.token, res.admin);
      setToken(res.token);
      setAdmin(res.admin);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
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
    customers: <CustomersPage />,
    orders: <OrdersPage initialSearch={ordersSearch} liveTick={eventTicks.orders} />,
    delivery: <DeliveryPage />,
    adminUsers: <AdminUsersPage liveTick={eventTicks.users} />,
    payments: <PaymentsPage liveTick={eventTicks.payments} />,
    returns: <ReturnsPage returnsInboundRef={adminReturnsInboundRef} returnLiveTick={eventTicks.returns} wsConnected={wsConnected} />,
    reviews: <ReviewsPage />,
    coupons: <CouponsPage />,
    analytics: <AnalyticsPage />,
    chat: <ChatPage liveTick={eventTicks.chats} wsConnected={wsConnected} chatInboundRef={adminChatInboundRef} />,
    applications: <ApplicationsPage />,
    notifications: <NotificationsPage onInboxChanged={refreshAdminUnread} />,
    disputes: <DisputesPage />,
    audit: <AuditLogsPage />,
    settings: <GlobalSettingsPage />,
    fileImport: <FileImportPage />,
    obPoints: <OBPointsPage />,
    tickets: <TicketsPage />,
  };

  const renderContent = () => {
    if (denied) return <div className="crm-card border-crm-danger text-crm-danger bg-crm-danger-dim p-8 text-center font-bold">You do not have permission for this module.</div>;
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
          adminUnreadCount={adminUnreadAlerts}
          liveCounters={{ ...overviewCounts, ...liveCounters }}
          liveConnected={liveConnected}
          wsConnected={wsConnected}
          soundEnabled={soundEnabled}
          onToggleSound={toggleSound}
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
