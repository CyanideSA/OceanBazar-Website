import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
  FiSearch, FiFilter, FiUserPlus, FiShield, FiMail, FiClock, 
  FiTrash2, FiEdit2, FiMoreVertical, FiArrowRight, FiCheckCircle, 
  FiXCircle, FiActivity, FiKey
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { hasPermission } from "../auth/permissionMatrix";
import { useToast } from "../components/ToastProvider";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const ROLE_MAP = {
  SUPER_ADMIN: { label: "Super Admin", class: "border-crm-purple text-crm-purple bg-crm-purple-dim" },
  ADMIN: { label: "Admin", class: "border-crm-primary text-crm-primary bg-crm-primary-dim" },
  STAFF: { label: "Staff", class: "border-crm-border text-crm-text-dim" },
};

const FILTER_TABS = [
  { key: "all", label: "All Members" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

export default function AdminUsersPage({ liveTick = 0 }) {
  const myRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const myId = useMemo(() => getAdminUser()?.id || "", []);
  const toast = useToast();

  const isSuper = myRole === "SUPER_ADMIN";
  const canEdit = hasPermission(myRole, "adminUsers", "edit");
  const canDelete = hasPermission(myRole, "adminUsers", "delete");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.teamMembers();
      setItems(Array.isArray(res) ? res : res?.members || res?.items || []);
    } catch (err) {
      toast.error("Failed to fetch team members");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers, liveTick]);

  const filteredMembers = useMemo(() => {
    return items.filter(m => {
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? m.active : !m.active);
      const matchesSearch = !search || 
        `${m.name} ${m.email} ${m.username}`.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [items, statusFilter, search]);

  const openDetail = (id) => {
    setDetailId(id);
    setDetail(items.find(m => m.id === id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-purple-dim text-crm-purple">
            <FiShield size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Team & Permissions</h2>
            <p className="text-crm-text-dim text-sm">Manage internal administrative access and roles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button className="crm-btn crm-btn-primary">
              <FiUserPlus /> Invite Member
            </button>
          )}
        </div>
      </div>

      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-6 py-3 border-b-2 transition-all font-medium text-sm ${
              statusFilter === tab.key 
                ? "border-crm-primary text-crm-primary bg-crm-primary-dim" 
                : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="crm-card flex flex-wrap items-center gap-4 rounded-t-none border-t-0">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" />
          <input 
            type="text" 
            placeholder="Search by name, email, role..." 
            className="crm-input pl-10" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="crm-btn" onClick={fetchMembers}>
          <FiFilter /> Refresh List
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"></div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="col-span-full crm-card p-12 text-center text-crm-text-dim">
            No team members found
          </div>
        ) : (
          filteredMembers.map((m) => (
            <div 
              key={m.id} 
              onClick={() => openDetail(m.id)}
              className="crm-card-interactive group space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-crm-bg-hover flex items-center justify-center text-crm-primary font-bold text-lg">
                    {m.name?.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-crm-text-bright group-hover:text-crm-primary transition-colors">{m.name}</h4>
                    <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider">{m.username || "No Username"}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${m.active ? "bg-crm-success" : "bg-crm-danger"}`} title={m.active ? "Active" : "Inactive"} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-crm-text-dim">
                  <FiMail className="shrink-0" />
                  <span className="truncate">{m.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-crm-text-dim">
                  <FiKey className="shrink-0" />
                  <span>{m.accountType === "support" ? "Support Access" : "Full Admin Access"}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${ROLE_MAP[m.role]?.class || ROLE_MAP.STAFF.class}`}>
                  {ROLE_MAP[m.role]?.label || "Staff"}
                </span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canEdit && <FiEdit2 className="text-crm-text-dim hover:text-crm-primary cursor-pointer" />}
                  {canDelete && m.id !== myId && <FiTrash2 className="text-crm-text-dim hover:text-crm-danger cursor-pointer" />}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Side Panel */}
      <AnimatePresence>
        {detailId && detail && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setDetailId(null)}
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-crm-bg-alt border-l border-crm-border z-50 overflow-y-auto custom-scrollbar"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-crm-bg-hover text-crm-primary">
                      <FiShield size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-crm-text-bright">Member Profile</h3>
                      <p className="text-[10px] text-crm-text-dim font-mono uppercase tracking-wider">#{detail.id?.slice(-8).toUpperCase()}</p>
                    </div>
                  </div>
                  <button onClick={() => setDetailId(null)} className="p-2 hover:bg-crm-bg-hover rounded-full text-crm-text-dim">
                    <FiArrowRight className="rotate-180" size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="crm-card bg-crm-bg border-none text-center">
                    <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Account Status</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${detail.active ? "bg-crm-success" : "bg-crm-danger"}`} />
                      <span className="text-sm font-bold text-crm-text-bright">{detail.active ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                  <div className="crm-card bg-crm-bg border-none text-center">
                    <p className="text-[10px] text-crm-text-dim uppercase font-bold tracking-wider mb-2">Current Role</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border inline-block ${ROLE_MAP[detail.role]?.class || ROLE_MAP.STAFF.class}`}>
                      {ROLE_MAP[detail.role]?.label || "Staff"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest border-b border-crm-border pb-2">Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Full Name</span>
                      <span className="text-crm-text-bright font-bold">{detail.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Username</span>
                      <span className="text-crm-text-bright font-mono">{detail.username || "N/A"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Email</span>
                      <span className="text-crm-text-bright">{detail.email}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">Account Type</span>
                      <span className="text-crm-text-bright capitalize">{detail.accountType}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-crm-border space-y-4">
                  <h4 className="text-xs font-bold text-crm-text-muted uppercase tracking-widest flex items-center gap-2">
                    <FiActivity /> Recent Activity
                  </h4>
                  <div className="p-4 rounded-lg bg-crm-bg border border-crm-border text-center">
                    <p className="text-xs text-crm-text-dim italic">WebSocket connection active for real-time audit logs.</p>
                  </div>
                </div>

                <div className="pt-8 border-t border-crm-border space-y-3">
                  {canEdit && (
                    <button className="crm-btn crm-btn-primary w-full py-2.5">
                      <FiEdit2 /> Update Permissions
                    </button>
                  )}
                  {canDelete && detail.id !== myId && (
                    <button className="crm-btn w-full border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim py-2.5">
                      <FiTrash2 /> Deactivate Account
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
