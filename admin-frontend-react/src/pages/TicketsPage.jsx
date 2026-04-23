import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, api, resolveAdminApiBase } from '../lib/api';
import { getToken } from '../lib/auth';
import { 
  FiSearch, FiFilter, FiPlus, FiHelpCircle, FiClock, FiCheckCircle, 
  FiXCircle, FiMoreVertical, FiPaperclip, FiSend, FiUser, 
  FiBox, FiShoppingCart, FiCreditCard, FiActivity, FiTag,
  FiTruck, FiMessageSquare
} from "react-icons/fi";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import useAdminRealtimeSocket from '../hooks/useAdminRealtimeSocket';

const STATUS_CFG = {
  open:        { label: 'Open',        dot: 'bg-crm-warning',   class: 'crm-badge-warning' },
  in_progress: { label: 'In Progress', dot: 'bg-crm-primary',    class: 'bg-crm-primary-dim text-crm-primary border-crm-primary/30' },
  resolved:    { label: 'Resolved',    dot: 'bg-crm-success', badge: 'crm-badge-success' },
  closed:      { label: 'Closed',      dot: 'bg-crm-text-muted',    class: 'text-crm-text-dim border-crm-border'  },
};

const PRIORITY_CFG = {
  low:    { label: 'Low',    class: 'text-crm-text-dim bg-crm-bg-hover border-crm-border' },
  medium: { label: 'Medium', class: 'text-crm-warning bg-crm-warning-dim border-crm-warning/20' },
  high:   { label: 'High',   class: 'text-crm-danger bg-crm-danger-dim border-crm-danger/20' },
  urgent: { label: 'Urgent', class: 'text-white bg-crm-danger border-crm-danger animate-pulse' },
};

const CATEGORY_ICONS = { 
  payment: <FiCreditCard />, 
  delivery: <FiTruck />, 
  product: <FiBox />, 
  other: <FiMessageSquare /> 
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  return (
    <span className={`crm-badge border ${cfg.class || cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.medium;
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${cfg.class}`}>{cfg.label}</span>;
}

export default function TicketsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState({ status: '', priority: '', category: '' });
  const [showCreate, setShowCreate] = useState(false);
  const { connected: wsConnected } = useAdminRealtimeSocket();
  const fileRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (wsConnected) {
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    }
  }, [wsConnected, qc]);

  /* ── Data ── */
  const { data: listData, isLoading } = useQuery({
    queryKey: ['admin-tickets', filter],
    queryFn: () => api.get('/api/admin/tickets', { params: { ...filter, size: 50 } }).then(r => r.data),
    refetchInterval: wsConnected ? false : 30000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['admin-ticket-stats'],
    queryFn: () => api.get('/api/admin/tickets/stats').then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: detail } = useQuery({
    queryKey: ['admin-ticket', selectedId],
    queryFn: () => selectedId ? api.get(`/api/admin/tickets/${selectedId}`).then(r => r.data) : null,
    enabled: !!selectedId,
    refetchInterval: wsConnected ? false : 15000,
  });

  /* ── Mutations ── */
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/api/admin/tickets/${id}`, { status }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      qc.invalidateQueries({ queryKey: ['admin-ticket', selectedId] });
      qc.invalidateQueries({ queryKey: ['admin-ticket-stats'] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, message, attachments }) =>
      api.post(`/api/admin/tickets/${id}/reply`, { message, attachments }).then(r => r.data),
    onSuccess: () => {
      setReply('');
      setPendingFiles([]);
      qc.invalidateQueries({ queryKey: ['admin-ticket', selectedId] });
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
    },
  });

  /* ── File upload ── */
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/api/admin/tickets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPendingFiles(p => [...p, data.url]);
    } catch { /* ignore */ }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages?.length]);

  const sendReply = () => {
    if ((!reply.trim() && !pendingFiles.length) || !selectedId) return;
    replyMutation.mutate({ id: selectedId, message: reply.trim() || '📎', attachments: pendingFiles });
  };

  const tickets = listData?.tickets ?? [];
  const stats = statsData ?? {};

  return (
    <div className="flex flex-col h-[calc(100vh-var(--crm-topbar-height)-3rem)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Support Tickets</h2>
          <p className="text-crm-text-dim text-sm">Customer assistance and issue resolution center</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="crm-btn crm-btn-primary">
            <FiPlus /> New Ticket
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {Object.entries(STATUS_CFG).map(([key, cfg]) => (
          <button 
            key={key} 
            onClick={() => setFilter(f => ({ ...f, status: f.status === key ? '' : key }))}
            className={`crm-card text-left transition-all hover:border-crm-border-strong ${filter.status === key ? "border-crm-primary bg-crm-primary-dim" : ""}`}
          >
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">{cfg.label}</span>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            </div>
            <p className="text-2xl font-bold text-crm-text-bright">{stats[key] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* 3-Column Workspace */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        
        {/* Left: Ticket List */}
        <div className="w-80 flex flex-col crm-card p-0 overflow-hidden">
          <div className="p-4 border-b border-crm-border space-y-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
              <input 
                type="text" 
                placeholder="Search tickets..." 
                className="crm-input pl-10 h-9"
              />
            </div>
            <div className="flex gap-2">
              <select 
                value={filter.priority} 
                onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}
                className="crm-input h-8 py-0 text-xs flex-1"
              >
                <option value="">Priority</option>
                {Object.keys(PRIORITY_CFG).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <select 
                value={filter.category} 
                onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
                className="crm-input h-8 py-0 text-xs flex-1"
              >
                <option value="">Category</option>
                {['payment','delivery','product','other'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="p-8 text-center"><div className="animate-spin h-6 w-6 border-b-2 border-crm-primary mx-auto"></div></div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-crm-text-dim text-sm">No tickets found</div>
            ) : (
              tickets.map(tk => (
                <button
                  key={tk.id}
                  onClick={() => setSelectedId(tk.id)}
                  className={`w-full text-left p-4 border-b border-crm-border transition-all hover:bg-crm-bg-hover flex flex-col gap-2 ${
                    selectedId === tk.id ? "bg-crm-bg-hover border-l-4 border-l-crm-primary" : ""
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-bold text-crm-text-bright line-clamp-1">{tk.subject}</p>
                    <PriorityBadge priority={tk.priority} />
                  </div>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={tk.status} />
                    <span className="text-[10px] text-crm-text-dim">{format(new Date(tk.updatedAt), "MMM dd")}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center: Conversation */}
        <div className="flex-1 flex flex-col crm-card p-0 overflow-hidden relative">
          {!detail ? (
            <div className="flex-1 flex flex-col items-center justify-center text-crm-text-dim p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-crm-bg-hover flex items-center justify-center mb-4 text-crm-text-muted">
                <FiHelpCircle size={40} />
              </div>
              <h3 className="text-lg font-bold text-crm-text-bright mb-2">Help Desk</h3>
              <p className="max-w-xs text-sm">Select a ticket to view the conversation history and provide a resolution.</p>
            </div>
          ) : (
            <>
              {/* Ticket Header */}
              <div className="p-4 border-b border-crm-border flex items-center justify-between bg-crm-bg-alt/50 backdrop-blur-md sticky top-0 z-10">
                <div className="min-w-0">
                  <h4 className="font-bold text-crm-text-bright text-sm truncate">{detail.subject}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={detail.status} />
                    <span className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">#{detail.id?.slice(-8)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={detail.status} 
                    onChange={e => statusMutation.mutate({ id: detail.id, status: e.target.value })}
                    className="crm-input h-8 py-0 text-xs w-32"
                  >
                    {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                  </select>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-crm-bg/30">
                {(detail.messages || []).map((msg, idx) => {
                  const isMe = msg.senderType === 'admin';
                  return (
                    <motion.div
                      key={msg.id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[80%] ${isMe ? "order-1" : "order-2"}`}>
                        <div className={`p-4 rounded-2xl text-sm ${
                          isMe 
                            ? "bg-crm-primary text-white rounded-tr-none shadow-lg shadow-crm-primary/10" 
                            : "bg-crm-bg-card text-crm-text-bright rounded-tl-none border border-crm-border"
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                          {msg.attachments?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-white/10">
                              {msg.attachments.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20 text-[10px] font-bold hover:bg-black/30 transition-colors">
                                  <FiPaperclip size={10} /> File {i + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className={`mt-1 flex items-center gap-2 text-[10px] text-crm-text-dim px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                          <span className="font-bold">{isMe ? "Support Agent" : detail.customerName || "Customer"}</span>
                          <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Area */}
              <div className="p-4 border-t border-crm-border bg-crm-bg-alt/50">
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {pendingFiles.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-crm-primary-dim border border-crm-primary/30 text-[10px] text-crm-primary font-bold">
                        <FiPaperclip /> File {i + 1}
                        <button onClick={() => setPendingFiles(p => p.filter((_, j) => j !== i))} className="hover:text-crm-danger"><FiXCircle /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-3">
                  <button onClick={() => fileRef.current?.click()} className="p-2.5 rounded-xl bg-crm-bg-hover text-crm-text-dim hover:text-crm-primary transition-all">
                    <FiPaperclip size={20} />
                  </button>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
                  <div className="flex-1 relative">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Type your response..."
                      rows={1}
                      className="crm-input py-2.5 rounded-xl bg-crm-bg resize-none custom-scrollbar"
                      style={{ minHeight: '44px', maxHeight: '120px' }}
                    />
                  </div>
                  <button 
                    onClick={sendReply}
                    disabled={(!reply.trim() && !pendingFiles.length) || replyMutation.isPending}
                    className={`p-3 rounded-xl transition-all shadow-lg ${
                      reply.trim() ? "bg-crm-primary text-white scale-105" : "bg-crm-bg-hover text-crm-text-dim"
                    }`}
                  >
                    <FiSend size={20} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Meta Info */}
        <AnimatePresence>
          {detail && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-64 flex flex-col gap-4"
            >
              {/* Customer Info */}
              <div className="crm-card p-4 space-y-4">
                <h4 className="text-[10px] font-bold text-crm-text-dim uppercase tracking-widest border-b border-crm-border pb-2">Customer</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-crm-primary flex items-center justify-center text-white font-bold">
                    {detail.customerName?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-crm-text-bright truncate">{detail.customerName}</p>
                    <p className="text-[10px] text-crm-text-dim truncate">{detail.customerEmail}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-crm-text-muted uppercase font-bold tracking-wider">User ID</p>
                  <p className="text-xs font-mono text-crm-text-dim bg-crm-bg p-1.5 rounded border border-crm-border truncate">{detail.userId}</p>
                </div>
              </div>

              {/* References */}
              {(detail.orderId || detail.productId || detail.paymentTxId) && (
                <div className="crm-card p-4 space-y-4">
                  <h4 className="text-[10px] font-bold text-crm-text-dim uppercase tracking-widest border-b border-crm-border pb-2">References</h4>
                  <div className="space-y-3">
                    {detail.orderId && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-crm-text-dim"><FiShoppingCart /> Order</span>
                        <span className="font-mono text-crm-primary font-bold">#{detail.orderId.slice(-8).toUpperCase()}</span>
                      </div>
                    )}
                    {detail.productId && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-crm-text-dim"><FiBox /> Product</span>
                        <span className="font-mono text-crm-text-bright truncate max-w-[80px]">{detail.productId.slice(-8)}</span>
                      </div>
                    )}
                    {detail.paymentTxId && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-crm-text-dim"><FiCreditCard /> Transaction</span>
                        <span className="font-mono text-crm-text-bright truncate max-w-[80px]">{detail.paymentTxId.slice(-8)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="crm-card p-4 space-y-4">
                <h4 className="text-[10px] font-bold text-crm-text-dim uppercase tracking-widest border-b border-crm-border pb-2">Actions</h4>
                <div className="space-y-2">
                  <p className="text-[10px] text-crm-text-muted uppercase font-bold tracking-wider mb-2">Change Priority</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(PRIORITY_CFG).map(p => (
                      <button 
                        key={p} 
                        onClick={() => api.put(`/api/admin/tickets/${detail.id}`, { priority: p }).then(() => qc.invalidateQueries({ queryKey: ['admin-ticket', detail.id] }))}
                        className={`text-[10px] font-bold uppercase py-1.5 rounded border transition-all ${
                          detail.priority === p ? 'border-crm-primary bg-crm-primary text-white shadow-lg' : 'border-crm-border text-crm-text-dim hover:bg-crm-bg-hover'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="crm-btn w-full border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim text-xs py-2">
                  <FiActivity /> Audit Log
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
