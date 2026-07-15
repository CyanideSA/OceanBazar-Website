import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiShield, FiRefreshCw, FiSmartphone, FiClock, FiAlertTriangle } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { getAdminUser } from "../lib/auth";
import { useToast } from "../components/ToastProvider";

export default function SecurityCenterPage() {
  const toast = useToast();
  const admin = useMemo(() => getAdminUser(), []);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [revoking, setRevoking] = useState(false);
  const [profile, setProfile] = useState(null);

  const loadSessions = useCallback(async () => {
    if (!admin?.id) return;
    setLoading(true);
    try {
      const res = await adminApi.teamMemberSessions(admin.id);
      setSessions(Array.isArray(res?.sessions) ? res.sessions : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load session security data");
    } finally {
      setLoading(false);
    }
  }, [admin?.id, toast]);

  useEffect(() => {
    loadSessions();
    adminApi.me().then((r) => setProfile(r?.admin || r)).catch(() => {});
  }, [loadSessions]);

  const revokeAll = async () => {
    if (!admin?.id) return;
    setRevoking(true);
    try {
      const res = await adminApi.revokeTeamMemberSessions(admin.id);
      toast.success(`Revoked ${res?.revokedSessions ?? 0} active session(s)`);
      await loadSessions();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to revoke sessions");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="crm-card p-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-crm-text-bright flex items-center gap-2">
            <FiShield className="text-crm-primary" /> Security Center
          </h1>
          <p className="text-sm text-crm-text-dim mt-1">
            Monitor active devices and revoke session access for your admin account.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadSessions} className="crm-btn" disabled={loading}>
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={revokeAll} className="crm-btn crm-btn-danger" disabled={revoking}>
            <FiAlertTriangle /> {revoking ? "Revoking..." : "Revoke All Sessions"}
          </button>
        </div>
      </div>

      {profile && (
        <div className="crm-card p-5 grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-crm-text-dim uppercase font-bold">Sign-in method</p>
            <p className="text-crm-text-bright mt-1 capitalize">{profile.authProvider || "local"}</p>
          </div>
          <div>
            <p className="text-xs text-crm-text-dim uppercase font-bold">Microsoft 365 linked</p>
            <p className="text-crm-text-bright mt-1">{profile.microsoftLinked ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs text-crm-text-dim uppercase font-bold">Google linked</p>
            <p className="text-crm-text-bright mt-1">{profile.googleLinked ? "Yes" : "No"}</p>
          </div>
        </div>
      )}

      <div className="crm-card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-crm-border text-sm font-semibold text-crm-text-bright">
          Active Session Registry
        </div>
        <div className="divide-y divide-crm-border">
          {sessions.length === 0 && !loading ? (
            <div className="px-5 py-8 text-sm text-crm-text-dim">No sessions found.</div>
          ) : (
            sessions.map((s, idx) => (
              <div key={`${s.deviceId}-${idx}`} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-crm-text-bright flex items-center gap-2">
                    <FiSmartphone className="text-crm-primary" />
                    {s.deviceId}
                  </div>
                  <div className="text-xs text-crm-text-dim break-all">{s.userAgent || "Unknown user agent"}</div>
                  <div className="text-xs text-crm-text-muted">
                    IP: {s.ipAddress || "unknown"}
                  </div>
                </div>
                <div className="text-right text-xs text-crm-text-dim space-y-1 shrink-0">
                  <div className="flex items-center gap-1 justify-end">
                    <FiClock /> Last seen: {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : "n/a"}
                  </div>
                  <div>Created: {s.createdAt ? new Date(s.createdAt).toLocaleString() : "n/a"}</div>
                  <div className={s.revokedAt ? "text-crm-danger font-semibold" : "text-crm-success font-semibold"}>
                    {s.revokedAt ? `Revoked: ${new Date(s.revokedAt).toLocaleString()}` : "Active"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

