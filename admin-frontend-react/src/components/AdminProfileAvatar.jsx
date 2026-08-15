import React, { useRef, useState } from "react";
import { FiCamera, FiTrash2 } from "react-icons/fi";
import { api } from "../lib/api";
import { useToast } from "./ToastProvider";

export default function AdminProfileAvatar({ admin, onUpdated, size = "w-8 h-8", collapsed }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const dbg = (hypothesisId, message, data) => {
    // #region agent log
    fetch("http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "1eb282" },
      body: JSON.stringify({
        sessionId: "1eb282",
        runId: "admin-avatar",
        hypothesisId,
        location: "AdminProfileAvatar.jsx",
        message,
        data: data || {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  };

  const upload = async (file) => {
    if (!file || busy) return;
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/api/admin/governance/profile-image", form);
      const next = { ...admin, profileImage: res.data?.profileImage ?? null };
      onUpdated?.(next);
      dbg("H-AVATAR-UP", "admin profile photo uploaded", { hasUrl: !!next.profileImage });
      toast.success("Profile photo updated");
    } catch (e) {
      dbg("H-AVATAR-UP", "admin profile photo upload failed", {
        status: e?.response?.status || null,
      });
      toast.error(e?.response?.data?.error || "Failed to upload profile photo");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await api.delete("/api/admin/governance/profile-image");
      onUpdated?.({ ...admin, profileImage: null });
      dbg("H-AVATAR-DEL", "admin profile photo removed", {});
      toast.success("Profile photo removed");
    } catch {
      toast.error("Failed to remove profile photo");
    } finally {
      setBusy(false);
    }
  };

  const src = admin?.profileImage;

  return (
    <div className="relative group shrink-0">
      <button
        type="button"
        title={src ? "Change profile photo" : "Set profile photo"}
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className={`${size} rounded-full overflow-hidden border-2 border-crm-border flex items-center justify-center bg-gradient-to-br from-crm-primary to-crm-purple text-white font-bold text-xs shadow-md disabled:opacity-60`}
      >
        {src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          admin?.name?.charAt(0)?.toUpperCase() || "A"
        )}
      </button>
      {!collapsed && (
        <span className="pointer-events-none absolute inset-0 rounded-full bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <FiCamera className="text-white" size={12} />
        </span>
      )}
      {src && (
        <button
          type="button"
          title="Remove profile photo"
          onClick={remove}
          disabled={busy}
          className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-crm-danger text-white shadow ${
            collapsed ? "h-4 w-4 opacity-90" : "h-5 w-5 opacity-0 group-hover:opacity-100"
          } transition-opacity`}
        >
          <FiTrash2 size={collapsed ? 8 : 10} />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
