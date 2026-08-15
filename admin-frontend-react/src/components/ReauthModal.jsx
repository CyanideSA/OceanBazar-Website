import React, { useState } from "react";
import { FiShield, FiLock, FiRefreshCw } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { setReauthToken } from "../lib/reauth";

export default function ReauthModal({ open, onClose, onSuccess }) {
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (otp.replace(/\D+/g, "").length !== 6) {
      setError("Enter a valid 6-digit authenticator code");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await adminApi.reauth({ otp, password: password || undefined });
      setReauthToken(res?.reauthToken, res?.expiresIn || 300);
      onSuccess?.(res?.reauthToken || "");
      onClose?.();
      setOtp("");
      setPassword("");
    } catch (err) {
      setError(err?.response?.data?.error || "Re-authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="crm-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-crm-primary-dim text-crm-primary"><FiShield /></div>
          <div>
            <h3 className="font-bold text-crm-text-bright">Step-up Verification Required</h3>
            <p className="text-xs text-crm-text-dim">Confirm with authenticator code to continue.</p>
          </div>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="text-xs text-crm-text-dim font-bold uppercase">Authenticator code</label>
            <input
              className="crm-input"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D+/g, "").slice(0, 6))}
              placeholder="123456"
              maxLength={6}
            />
          </div>
          <div>
            <label className="text-xs text-crm-text-dim font-bold uppercase">Password (optional)</label>
            <input
              type="password"
              className="crm-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Use if requested"
            />
          </div>
          {error ? <div className="text-xs text-crm-danger">{error}</div> : null}
          <div className="flex gap-2 pt-1">
            <button type="button" className="crm-btn flex-1" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="crm-btn crm-btn-primary flex-1" disabled={busy}>
              {busy ? <FiRefreshCw className="animate-spin" /> : <FiLock />} {busy ? "Verifying..." : "Verify"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

