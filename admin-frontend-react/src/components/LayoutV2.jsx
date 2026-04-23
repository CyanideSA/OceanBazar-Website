import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiHome, FiBox, FiFolder, FiFilePlus, FiPackage, FiTruck, 
  FiUsers, FiCreditCard, FiCornerUpLeft, FiAlertCircle, 
  FiMessageSquare, FiTag, FiBarChart2, FiBriefcase, 
  FiBell, FiShield, FiSettings, FiMenu, FiX, FiChevronLeft, 
  FiChevronRight, FiSearch, FiVolume2, FiVolumeX, FiLogOut,
  FiActivity, FiStar, FiFileText, FiHelpCircle, FiImage,
  FiChevronDown, FiCommand, FiClock, FiCheck
} from "react-icons/fi";
import { getAccessibleModules } from "../auth/permissionMatrix";
import { adminApi } from "../lib/api";

/* ─── NAV definition ─── */
const NAV_GROUPS = [
  { title: "Overview", items: [
    { key: "dashboard", label: "Dashboard", icon: FiHome },
    { key: "analytics", label: "Analytics", icon: FiBarChart2 },
  ]},
  { title: "Catalog", items: [
    { key: "products", label: "Products", icon: FiBox },
    { key: "catalog", label: "Explorer", icon: FiFolder },
    { key: "inventory", label: "Inventory", icon: FiPackage },
    { key: "fileImport", label: "Import", icon: FiFilePlus },
  ]},
  { title: "Commerce", items: [
    { key: "orders", label: "Orders", icon: FiFileText, badgeKey: "orders" },
    { key: "delivery", label: "Delivery", icon: FiTruck },
    { key: "returns", label: "Returns", icon: FiCornerUpLeft },
    { key: "payments", label: "Payments", icon: FiCreditCard },
    { key: "coupons", label: "Coupons", icon: FiTag },
    { key: "obPoints", label: "OB Points", icon: FiStar },
  ]},
  { title: "Customers", items: [
    { key: "customers", label: "Customers", icon: FiUsers },
    { key: "reviews", label: "Reviews", icon: FiStar },
    { key: "disputes", label: "Disputes", icon: FiAlertCircle },
  ]},
  { title: "Communications", items: [
    { key: "chat", label: "Live Chat", icon: FiMessageSquare, badgeKey: "messages" },
    { key: "tickets", label: "Tickets", icon: FiHelpCircle },
    { key: "notifications", label: "Alerts", icon: FiBell },
  ]},
  { title: "Business", items: [
    { key: "applications", label: "Applications", icon: FiBriefcase },
  ]},
  { title: "Admin", items: [
    { key: "adminUsers", label: "Team", icon: FiShield },
    { key: "audit", label: "Audit Logs", icon: FiActivity },
    { key: "settings", label: "Settings", icon: FiSettings },
  ]},
];

const MOBILE_TABS = [
  { key: "dashboard", label: "Home", icon: FiHome },
  { key: "orders", label: "Orders", icon: FiFileText },
  { key: "chat", label: "Chat", icon: FiMessageSquare },
  { key: "notifications", label: "Alerts", icon: FiBell },
];

/* ─── Notification Dropdown ─── */
function NotificationDropdown({ isOpen, onClose, onNavigate, containerRef }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    adminApi.notifications({ limit: 8 }).then(res => {
      if (cancelled) return;
      setItems(Array.isArray(res) ? res : res?.notifications || res?.content || []);
    }).catch(() => {}).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div ref={containerRef} className="absolute right-0 top-full mt-2 w-80 max-h-[420px] rounded-lg border border-crm-border bg-crm-bg-alt shadow-xl z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-crm-border">
        <h4 className="text-sm font-bold text-crm-text-bright">Notifications</h4>
        <button onClick={() => { onNavigate("notifications"); onClose(); }} className="text-xs text-crm-primary hover:underline font-medium">View All</button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-crm-primary"></div></div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-crm-text-dim text-sm">No notifications</div>
        ) : (
          items.map((n, i) => (
            <div key={n.id || i} className={`px-4 py-3 border-b border-crm-border/50 hover:bg-crm-bg-hover transition-colors cursor-pointer ${!n.readStatus ? "bg-crm-primary-dim/30" : ""}`}>
              <div className="flex items-start gap-2.5">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.readStatus ? "bg-crm-primary" : "bg-crm-bg-hover"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-crm-text-bright truncate">{n.title || "Notification"}</p>
                  <p className="text-[11px] text-crm-text-dim line-clamp-2 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-crm-text-muted mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Command Palette ─── */
function CommandPalette({ isOpen, onClose, onSelect, allItems }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 10);
    const q = query.toLowerCase();
    return allItems.filter(i => i.label.toLowerCase().includes(q) || i.key.toLowerCase().includes(q));
  }, [query, allItems]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-lg rounded-xl border border-crm-border bg-crm-bg-alt shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-crm-border">
          <FiSearch size={18} className="text-crm-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results.length > 0) {
                onSelect(results[0].key);
              }
            }}
            placeholder="Search pages, commands…"
            className="flex-1 bg-transparent text-sm text-crm-text-bright placeholder:text-crm-text-muted outline-none"
          />
          <kbd className="text-[10px] bg-crm-bg px-1.5 py-0.5 rounded border border-crm-border text-crm-text-muted font-mono">ESC</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar py-1">
          {results.length === 0 ? (
            <div className="py-6 text-center text-crm-text-dim text-sm">No results found</div>
          ) : (
            results.map(item => (
              <button
                key={item.key}
                onClick={() => onSelect(item.key)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-crm-bg-hover transition-colors"
              >
                <item.icon size={16} className="text-crm-text-muted shrink-0" />
                <span className="text-sm text-crm-text-bright font-medium">{item.label}</span>
                <span className="ml-auto text-[10px] text-crm-text-muted">Navigate</span>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main Layout ─── */
export default function Layout({
  active, onSelect, admin, onLogout,
  adminUnreadCount = 0, liveCounters = {},
  liveConnected = false, wsConnected = false,
  soundEnabled = true, onToggleSound, children
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const notifRef = useRef(null);

  const accessibleNavKeys = useMemo(() => new Set(getAccessibleModules(admin?.role)), [admin?.role]);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => accessibleNavKeys.has(i.key)) })).filter(g => g.items.length > 0);
  }, [accessibleNavKeys]);

  const allNavItems = useMemo(() => {
    const items = [];
    NAV_GROUPS.forEach(g => g.items.forEach(i => { if (accessibleNavKeys.has(i.key)) items.push(i); }));
    return items;
  }, [accessibleNavKeys]);

  const onSelectAndClose = useCallback((key) => {
    onSelect(key);
    setMobileNavOpen(false);
    setCmdOpen(false);
  }, [onSelect]);

  const currentModuleLabel = useMemo(() => {
    for (const g of NAV_GROUPS) { const i = g.items.find(x => x.key === active); if (i) return i.label; }
    return active.charAt(0).toUpperCase() + active.slice(1);
  }, [active]);

  const displayCount = v => (v == null ? "0" : Number(v));

  // Click outside to close notif dropdown
  useEffect(() => {
    const h = e => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Ctrl+K command palette
  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
      if (e.key === "Escape") { setCmdOpen(false); setNotifOpen(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="crm-shell">
      {/* ── Desktop Sidebar ── */}
      <motion.aside
        className={`crm-sidebar hidden lg:flex ${collapsed ? "collapsed" : ""}`}
        initial={false}
        animate={{ width: collapsed ? "var(--crm-sidebar-collapsed)" : "var(--crm-sidebar-width)" }}
      >
        <div className="flex items-center justify-between p-4 mb-1">
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 select-none">
              <img src="/logo-dark.png" alt="OceanBazar" className="h-11 w-auto object-contain drop-shadow-md" />
              <span className="text-[9px] font-semibold text-crm-text-muted align-top">CRM</span>
            </motion.div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-crm-bg-hover text-crm-text-dim hover:text-crm-text-bright transition-colors">
            {collapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 mb-3">
            <button onClick={() => setCmdOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-crm-text-muted text-xs hover:bg-crm-bg-hover transition-colors border border-crm-border">
              <FiSearch size={14} /><span className="flex-1 text-left">Quick find…</span>
              <kbd className="text-[10px] bg-crm-bg px-1.5 py-0.5 rounded border border-crm-border font-mono">⌘K</kbd>
            </button>
          </div>
        )}

        <nav className="flex-1 px-3 space-y-5 custom-scrollbar overflow-y-auto pb-2">
          {visibleGroups.map((group, idx) => (
            <div key={idx} className="space-y-0.5">
              {!collapsed && <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-crm-text-muted mb-1.5">{group.title}</h3>}
              {group.items.map(item => {
                const isActive = active === item.key;
                const badgeVal = item.badgeKey ? liveCounters[item.badgeKey] : null;
                return (
                  <button key={item.key} onClick={() => onSelectAndClose(item.key)} title={collapsed ? item.label : ""}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all relative ${isActive ? "bg-crm-primary text-white shadow-lg shadow-crm-primary/20" : "text-crm-text-dim hover:bg-crm-bg-hover hover:text-crm-text-bright"}`}
                  >
                    <item.icon size={collapsed ? 22 : 16} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                        {badgeVal > 0 && !isActive && (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-crm-danger px-1.5 text-[10px] font-bold text-white">{badgeVal > 99 ? "99+" : badgeVal}</span>
                        )}
                      </>
                    )}
                    {collapsed && badgeVal > 0 && (
                      <span className="absolute top-0.5 right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-crm-danger opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-crm-danger" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-crm-border mt-auto">
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-crm-primary to-purple-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md">
              {admin?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-crm-text-bright">{admin?.name}</p>
                <p className="text-[10px] text-crm-text-dim uppercase tracking-wider">{admin?.roleLabel || admin?.role}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={onLogout} className="p-1.5 rounded-md text-crm-text-dim hover:text-crm-danger hover:bg-crm-danger-dim transition-colors" title="Logout">
                <FiLogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] z-50 lg:hidden bg-crm-bg-alt border-r border-crm-border flex flex-col overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4">
                <img src="/logo-dark.png" alt="OceanBazar" className="h-10 w-auto object-contain drop-shadow-md" />
                <button onClick={() => setMobileNavOpen(false)} className="p-1.5 text-crm-text-dim hover:text-crm-text-bright"><FiX size={20} /></button>
              </div>
              <nav className="flex-1 px-3 space-y-5 overflow-y-auto pb-4">
                {visibleGroups.map((group, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <h3 className="px-3 text-[10px] font-bold uppercase tracking-widest text-crm-text-muted mb-1.5">{group.title}</h3>
                    {group.items.map(item => (
                      <button key={item.key} onClick={() => onSelectAndClose(item.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${active === item.key ? "bg-crm-primary text-white" : "text-crm-text-dim hover:bg-crm-bg-hover hover:text-crm-text-bright"}`}
                      >
                        <item.icon size={18} className="shrink-0" /><span className="text-sm font-medium">{item.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
              <div className="p-4 border-t border-crm-border">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-crm-primary to-purple-500 flex items-center justify-center text-white font-bold text-xs shrink-0">{admin?.name?.charAt(0)?.toUpperCase() || "A"}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-crm-text-bright">{admin?.name}</p>
                    <p className="text-[10px] text-crm-text-dim uppercase tracking-wider">{admin?.roleLabel || admin?.role}</p>
                  </div>
                  <button onClick={onLogout} className="p-1.5 text-crm-text-dim hover:text-crm-danger"><FiLogOut size={16} /></button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="crm-main">
        {/* Topbar */}
        <header className="crm-topbar">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-md text-crm-text-dim hover:bg-crm-bg-hover" onClick={() => setMobileNavOpen(true)}>
              <FiMenu size={22} />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-sm">
              <span className="text-crm-text-muted">Admin</span>
              <FiChevronRight size={12} className="text-crm-text-muted" />
              <span className="text-crm-text-bright font-semibold">{currentModuleLabel}</span>
            </div>
          </div>

          <div className="relative max-w-sm w-full mx-4 hidden md:block">
            <button onClick={() => setCmdOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-crm-border bg-crm-bg text-crm-text-muted text-sm hover:border-crm-border-strong transition-colors">
              <FiSearch size={14} /><span className="flex-1 text-left text-xs">Search anything…</span>
              <kbd className="text-[10px] bg-crm-bg-alt px-1.5 py-0.5 rounded border border-crm-border font-mono">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Live counters - desktop only */}
            <div className="hidden xl:flex items-center gap-3 px-3 border-r border-crm-border mr-1">
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase text-crm-text-dim leading-none mb-0.5 font-semibold tracking-wider">Orders</span>
                <span className="text-sm font-bold text-crm-success tabular-nums">{displayCount(liveCounters?.orders)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase text-crm-text-dim leading-none mb-0.5 font-semibold tracking-wider">Customers</span>
                <span className="text-sm font-bold text-crm-primary tabular-nums">{displayCount(liveCounters?.customers)}</span>
              </div>
            </div>

            {/* Sound toggle */}
            <button onClick={onToggleSound}
              className={`p-2 rounded-lg transition-colors ${soundEnabled ? "text-crm-primary bg-crm-primary-dim" : "text-crm-text-dim hover:bg-crm-bg-hover"}`}
              title={soundEnabled ? "Mute" : "Unmute"}
            >
              {soundEnabled ? <FiVolume2 size={18} /> : <FiVolumeX size={18} />}
            </button>

            {/* Notification bell + dropdown */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(o => !o)} className="p-2 rounded-lg text-crm-text-dim hover:bg-crm-bg-hover transition-colors relative">
                <FiBell size={18} />
                {adminUnreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-[1rem] px-1 bg-crm-danger text-[10px] font-bold text-white rounded-full flex items-center justify-center">
                    {adminUnreadCount > 99 ? "99+" : adminUnreadCount}
                  </span>
                )}
              </button>
              <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} onNavigate={onSelectAndClose} containerRef={notifRef} />
            </div>

            {/* Connection status */}
            <div className="hidden sm:flex flex-col items-end gap-0.5 ml-1">
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${liveConnected ? "bg-crm-success" : "bg-crm-warning animate-pulse"}`} />
                <span className="text-[9px] font-semibold text-crm-text-dim uppercase tracking-tight">API</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-crm-success" : "bg-crm-danger animate-pulse"}`} />
                <span className="text-[9px] font-semibold text-crm-text-dim uppercase tracking-tight">WS</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="crm-content custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Tabs */}
        <nav className="lg:hidden flex items-center justify-around border-t border-crm-border bg-crm-bg-alt px-1 py-1 shrink-0" style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}>
          {MOBILE_TABS.map(tab => {
            const isActive = active === tab.key;
            const badgeVal = tab.key === "chat" ? liveCounters.messages : tab.key === "notifications" ? adminUnreadCount : 0;
            return (
              <button key={tab.key} onClick={() => onSelect(tab.key)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative ${isActive ? "text-crm-primary" : "text-crm-text-dim"}`}
              >
                <tab.icon size={20} />
                <span className="text-[10px] font-semibold">{tab.label}</span>
                {badgeVal > 0 && (
                  <span className="absolute -top-0.5 right-1 h-4 min-w-[1rem] px-1 bg-crm-danger text-[9px] font-bold text-white rounded-full flex items-center justify-center">{badgeVal > 9 ? "9+" : badgeVal}</span>
                )}
              </button>
            );
          })}
          <button onClick={() => setMobileNavOpen(true)} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-crm-text-dim">
            <FiMenu size={20} /><span className="text-[10px] font-semibold">More</span>
          </button>
        </nav>
      </div>

      {/* ── Command Palette ── */}
      <AnimatePresence>
        {cmdOpen && <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} onSelect={onSelectAndClose} allItems={allNavItems} />}
      </AnimatePresence>
    </div>
  );
}
