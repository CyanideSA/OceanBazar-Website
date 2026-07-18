import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiSearch, FiFilter, FiUserPlus, FiShield, FiMail,
  FiTrash2, FiEdit2, FiArrowRight, FiCheckCircle,
  FiXCircle, FiActivity, FiKey, FiLock, FiUnlock,
  FiRefreshCw, FiAlertTriangle, FiGrid, FiUsers, FiCheck, FiX,
  FiEye, FiEyeOff, FiSave, FiSliders
} from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { hasPermission } from "../auth/permissionMatrix";
import { useToast } from "../components/ToastProvider";
import TwoFaSetupDisplay from "../components/TwoFaSetupDisplay";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import useStepUpReauth from "../hooks/useStepUpReauth";

const ROLE_MAP = {
  SUPER_ADMIN: { label: "Super Admin", class: "border-crm-purple text-crm-purple bg-crm-purple-dim", color: "text-crm-purple" },
  ADMIN:       { label: "Admin",       class: "border-crm-primary text-crm-primary bg-crm-primary-dim", color: "text-crm-primary" },
  STAFF:       { label: "Staff",       class: "border-crm-border text-crm-text-dim bg-crm-bg", color: "text-crm-text-dim" },
};

const FILTER_TABS = [
  { key: "all",      label: "All Members" },
  { key: "active",   label: "Active" },
  { key: "inactive", label: "Inactive" },
];

const VIEW_TABS = [
  { key: "members",     label: "Team Members",       icon: FiUsers },
  { key: "permissions", label: "Permission Matrix",  icon: FiSliders },
];

const PERM_MODULES = [
  { key: "dashboard",    label: "Dashboard" },
  { key: "products",     label: "Products" },
  { key: "catalog",      label: "Catalog" },
  { key: "customers",    label: "Customers" },
  { key: "orders",       label: "Orders" },
  { key: "payments",     label: "Payments" },
  { key: "inventory",    label: "Inventory" },
  { key: "delivery",     label: "Delivery" },
  { key: "reviews",      label: "Reviews" },
  { key: "returns",      label: "Returns" },
  { key: "coupons",      label: "Coupons" },
  { key: "analytics",    label: "Analytics" },
  { key: "chat",         label: "Live Chat" },
  { key: "notifications",label: "Notifications" },
  { key: "disputes",     label: "Disputes" },
  { key: "audit",        label: "Audit Logs" },
  { key: "adminUsers",   label: "Team & Permissions" },
  { key: "applications", label: "Applications" },
  { key: "settings",     label: "Global Settings" },
  { key: "fileImport",   label: "File Import" },
  { key: "obPoints",     label: "OB Points" },
  { key: "tickets",      label: "Support Tickets" },
  { key: "integrations", label: "Integrations" },
  { key: "customerTimeline", label: "Customer Timeline" },
  { key: "meta",         label: "Meta Suite" },
];

function InviteMemberModal({ onClose, onCreated, myRole }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", role: "staff" });
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [dirLoading, setDirLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const loadDirectory = async () => {
    setDirLoading(true);
    try {
      const res = await adminApi.microsoftDirectory();
      setDirectory(res.users || []);
      if (!res.users?.length) toast.error("No directory users — check Graph User.Read.All permission");
    } catch {
      toast.error("M365 directory not available");
    } finally {
      setDirLoading(false);
    }
  };

  const pickDirectoryUser = (u) => {
    const email = u.mail || u.userPrincipalName || "";
    const username = email.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "") || "";
    setForm((p) => ({
      ...p,
      name: u.displayName || p.name,
      email,
      username: username || p.username,
    }));
    toast.success(`Prefilled from ${u.displayName}`);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.username || !form.email || !form.password) { toast.error("All fields are required"); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      await adminApi.addMember({ name: form.name, username: form.username, email: form.email, password: form.password, role: form.role });
      toast.success(`${form.name} has been invited`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to create member");
    } finally { setSaving(false); }
  }

  const availableRoles = myRole === "SUPER_ADMIN"
    ? [["staff","Staff"],["admin","Admin"],["super_admin","Super Admin"]]
    : [["staff","Staff"],["admin","Admin"]];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.96 }}
        className="bg-crm-bg-alt border border-crm-border rounded-2xl w-full max-w-md shadow-2xl p-8 space-y-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary"><FiUserPlus size={20} /></div>
          <div><h3 className="text-lg font-bold text-crm-text-bright">Invite Team Member</h3>
          <p className="text-xs text-crm-text-dim">New member will receive login credentials</p></div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-crm-border bg-crm-bg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-crm-text-dim uppercase">Import from Microsoft 365</span>
              <button type="button" className="crm-btn crm-btn-secondary text-xs h-8" onClick={loadDirectory} disabled={dirLoading}>
                {dirLoading ? <FiRefreshCw className="animate-spin" /> : <FiUsers />} Load directory
              </button>
            </div>
            {directory.length > 0 && (
              <div className="max-h-28 overflow-y-auto text-xs space-y-1">
                {directory.slice(0, 8).map((u) => (
                  <button key={u.id} type="button" className="w-full text-left px-2 py-1 rounded hover:bg-crm-bg-alt flex justify-between"
                    onClick={() => pickDirectoryUser(u)}>
                    <span>{u.displayName}</span>
                    <span className="text-crm-text-muted truncate ml-2">{u.mail || u.userPrincipalName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs font-bold text-crm-text-dim uppercase">Full Name</label>
              <input className="crm-input" placeholder="Jane Doe" value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div className="space-y-1"><label className="text-xs font-bold text-crm-text-dim uppercase">Username</label>
              <input className="crm-input" placeholder="janedoe" value={form.username} onChange={e => set("username", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><label className="text-xs font-bold text-crm-text-dim uppercase">Email</label>
            <input className="crm-input" type="email" placeholder="jane@oceanbazar.com.bd" value={form.email} onChange={e => set("email", e.target.value)} />
            <p className="text-[11px] text-crm-text-muted">Must match their Microsoft 365 sign-in email so SSO can link on first login.</p>
          </div>
          <div className="space-y-1"><label className="text-xs font-bold text-crm-text-dim uppercase">Initial Password</label>
            <div className="relative">
              <input className="crm-input pr-10" type={showPw ? "text" : "password"} placeholder="Min 6 characters" value={form.password} onChange={e => set("password", e.target.value)} />
              <button type="button" onClick={() => setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-text-muted">
                {showPw ? <FiEyeOff size={14}/> : <FiEye size={14}/>}
              </button>
            </div>
          </div>
          <div className="space-y-1"><label className="text-xs font-bold text-crm-text-dim uppercase">Role</label>
            <select className="crm-input" value={form.role} onChange={e => set("role", e.target.value)}>
              {availableRoles.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="crm-btn flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="crm-btn crm-btn-primary flex-1">
              {saving ? <FiRefreshCw className="animate-spin"/> : <FiUserPlus/>} {saving ? "Inviting…" : "Invite Member"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function EditMemberModal({ member, onClose, onSaved, myRole, myId }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: member.name || "", email: member.email || "", role: member.role?.toLowerCase() || "staff", active: member.active ?? true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isSuper = myRole === "SUPER_ADMIN";
  const isSelf = String(member.id) === String(myId);

  const availableRoles = isSuper
    ? [["staff","Staff"],["admin","Admin"],["super_admin","Super Admin"]]
    : [["staff","Staff"],["admin","Admin"]];

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateMember(member.id, { name: form.name, email: form.email, role: form.role, active: form.active });
      toast.success("Member updated successfully");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to update member");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.96 }}
        className="bg-crm-bg-alt border border-crm-border rounded-2xl w-full max-w-md shadow-2xl p-8 space-y-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-warning/20 text-crm-warning"><FiEdit2 size={20}/></div>
          <div><h3 className="text-lg font-bold text-crm-text-bright">Edit Member</h3>
          <p className="text-xs text-crm-text-dim font-mono">{member.username || member.email}</p></div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1"><label className="text-xs font-bold text-crm-text-dim uppercase">Full Name</label>
            <input className="crm-input" value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="space-y-1"><label className="text-xs font-bold text-crm-text-dim uppercase">Email</label>
            <input className="crm-input" type="email" value={form.email} onChange={e => set("email", e.target.value)} />
            <p className="text-[11px] text-crm-text-muted">Must match their Microsoft 365 sign-in email for SSO linking.</p>
          </div>
          <div className="space-y-1"><label className="text-xs font-bold text-crm-text-dim uppercase">Role</label>
            <select className="crm-input" value={form.role} onChange={e => set("role", e.target.value)} disabled={isSelf}>
              {availableRoles.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {isSelf && <p className="text-xs text-crm-text-muted mt-1">Cannot change your own role</p>}
          </div>
          {!isSelf && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-crm-bg border border-crm-border">
              <div><p className="text-sm font-bold text-crm-text-bright">Account Active</p>
              <p className="text-xs text-crm-text-dim">Inactive accounts cannot log in</p></div>
              <button type="button" onClick={() => set("active", !form.active)}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${form.active ? "bg-crm-success" : "bg-crm-bg-hover"}`}>
                <span className={`inline-block h-5 w-5 mt-0.5 ml-0.5 transform rounded-full bg-white shadow transition-transform ${form.active ? "translate-x-5" : "translate-x-0"}`}/>
              </button>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="crm-btn flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="crm-btn crm-btn-primary flex-1">
              {saving ? <FiRefreshCw className="animate-spin"/> : <FiSave/>} {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ResetPasswordModal({ member, onClose, requestToken }) {
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (pw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const reauthToken = await requestToken();
      await adminApi.resetMemberPassword(member.id, { password: pw }, reauthToken);
      toast.success("Password reset successfully");
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to reset password");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.96 }}
        className="bg-crm-bg-alt border border-crm-border rounded-2xl w-full max-w-sm shadow-2xl p-8 space-y-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-warning/20 text-crm-warning"><FiLock size={20}/></div>
          <div><h3 className="text-lg font-bold text-crm-text-bright">Reset Password</h3>
          <p className="text-xs text-crm-text-dim">For: {member.name}</p></div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1"><label className="text-xs font-bold text-crm-text-dim uppercase">New Password</label>
            <div className="relative">
              <input className="crm-input pr-10" type={showPw ? "text" : "password"} value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 6 characters" />
              <button type="button" onClick={() => setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-text-muted">
                {showPw ? <FiEyeOff size={14}/> : <FiEye size={14}/>}
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="crm-btn flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="crm-btn crm-btn-primary flex-1">
              {saving ? <FiRefreshCw className="animate-spin"/> : <FiLock/>} {saving ? "Resetting…" : "Reset Password"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function DeactivateConfirmModal({ member, onClose, onDeactivated, requestToken }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      const reauthToken = await requestToken();
      await adminApi.deleteMember(member.id, reauthToken);
      toast.success(`${member.name}'s account has been deactivated`);
      onDeactivated();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to deactivate account");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.96 }}
        className="bg-crm-bg-alt border border-crm-border rounded-2xl w-full max-w-sm shadow-2xl p-8 space-y-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-danger-dim text-crm-danger"><FiAlertTriangle size={20}/></div>
          <div><h3 className="text-lg font-bold text-crm-text-bright">Deactivate Account</h3>
          <p className="text-xs text-crm-text-dim">This will prevent login immediately</p></div>
        </div>
        <p className="text-sm text-crm-text-dim">
          Are you sure you want to deactivate <span className="font-bold text-crm-text-bright">{member.name}</span>?
          Their data is preserved and this can be undone by editing the member.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="crm-btn flex-1">Cancel</button>
          <button onClick={handleConfirm} disabled={saving}
            className="crm-btn flex-1 border-crm-danger/40 text-crm-danger hover:bg-crm-danger-dim">
            {saving ? <FiRefreshCw className="animate-spin"/> : <FiTrash2/>} {saving ? "Deactivating…" : "Confirm Deactivate"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PermissionMatrixView() {
  const ROLES = ["SUPER_ADMIN", "ADMIN", "STAFF"];
  const ROLE_LABELS = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", STAFF: "Staff" };

  const PERMS = {
    dashboard:    { view: ["SUPER_ADMIN","ADMIN","STAFF"] },
    products:     { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN"], delete: ["SUPER_ADMIN","ADMIN"] },
    catalog:      { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN"], delete: ["SUPER_ADMIN","ADMIN"] },
    customers:    { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN"], delete: ["SUPER_ADMIN","ADMIN"] },
    orders:       { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN","STAFF"] },
    payments:     { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN"] },
    inventory:    { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN"] },
    delivery:     { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN","STAFF"], delete: ["SUPER_ADMIN","ADMIN"] },
    reviews:      { view: ["SUPER_ADMIN","ADMIN","STAFF"], moderate: ["SUPER_ADMIN","ADMIN","STAFF"] },
    returns:      { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN"], refund: ["SUPER_ADMIN","ADMIN"] },
    coupons:      { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN"] },
    analytics:    { view: ["SUPER_ADMIN","ADMIN","STAFF"] },
    chat:         { view: ["SUPER_ADMIN","ADMIN","STAFF"], reply: ["SUPER_ADMIN","ADMIN","STAFF"] },
    notifications:{ view: ["SUPER_ADMIN","ADMIN","STAFF"], send: ["SUPER_ADMIN","ADMIN"] },
    disputes:     { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN","STAFF"] },
    audit:        { view: ["SUPER_ADMIN","ADMIN"] },
    adminUsers:   { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN"], delete: ["SUPER_ADMIN"] },
    applications: { view: ["SUPER_ADMIN","ADMIN"], edit: ["SUPER_ADMIN","ADMIN"] },
    settings:     { view: ["SUPER_ADMIN","ADMIN"], edit: ["SUPER_ADMIN","ADMIN"] },
    fileImport:   { view: ["SUPER_ADMIN","ADMIN"], edit: ["SUPER_ADMIN","ADMIN"] },
    obPoints:     { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN"] },
    tickets:      { view: ["SUPER_ADMIN","ADMIN","STAFF"], edit: ["SUPER_ADMIN","ADMIN","STAFF"], reply: ["SUPER_ADMIN","ADMIN","STAFF"] },
  };

  const Cell = ({ has }) => (
    <div className="flex items-center justify-center">
      {has
        ? <span className="w-5 h-5 rounded-full bg-crm-success flex items-center justify-center"><FiCheck size={11} className="text-white"/></span>
        : <span className="w-5 h-5 rounded-full bg-crm-bg-hover flex items-center justify-center"><FiX size={11} className="text-crm-text-muted"/></span>
      }
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="crm-card">
        <div className="flex items-center gap-3 mb-4">
          <FiSliders className="text-crm-primary" size={18}/>
          <div>
            <h3 className="font-bold text-crm-text-bright">Role Permission Matrix</h3>
            <p className="text-xs text-crm-text-dim">Read-only view of what each role can access. Change a member's role to adjust their access.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-crm-border">
                <th className="text-left py-2 pr-4 font-bold text-crm-text-dim uppercase tracking-wider w-40">Module</th>
                <th className="text-left py-2 pr-4 font-bold text-crm-text-dim uppercase tracking-wider w-24">Action</th>
                {ROLES.map(r => (
                  <th key={r} className="py-2 px-3 text-center">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border inline-block ${ROLE_MAP[r]?.class}`}>
                      {ROLE_LABELS[r]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-crm-border/50">
              {PERM_MODULES.map(mod => {
                const actions = Object.entries(PERMS[mod.key] || {});
                return actions.map(([action, allowed], ai) => (
                  <tr key={`${mod.key}-${action}`} className="hover:bg-crm-bg-hover/40 transition-colors">
                    <td className="py-2 pr-4 text-crm-text-bright font-medium">{ai === 0 ? mod.label : ""}</td>
                    <td className="py-2 pr-4 text-crm-text-muted capitalize">{action}</td>
                    {ROLES.map(r => <td key={r} className="py-2 px-3"><Cell has={allowed.includes(r)}/></td>)}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TwoFactorPanel() {
  const toast = useToast();
  const [status, setStatus] = useState({ enabled: false, loading: true });
  const [setup, setSetup] = useState(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const r = await adminApi.twoFaStatus();
      setStatus({ enabled: !!r?.enabled, loading: false });
    } catch {
      setStatus({ enabled: false, loading: false });
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  async function startSetup() {
    setBusy(true);
    try {
      const r = await adminApi.twoFaSetup();
      setSetup(r);
      setOtp("");
    } catch {
      toast.error("Failed to start 2FA setup");
    } finally {
      setBusy(false);
    }
  }

  async function enable2fa() {
    if (!setup?.setupToken || otp.length !== 6) return;
    setBusy(true);
    try {
      await adminApi.twoFaEnable({ setupToken: setup.setupToken, otp });
      toast.success("2FA enabled successfully");
      setSetup(null);
      setOtp("");
      loadStatus();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to enable 2FA");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-crm-text-bright">Admin 2FA (TOTP)</h3>
          <p className="text-xs text-crm-text-dim">Protect your admin account with authenticator-based verification.</p>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${status.enabled ? "border-crm-success/40 text-crm-success" : "border-crm-border text-crm-text-dim"}`}>
          {status.loading ? "Checking..." : status.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {!status.enabled && !setup && (
        <div className="mt-4">
          <button onClick={startSetup} disabled={busy} className="crm-btn crm-btn-primary">
            {busy ? <FiRefreshCw className="animate-spin" /> : <FiShield />} Start 2FA Setup
          </button>
        </div>
      )}

      {setup && (
        <div className="mt-4 rounded-lg border border-crm-border bg-crm-bg p-3">
          <TwoFaSetupDisplay secret={setup.secret} otpauthUrl={setup.otpauthUrl}>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D+/g, "").slice(0, 6))}
              className="crm-input"
              placeholder="Enter 6-digit code"
              maxLength={6}
            />
            <div className="flex gap-2">
              <button onClick={enable2fa} disabled={busy || otp.length !== 6} className="crm-btn crm-btn-primary">
                {busy ? <FiRefreshCw className="animate-spin" /> : <FiCheck />} Enable 2FA
              </button>
              <button onClick={() => { setSetup(null); setOtp(""); }} className="crm-btn">Cancel</button>
            </div>
          </TwoFaSetupDisplay>
        </div>
      )}

      {status.enabled && !setup && (
        <div className="mt-4 rounded-lg border border-crm-success/30 bg-crm-success/10 p-3">
          <p className="text-xs text-crm-success font-semibold">
            2FA is enabled and mandatory for all CRM accounts.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage({ liveTick = 0 }) {
  const { requestToken, modal: reauthModal } = useStepUpReauth();
  const myRole = useMemo(() => String(getAdminUser()?.role || "STAFF").toUpperCase(), []);
  const myId   = useMemo(() => getAdminUser()?.id || "", []);
  const toast  = useToast();

  const canEdit   = hasPermission(myRole, "adminUsers", "edit");
  const canDelete = hasPermission(myRole, "adminUsers", "delete");

  const [viewTab,       setViewTab]       = useState("members");
  const [items,         setItems]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [detailId,      setDetailId]      = useState(null);
  const [detail,        setDetail]        = useState(null);
  const [showInvite,    setShowInvite]    = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);
  const [resetTarget,   setResetTarget]   = useState(null);
  const [deactivTarget, setDeactivTarget] = useState(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.teamMembers();
      const list = Array.isArray(res) ? res : res?.members || res?.items || [];
      setItems(list);    } catch (err) {
      toast.error("Failed to fetch team members");
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchMembers(); }, [fetchMembers, liveTick]);

  const filteredMembers = useMemo(() => items.filter(m => {
    const ok = statusFilter === "all" || (statusFilter === "active" ? m.active : !m.active);
    return ok && (!search || `${m.name} ${m.email} ${m.username} ${m.role}`.toLowerCase().includes(search.toLowerCase()));
  }), [items, statusFilter, search]);

  const openDetail  = (id) => { const m = items.find(x => x.id === id); setDetailId(id); setDetail(m); };
  const closeDetail = ()   => { setDetailId(null); setDetail(null); };
  const afterSave   = ()   => { fetchMembers(); closeDetail(); };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-purple-dim text-crm-purple"><FiShield size={24}/></div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright tracking-tight">Team & Permissions</h2>
            <p className="text-crm-text-dim text-sm">Manage administrative access, roles and credentials</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMembers} className="crm-btn"><FiRefreshCw size={13}/> Refresh</button>
          {canEdit && (
            <button onClick={() => setShowInvite(true)} className="crm-btn crm-btn-primary">
              <FiUserPlus/> Invite Member
            </button>
          )}
        </div>
      </div>

      <TwoFactorPanel />

      {/* ── View tabs ── */}
      <div className="crm-card p-0 overflow-hidden border-b-0 rounded-b-none flex flex-wrap">
        {VIEW_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setViewTab(key)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all font-medium text-sm ${
              viewTab === key ? "border-crm-primary text-crm-primary bg-crm-primary-dim"
                : "border-transparent text-crm-text-dim hover:text-crm-text-bright hover:bg-crm-bg-hover"}`}>
            <Icon size={13}/>{label}
          </button>
        ))}
      </div>

      {viewTab === "permissions" ? (
        <div className="crm-card rounded-t-none border-t-0 p-0"><PermissionMatrixView/></div>
      ) : (
        <>
          {/* ── Filters ── */}
          <div className="crm-card rounded-t-none border-t-0 flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {FILTER_TABS.map(t => (
                <button key={t.key} onClick={() => setStatusFilter(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    statusFilter === t.key ? "bg-crm-primary text-white" : "text-crm-text-dim hover:bg-crm-bg-hover"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-crm-text-muted" size={13}/>
              <input className="crm-input pl-9 text-sm" placeholder="Search name, email, role…"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <span className="text-xs text-crm-text-muted">{filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}</span>
          </div>

          {/* ── Member grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full p-20 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crm-primary"/>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="col-span-full crm-card p-12 text-center text-crm-text-dim">No team members found</div>
            ) : filteredMembers.map(m => (
              <div key={m.id} className="crm-card group space-y-4 cursor-pointer hover:border-crm-primary/40 transition-colors"
                onClick={() => openDetail(m.id)}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg border ${ROLE_MAP[m.role?.toUpperCase()]?.class || ROLE_MAP.STAFF.class}`}>
                      {m.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-crm-text-bright group-hover:text-crm-primary transition-colors text-sm">{m.name}</h4>
                      <p className="text-[10px] text-crm-text-muted font-mono">{m.username || "—"}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 mt-1 rounded-full ${m.active ? "bg-crm-success" : "bg-crm-danger"}`}/>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-crm-text-dim">
                    <FiMail size={11} className="shrink-0"/><span className="truncate">{m.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${ROLE_MAP[m.role?.toUpperCase()]?.class || ROLE_MAP.STAFF.class}`}>
                      {ROLE_MAP[m.role?.toUpperCase()]?.label || "Staff"}
                    </span>
                    {!m.active && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-crm-danger/40 text-crm-danger">Inactive</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-1"
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditTarget(m)} className="crm-btn text-xs py-1 flex-1 flex items-center justify-center gap-1">
                      <FiEdit2 size={11}/> Edit Role
                    </button>
                    <button onClick={() => setResetTarget(m)} className="crm-btn text-xs py-1 flex-1 flex items-center justify-center gap-1">
                      <FiLock size={11}/> Reset PW
                    </button>
                    {canDelete && String(m.id) !== String(myId) && (
                      <button onClick={() => setDeactivTarget(m)}
                        className="crm-btn text-xs py-1 px-2.5 border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex items-center justify-center">
                        <FiTrash2 size={11}/>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Detail side panel ── */}
      <AnimatePresence>
        {detailId && detail && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={closeDetail}/>
            <motion.div initial={{ x:"100%" }} animate={{ x:0 }} exit={{ x:"100%" }}
              transition={{ type:"spring", damping:30, stiffness:300 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-crm-bg-alt border-l border-crm-border z-50 overflow-y-auto custom-scrollbar">
              <div className="p-8 space-y-7">
                {/* Panel header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl border ${ROLE_MAP[detail.role?.toUpperCase()]?.class || ROLE_MAP.STAFF.class}`}>
                      {detail.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-crm-text-bright">{detail.name}</h3>
                      <p className="text-[10px] text-crm-text-dim font-mono">ID #{detail.id}</p>
                    </div>
                  </div>
                  <button onClick={closeDetail} className="p-2 hover:bg-crm-bg-hover rounded-full text-crm-text-dim">
                    <FiArrowRight className="rotate-180" size={22}/>
                  </button>
                </div>

                {/* Status badges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-crm-bg border border-crm-border text-center">
                    <p className="text-[9px] text-crm-text-dim uppercase font-bold tracking-wider mb-1.5">Status</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${detail.active ? "bg-crm-success" : "bg-crm-danger"}`}/>
                      <span className="text-sm font-bold text-crm-text-bright">{detail.active ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-crm-bg border border-crm-border text-center">
                    <p className="text-[9px] text-crm-text-dim uppercase font-bold tracking-wider mb-1.5">Role</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border inline-block ${ROLE_MAP[detail.role?.toUpperCase()]?.class || ROLE_MAP.STAFF.class}`}>
                      {ROLE_MAP[detail.role?.toUpperCase()]?.label || "Staff"}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">Account Info</p>
                  {[
                    ["Full Name",  detail.name],
                    ["Username",   detail.username || "—"],
                    ["Email",      detail.email],
                    ["Member ID",  `#${detail.id}`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-crm-text-dim">{label}</span>
                      <span className="text-crm-text-bright font-medium">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Permission summary for this role */}
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-crm-text-bright uppercase tracking-widest border-b border-crm-border pb-2">
                    Role Access Summary
                  </p>
                  <p className="text-xs text-crm-text-dim">
                    As <span className={`font-bold ${ROLE_MAP[detail.role?.toUpperCase()]?.color || "text-crm-text-dim"}`}>{ROLE_MAP[detail.role?.toUpperCase()]?.label || "Staff"}</span>, this member can:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {detail.role?.toUpperCase() === "SUPER_ADMIN" && <span className="text-crm-success flex items-center gap-1"><FiCheck size={11}/>Full system access</span>}
                    {detail.role?.toUpperCase() !== "SUPER_ADMIN" && <>
                      <span className={`flex items-center gap-1 ${detail.role?.toUpperCase() === "ADMIN" ? "text-crm-success" : "text-crm-text-muted"}`}><FiCheck size={11}/>Manage products</span>
                      <span className={`flex items-center gap-1 ${detail.role?.toUpperCase() === "ADMIN" ? "text-crm-success" : "text-crm-text-muted"}`}><FiCheck size={11}/>Edit orders</span>
                      <span className="text-crm-success flex items-center gap-1"><FiCheck size={11}/>View analytics</span>
                      <span className={`flex items-center gap-1 ${detail.role?.toUpperCase() === "ADMIN" ? "text-crm-success" : "text-crm-danger"}`}>
                        {detail.role?.toUpperCase() === "ADMIN" ? <FiCheck size={11}/> : <FiX size={11}/>}
                        {detail.role?.toUpperCase() === "ADMIN" ? "Access settings" : "No settings"}
                      </span>
                    </>}
                  </div>
                  <p className="text-[10px] text-crm-text-muted">See the Permission Matrix tab for full breakdown.</p>
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="space-y-2 pt-2 border-t border-crm-border">
                    <p className="text-[10px] font-black text-crm-text-bright uppercase tracking-widest mb-3">Actions</p>
                    <button onClick={() => setEditTarget(detail)}
                      className="crm-btn crm-btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                      <FiEdit2 size={14}/> Edit Role & Status
                    </button>
                    <button onClick={() => setResetTarget(detail)}
                      className="crm-btn w-full py-2.5 flex items-center justify-center gap-2">
                      <FiLock size={14}/> Reset Password
                    </button>
                    {canDelete && String(detail.id) !== String(myId) && (
                      <button onClick={() => setDeactivTarget(detail)}
                        className="crm-btn w-full py-2.5 border-crm-danger/30 text-crm-danger hover:bg-crm-danger-dim flex items-center justify-center gap-2">
                        <FiTrash2 size={14}/> {detail.active ? "Deactivate Account" : "Remove Account"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showInvite    && <InviteMemberModal    myRole={myRole} onClose={() => setShowInvite(false)}    onCreated={fetchMembers}/>}
        {editTarget    && <EditMemberModal      member={editTarget}    myRole={myRole} myId={myId} onClose={() => setEditTarget(null)}    onSaved={afterSave}/>}
        {resetTarget   && <ResetPasswordModal   member={resetTarget} requestToken={requestToken} onClose={() => setResetTarget(null)}/>}
        {deactivTarget && <DeactivateConfirmModal member={deactivTarget} requestToken={requestToken} onClose={() => setDeactivTarget(null)} onDeactivated={afterSave}/>}
      </AnimatePresence>
      {reauthModal}
    </div>
  );
}
