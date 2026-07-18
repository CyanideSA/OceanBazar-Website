import React, { useRef } from "react";
import { api } from "../lib/api";
import { useToast } from "./ToastProvider";

export default function AdminProfileAvatar({ admin, onUpdated, size = "w-8 h-8", collapsed }) {
  const toast = useToast();
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/api/admin/governance/profile-image", form);
      onUpdated?.({ ...admin, profileImage: res.data?.profileImage ?? null });
      toast.success("Profile photo updated");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to upload profile photo");
    }
  };

  const remove = async (e) => {
    e.stopPropagation();
    try {
      await api.delete("/api/admin/governance/profile-image");
      onUpdated?.({ ...admin, profileImage: null });
      toast.success("Profile photo removed");
    } catch {
      toast.error("Failed to remove profile photo");
    }
  };

  const src = admin?.profileImage;

  return (
    <div className="relative group shrink-0">
      <button
        type="button"
        title="Change profile photo"
        onClick={() => fileRef.current?.click()}
        className={`${size} rounded-full overflow-hidden border-2 border-crm-border flex items-center justify-center bg-gradient-to-br from-crm-primary to-crm-purple text-white font-bold text-xs shadow-md`}
      >
        {src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          admin?.name?.charAt(0)?.toUpperCase() || "A"
        )}
      </button>
      {!collapsed && src && (
        <button type="button" onClick={remove}
          className="absolute -bottom-1 -right-1 text-[9px] bg-crm-danger text-white rounded px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          ✕
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
