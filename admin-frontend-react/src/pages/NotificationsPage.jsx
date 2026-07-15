import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  FiBell, FiShoppingCart, FiCreditCard, FiPackage, 
  FiSearch, FiFilter, FiCheckCircle, FiTrash2, 
  FiMoreVertical, FiMail, FiUsers, FiRadio, FiChevronDown, FiChevronUp,
  FiX, FiSend, FiSmartphone
} from "react-icons/fi";
import { adminApi, api } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { hasPermission } from "../auth/permissionMatrix";
import { useToast } from "../components/ToastProvider";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import useAdminBffSocket from '../hooks/useAdminBffSocket';
import { useQueryClient } from '@tanstack/react-query';
import useStepUpReauth from "../hooks/useStepUpReauth";

const KIND_CONFIG = {
  new_order: { label: "New Order", icon: FiShoppingCart, class: "text-crm-primary bg-crm-primary-dim border-crm-primary/20" },
  payment_update: { label: "Payment", icon: FiCreditCard, class: "text-crm-success bg-crm-success-dim border-crm-success/20" },
  low_stock: { label: "Low Stock", icon: FiPackage, class: "text-crm-warning bg-crm-warning-dim border-crm-warning/20" },
  system: { label: "System", icon: FiBell, class: "text-crm-text-dim bg-crm-bg-hover border-crm-border" },
};

const TABS = [
  { key: "all", label: "All Alerts" },
  { key: "unread", label: "Unread" },
  { key: "new_order", label: "Orders" },
  { key: "payment_update", label: "Payments" },
  { key: "low_stock", label: "Stock" },
];

export default function NotificationsPage({ onInboxChanged }) {
  const { requestToken, modal: reauthModal } = useStepUpReauth();
  const toast = useToast();
  const qc = useQueryClient();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', audience: 'all', kind: 'system' });
  const [sending, setSending] = useState(false);
  const [showPushBroadcast, setShowPushBroadcast] = useState(false);
  const [pushForm, setPushForm] = useState({ title: '', body: '', url: '/' });
  const [pushSending, setPushSending] = useState(false);

  const adminRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const canSend = Boolean(hasPermission(adminRole, "notifications", "send"));

  const { connected: wsConnected, eventTicks } = useAdminBffSocket();

  useEffect(() => {
    if (wsConnected) {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] });
    }
  }, [wsConnected, qc]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.notifications({ adminInbox: true });
      setItems(Array.isArray(res) ? res : res?.notifications || res?.items || []);
      const unreadRes = await adminApi.notificationsUnreadCount();
      setUnreadCount(unreadRes?.count ?? 0);
    } catch (err) {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filteredNotifications = useMemo(() => {
    let list = items;
    if (activeTab === "unread") list = list.filter(n => !n.read);
    else if (activeTab !== "all") list = list.filter(n => n.kind === activeTab);
    
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n => n.title?.toLowerCase().includes(q) || n.message?.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeTab, search]);

  const markRead = async (id) => {
    try {
      await adminApi.markNotificationRead(id);
      setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      onInboxChanged?.();
    } catch (err) {
      toast.error("Failed to mark as read");
    }
  };

  const markAllRead = async () => {
    try {
      await adminApi.markAllAdminNotificationsRead();
      setItems(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      onInboxChanged?.();
      toast.success("Inbox cleared");
    } catch (err) {
      toast.error("Failed to clear inbox");
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSending(true);
    try {
      const reauthToken = await requestToken();
      await adminApi.createNotification({
        title: broadcastForm.title,
        message: broadcastForm.message,
        audience: broadcastForm.audience,
        kind: broadcastForm.kind,
      }, reauthToken);
      toast.success('Broadcast sent successfully');
      setShowBroadcast(false);
      setBroadcastForm({ title: '', message: '', audience: 'all', kind: 'system' });
      loadNotifications();
    } catch {
      toast.error('Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const sendPushBroadcast = async () => {
    if (!pushForm.title.trim() || !pushForm.body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setPushSending(true);
    try {
      const reauthToken = await requestToken();
      await api.post('/api/push/broadcast', {
        title: pushForm.title,
        body: pushForm.body,
        url: pushForm.url || '/',
      }, { headers: { "x-admin-reauth-token": reauthToken } });
      toast.success('Web push notification sent to all subscribers!');
      setShowPushBroadcast(false);
      setPushForm({ title: '', body: '', url: '/' });
    } catch {
      toast.error('Failed to send push notification');
    } finally {
      setPushSending(false);
    }
  };

  const deleteNotification = async (id) => {
    if (!window.confirm("Permanently delete this alert?")) return;
    try {
      await adminApi.deleteNotification(id);
      setItems(prev => prev.filter(n => n.id !== id));
      toast.success("Notification removed");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
            <FiBell size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Admin Inbox</h2>
            <p className="text-crm-text-dim text-sm">Review automated alerts and system messages</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="crm-btn">
              <FiCheckCircle /> Mark All Read
            </button>
          )}
          {canSend && (
            <>
              <button className="crm-btn" onClick={() => setShowPushBroadcast(true)}>
                <FiSmartphone /> Push Notification
              </button>
              <button className="crm-btn crm-btn-primary" onClick={() => setShowBroadcast(true)}>
                <FiRadio /> New Broadcast
              </button>
            </>
          )}
        </div>
      </div>

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        {TABS.map(tab => {
          const count = tab.key === "unread" ? unreadCount : 
                        tab.key === "all" ? items.length : 
                        items.filter(n => n.kind === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 border-b-2 transition-all font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.key 
                  ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
                  : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? "bg-crm-primary text-white" : "bg-crm-bg-hover text-crm-text-dim"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4 rounded-t-none border-t-0">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input 
            type="text" 
            placeholder="Search notifications..." 
            className="crm-input pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="crm-card p-12 text-center text-crm-text-dim">
            <FiBell size={40} className="mx-auto mb-4 opacity-20" />
            <p>Your inbox is clear</p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const config = KIND_CONFIG[n.kind] || KIND_CONFIG.system;
            const isExpanded = expandedId === n.id;
            return (
              <div 
                key={n.id} 
                className={`crm-card p-0 transition-all border-l-4 ${
                  n.read ? "border-l-transparent" : "border-l-crm-primary bg-crm-bg-alt/80"
                } ${isExpanded ? "ring-1 ring-crm-primary/30" : ""}`}
              >
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : n.id)}
                  className="p-4 flex items-start gap-4 cursor-pointer hover:bg-crm-bg-hover transition-colors"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${config.class}`}>
                    <config.icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm font-bold truncate ${n.read ? "text-crm-text-dim" : "text-crm-text-bright"}`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-crm-text-muted font-medium uppercase tracking-wider whitespace-nowrap ml-2">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={`text-sm line-clamp-1 ${n.read ? "text-crm-text-muted" : "text-crm-text-dim"}`}>
                      {n.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!n.read && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                        className="p-1.5 text-crm-primary hover:bg-crm-primary-dim rounded-md transition-colors"
                        title="Mark as read"
                      >
                        <FiCheckCircle size={16} />
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      className="p-1.5 text-crm-text-muted hover:text-crm-danger hover:bg-crm-danger-dim rounded-md transition-colors"
                    >
                      <FiTrash2 size={16} />
                    </button>
                    {isExpanded ? <FiChevronUp className="text-crm-text-muted" /> : <FiChevronDown className="text-crm-text-muted" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-crm-border/50"
                    >
                      <div className="p-4 bg-crm-bg/30 space-y-4 text-sm">
                        <div className="bg-crm-bg-alt p-4 rounded-lg border border-crm-border text-crm-text-bright leading-relaxed whitespace-pre-wrap">
                          {n.message}
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-bold text-crm-text-dim uppercase tracking-widest">
                          <div className="flex items-center gap-1.5"><FiMail /> Audience: {n.audience}</div>
                          {n.entityId && <div className="flex items-center gap-1.5"><FiPackage /> Linked ID: {n.entityId}</div>}
                          <div className="flex items-center gap-1.5"><FiUsers /> Created By: {n.createdByAdminId || "System"}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
      {/* Broadcast Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBroadcast(false)} />
          <div className="relative w-full max-w-lg bg-crm-bg-card border border-crm-border rounded-2xl shadow-2xl z-10">
            <div className="flex items-center justify-between p-6 border-b border-crm-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-crm-primary-dim text-crm-primary"><FiRadio size={20} /></div>
                <div>
                  <h3 className="font-bold text-crm-text-bright">Send Broadcast</h3>
                  <p className="text-xs text-crm-text-dim">Push a system notification to users or admins</p>
                </div>
              </div>
              <button onClick={() => setShowBroadcast(false)} className="p-1.5 hover:bg-crm-bg-hover rounded-lg text-crm-text-dim"><FiX /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Title</label>
                <input
                  className="crm-input w-full"
                  placeholder="e.g. System Maintenance Notice"
                  value={broadcastForm.title}
                  onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Message</label>
                <textarea
                  className="crm-input w-full min-h-[100px] resize-none"
                  placeholder="Write your broadcast message here..."
                  value={broadcastForm.message}
                  onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Audience</label>
                  <select
                    className="crm-input w-full"
                    value={broadcastForm.audience}
                    onChange={e => setBroadcastForm(f => ({ ...f, audience: e.target.value }))}
                  >
                    <option value="all">All Users</option>
                    <option value="admin">Admins Only</option>
                    <option value="customer">Customers Only</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Type</label>
                  <select
                    className="crm-input w-full"
                    value={broadcastForm.kind}
                    onChange={e => setBroadcastForm(f => ({ ...f, kind: e.target.value }))}
                  >
                    <option value="system">System</option>
                    <option value="new_order">Order</option>
                    <option value="payment_update">Payment</option>
                    <option value="low_stock">Stock Alert</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button className="crm-btn flex-1" onClick={() => setShowBroadcast(false)}>Cancel</button>
              <button
                className="crm-btn crm-btn-primary flex-1"
                onClick={sendBroadcast}
                disabled={sending}
              >
                {sending ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full inline-block" /> : <FiSend />}
                {sending ? 'Sending...' : 'Send Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Web Push Broadcast Modal */}
      {showPushBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPushBroadcast(false)} />
          <div className="relative w-full max-w-lg bg-crm-bg-card border border-crm-border rounded-2xl shadow-2xl z-10">
            <div className="flex items-center justify-between p-6 border-b border-crm-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-crm-primary-dim text-crm-primary"><FiSmartphone size={20} /></div>
                <div>
                  <h3 className="font-bold text-crm-text-bright">Web Push Notification</h3>
                  <p className="text-xs text-crm-text-dim">Send browser push to all subscribed users</p>
                </div>
              </div>
              <button onClick={() => setShowPushBroadcast(false)} className="p-1.5 hover:bg-crm-bg-hover rounded-lg text-crm-text-dim"><FiX /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Title</label>
                <input
                  className="crm-input w-full"
                  placeholder="e.g. Flash Sale — 50% Off!"
                  value={pushForm.title}
                  onChange={e => setPushForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Message</label>
                <textarea
                  className="crm-input w-full min-h-[90px] resize-none"
                  placeholder="Short notification body (max 120 chars)"
                  maxLength={120}
                  value={pushForm.body}
                  onChange={e => setPushForm(f => ({ ...f, body: e.target.value }))}
                />
                <p className="text-right text-[10px] text-crm-text-muted">{pushForm.body.length}/120</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-crm-text-dim uppercase tracking-wider">Click URL</label>
                <input
                  className="crm-input w-full"
                  placeholder="/products or https://oceanbazar.com"
                  value={pushForm.url}
                  onChange={e => setPushForm(f => ({ ...f, url: e.target.value }))}
                />
              </div>
              <div className="rounded-lg border border-crm-border bg-crm-bg-alt p-3 text-xs text-crm-text-dim">
                <p className="font-semibold text-crm-text-bright mb-1">📱 Preview</p>
                <p className="font-medium">{pushForm.title || "(title)"}</p>
                <p>{pushForm.body || "(message)"}</p>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button className="crm-btn flex-1" onClick={() => setShowPushBroadcast(false)}>Cancel</button>
              <button
                className="crm-btn crm-btn-primary flex-1"
                onClick={sendPushBroadcast}
                disabled={pushSending}
              >
                {pushSending ? <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full inline-block" /> : <FiSmartphone />}
                {pushSending ? 'Sending...' : 'Send Push'}
              </button>
            </div>
          </div>
        </div>
      )}
      {reauthModal}
    </div>
  );
}
