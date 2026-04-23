import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiHome, FiBox, FiFolder, FiFilePlus, FiPackage, FiTruck, 
  FiUsers, FiCreditCard, FiCornerUpLeft, FiAlertCircle, 
  FiMessageSquare, FiTag, FiBarChart2, FiBriefcase, 
  FiBell, FiShield, FiSettings, FiMenu, FiX, FiChevronLeft, 
  FiChevronRight, FiSearch, FiVolume2, FiVolumeX, FiLogOut,
  FiActivity, FiStar, FiFileText, FiHelpCircle
} from "react-icons/fi";
import { getAccessibleModules } from "../auth/permissionMatrix";

const NAV_GROUPS = [
  {
    title: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: FiHome },
      { key: "analytics", label: "Analytics", icon: FiBarChart2 },
    ]
  },
  {
    title: "Catalog",
    items: [
      { key: "products", label: "Products", icon: FiBox },
      { key: "catalog", label: "Explorer", icon: FiFolder },
      { key: "inventory", label: "Inventory", icon: FiPackage },
      { key: "fileImport", label: "Import", icon: FiFilePlus },
    ]
  },
  {
    title: "Commerce",
    items: [
      { key: "orders", label: "Orders", icon: FiFileText },
      { key: "delivery", label: "Delivery", icon: FiTruck },
      { key: "returns", label: "Returns", icon: FiCornerUpLeft },
      { key: "payments", label: "Payments", icon: FiCreditCard },
      { key: "coupons", label: "Coupons", icon: FiTag },
      { key: "obPoints", label: "OB Points", icon: FiStar },
    ]
  },
  {
    title: "Customers",
    items: [
      { key: "customers", label: "Customers", icon: FiUsers },
      { key: "reviews", label: "Reviews", icon: FiStar },
      { key: "disputes", label: "Disputes", icon: FiAlertCircle },
    ]
  },
  {
    title: "Communications",
    items: [
      { key: "chat", label: "Live Chat", icon: FiMessageSquare },
      { key: "tickets", label: "Tickets", icon: FiHelpCircle },
      { key: "notifications", label: "Alerts", icon: FiBell },
    ]
  },
  {
    title: "Business",
    items: [
      { key: "applications", label: "Applications", icon: FiBriefcase },
    ]
  },
  {
    title: "Admin",
    items: [
      { key: "adminUsers", label: "Team", icon: FiShield },
      { key: "audit", label: "Audit Logs", icon: FiActivity },
      { key: "settings", label: "Settings", icon: FiSettings },
    ]
  }
];

export default function Layout({
  active,
  onSelect,
  admin,
  onLogout,
  adminUnreadCount = 0,
  liveCounters = {},
  liveConnected = false,
  wsConnected = false,
  soundEnabled = true,
  onToggleSound,
  children
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const accessibleNavKeys = useMemo(
    () => new Set(getAccessibleModules(admin?.role)),
    [admin?.role]
  );

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => accessibleNavKeys.has(item.key))
    })).filter(group => group.items.length > 0);
  }, [accessibleNavKeys]);

  const onSelectAndClose = (key) => {
    onSelect(key);
    setMobileNavOpen(false);
  };

  const currentModuleLabel = useMemo(() => {
    for (const group of NAV_GROUPS) {
      const item = group.items.find(i => i.key === active);
      if (item) return item.label;
    }
    return active.charAt(0).toUpperCase() + active.slice(1);
  }, [active]);

  const displayCount = (value) => (value === null || value === undefined ? "0" : Number(value));

  // Keyboard shortcut for search (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="crm-shell">
      {/* Sidebar */}
      <motion.aside 
        className={`crm-sidebar ${collapsed ? "collapsed" : ""} ${mobileNavOpen ? "mobile-open" : ""}`}
        initial={false}
        animate={{ width: collapsed ? "var(--crm-sidebar-collapsed)" : "var(--crm-sidebar-width)" }}
      >
        <div className="flex items-center justify-between p-4 mb-2">
          {!collapsed && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold tracking-tight text-crm-primary"
            >
              OCEAN<span className="text-crm-text-bright">BAZAR</span>
            </motion.h1>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-text-bright transition-colors"
          >
            {collapsed ? <FiChevronRight size={20} /> : <FiChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-6 custom-scrollbar overflow-y-auto">
          {visibleGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && (
                <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-crm-text-muted mb-2">
                  {group.title}
                </h3>
              )}
              {group.items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onSelectAndClose(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all group relative ${
                    active === item.key 
                      ? "bg-crm-primary text-white shadow-lg" 
                      : "text-crm-text-dim hover:bg-crm-bg-hover hover:text-crm-text-bright"
                  }`}
                  title={collapsed ? item.label : ""}
                >
                  <item.icon size={collapsed ? 24 : 18} className="shrink-0" />
                  {!collapsed && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                  {item.key === "chat" && liveCounters.messages > 0 && (
                    <span className={`absolute ${collapsed ? "top-1 right-1" : "right-2"} flex h-2 w-2`}>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crm-danger opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-crm-danger"></span>
                    </span>
                  )}
                  {active === item.key && !collapsed && (
                    <motion.div 
                      layoutId="active-nav"
                      className="absolute inset-0 bg-crm-primary rounded-md -z-10"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-crm-border mt-auto">
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="w-8 h-8 rounded-full bg-crm-purple flex items-center justify-center text-white font-bold text-xs shrink-0">
              {admin?.name?.charAt(0) || "A"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-crm-text-bright">{admin?.name}</p>
                <p className="text-[10px] text-crm-text-dim uppercase tracking-wider">{admin?.roleLabel || admin?.role}</p>
              </div>
            )}
            {!collapsed && (
              <button 
                onClick={onLogout}
                className="p-1.5 text-crm-text-dim hover:text-crm-danger transition-colors"
                title="Logout"
              >
                <FiLogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="crm-main">
        {/* Topbar */}
        <header className="crm-topbar">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-crm-text-dim"
              onClick={() => setMobileNavOpen(true)}
            >
              <FiMenu size={24} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-crm-text-dim">Admin</span>
              <span className="text-crm-text-muted">/</span>
              <span className="text-crm-text-bright font-medium">{currentModuleLabel}</span>
            </div>
          </div>

          <div className={`relative max-w-md w-full mx-4 transition-all ${searchFocused ? "scale-105" : ""}`}>
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <FiSearch className={searchFocused ? "text-crm-primary" : "text-crm-text-muted"} />
            </div>
            <input 
              id="global-search"
              type="text" 
              placeholder="Search anything... (Ctrl+K)"
              className="crm-input pl-10 h-9"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-4 px-4 border-r border-crm-border mr-2">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-crm-text-dim leading-none mb-1">Live Sales</span>
                <span className="text-sm font-bold text-crm-success tabular-nums">
                  {displayCount(liveCounters?.orders)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase text-crm-text-dim leading-none mb-1">Customers</span>
                <span className="text-sm font-bold text-crm-cyan tabular-nums">
                  {displayCount(liveCounters?.customers)}
                </span>
              </div>
            </div>

            <button 
              onClick={onToggleSound}
              className={`p-2 rounded-full transition-colors ${soundEnabled ? "text-crm-primary bg-crm-primary-dim" : "text-crm-text-dim hover:bg-crm-bg-hover"}`}
              title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
            >
              {soundEnabled ? <FiVolume2 size={20} /> : <FiVolumeX size={20} />}
            </button>

            <div className="relative">
              <button className="p-2 rounded-full text-crm-text-dim hover:bg-crm-bg-hover transition-colors relative">
                <FiBell size={20} />
                {adminUnreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 min-w-[1rem] px-1 bg-crm-danger text-[10px] font-bold text-white rounded-full flex items-center justify-center">
                    {adminUnreadCount > 99 ? "99+" : adminUnreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 ml-2">
              <div className="flex flex-col items-end mr-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${liveConnected ? "bg-crm-success" : "bg-crm-warning animate-pulse"}`}></span>
                  <span className="text-[10px] font-medium text-crm-text-dim uppercase tracking-tight">API</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-crm-success" : "bg-crm-danger animate-pulse"}`}></span>
                  <span className="text-[10px] font-medium text-crm-text-dim uppercase tracking-tight">Realtime</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="crm-content custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Nav Backdrop */}
      {mobileNavOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
    </div>
  );
}
