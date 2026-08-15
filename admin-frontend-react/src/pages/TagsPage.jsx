import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiTrash2, FiEdit2, FiTag, FiRefreshCw } from "react-icons/fi";
import { adminApi } from "../lib/api";
import { useToast } from "../components/ToastProvider";

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function TagsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [groupForm, setGroupForm] = useState({ nameEn: "", nameBn: "" });
  const [tagForm, setTagForm] = useState({ nameEn: "", nameBn: "", groupId: "" });
  const [editingTag, setEditingTag] = useState(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await adminApi.tagGroups();
      const next = Array.isArray(res?.groups) ? res.groups : Array.isArray(res) ? res : [];
      setGroups(next.filter(Boolean));
    } catch (err) {
      setLoadError(err?.response?.data?.error || err?.message || "Failed to load tags");
      toast.error("Failed to load tags");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await adminApi.tagGroups();
        if (!alive) return;
        const next = Array.isArray(res?.groups) ? res.groups : Array.isArray(res) ? res : [];
        setGroups(next.filter(Boolean));
      } catch (err) {
        if (!alive) return;
        setLoadError(err?.response?.data?.error || err?.message || "Failed to load tags");
        setGroups([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const allTags = useMemo(
    () => (Array.isArray(groups) ? groups : []).flatMap((g) => (Array.isArray(g?.tags) ? g.tags : []).map((t) => ({ ...t, groupName: g?.nameEn || "" }))),
    [groups],
  );

  const createGroup = async () => {
    if (!groupForm.nameEn.trim()) return toast.error("Group name required");
    setBusy(true);
    try {
      await adminApi.createTagGroup({
        nameEn: groupForm.nameEn.trim(),
        nameBn: groupForm.nameBn.trim() || groupForm.nameEn.trim(),
        slug: slugify(groupForm.nameEn),
      });
      setGroupForm({ nameEn: "", nameBn: "" });
      toast.success("Tag group created");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Create group failed");
    } finally {
      setBusy(false);
    }
  };

  const createTag = async () => {
    if (!tagForm.nameEn.trim()) return toast.error("Tag name required");
    setBusy(true);
    try {
      await adminApi.createTag({
        nameEn: tagForm.nameEn.trim(),
        nameBn: tagForm.nameBn.trim() || tagForm.nameEn.trim(),
        slug: slugify(tagForm.nameEn),
        groupId: tagForm.groupId || null,
      });
      setTagForm({ nameEn: "", nameBn: "", groupId: tagForm.groupId });
      toast.success("Tag created — assign it to any products");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Create tag failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editingTag?.id) return;
    setBusy(true);
    try {
      await adminApi.updateTag(editingTag.id, {
        nameEn: editingTag.nameEn,
        nameBn: editingTag.nameBn || editingTag.nameEn,
        slug: editingTag.slug || slugify(editingTag.nameEn),
        groupId: editingTag.groupId || null,
      });
      setEditingTag(null);
      toast.success("Tag updated");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const removeTag = async (id) => {
    if (!window.confirm("Delete this tag from all products?")) return;
    setBusy(true);
    try {
      await adminApi.deleteTag(id);
      toast.success("Tag deleted");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-crm-text-bright flex items-center gap-2">
            <FiTag /> Product Tags
          </h1>
          <p className="text-sm text-crm-text-dim mt-1">
            One tag can be assigned to many products. Create tags here or while publishing a product.
          </p>
        </div>
        <button type="button" className="crm-btn" onClick={load} disabled={loading}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {loadError ? (
        <div className="crm-card border border-crm-danger/40 bg-crm-danger-dim p-4 text-sm text-crm-danger">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="crm-card p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-crm-text-dim">New tag group</h2>
          <input className="crm-input" placeholder="Group name (EN)" value={groupForm.nameEn} onChange={(e) => setGroupForm((f) => ({ ...f, nameEn: e.target.value }))} />
          <input className="crm-input" placeholder="Group name (BN)" value={groupForm.nameBn} onChange={(e) => setGroupForm((f) => ({ ...f, nameBn: e.target.value }))} />
          <button type="button" className="crm-btn crm-btn-primary" disabled={busy} onClick={createGroup}>
            <FiPlus /> Create group
          </button>
        </div>
        <div className="crm-card p-4 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-crm-text-dim">New tag</h2>
          <input className="crm-input" placeholder="Tag name (EN)" value={tagForm.nameEn} onChange={(e) => setTagForm((f) => ({ ...f, nameEn: e.target.value }))} />
          <input className="crm-input" placeholder="Tag name (BN)" value={tagForm.nameBn} onChange={(e) => setTagForm((f) => ({ ...f, nameBn: e.target.value }))} />
          <select className="crm-input" value={tagForm.groupId} onChange={(e) => setTagForm((f) => ({ ...f, groupId: e.target.value }))}>
            <option value="">No group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.nameEn}</option>
            ))}
          </select>
          <button type="button" className="crm-btn crm-btn-primary" disabled={busy} onClick={createTag}>
            <FiPlus /> Create tag
          </button>
        </div>
      </div>

      <div className="crm-card overflow-hidden">
        <div className="px-4 py-3 border-b border-crm-border flex justify-between">
          <span className="font-semibold text-crm-text">{allTags.length} tags</span>
        </div>
        {loading ? (
          <p className="p-6 text-crm-text-dim">Loading…</p>
        ) : allTags.length === 0 ? (
          <p className="p-6 text-crm-text-dim">No tags yet. Create one above.</p>
        ) : (
          <ul className="divide-y divide-crm-border">
            {allTags.map((tag) => (
              <li key={tag.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {editingTag?.id === tag.id ? (
                  <>
                    <input className="crm-input flex-1 min-w-[140px]" value={editingTag.nameEn} onChange={(e) => setEditingTag((t) => ({ ...t, nameEn: e.target.value }))} />
                    <input className="crm-input flex-1 min-w-[140px]" value={editingTag.nameBn || ""} onChange={(e) => setEditingTag((t) => ({ ...t, nameBn: e.target.value }))} />
                    <button type="button" className="crm-btn crm-btn-primary" disabled={busy} onClick={saveEdit}>Save</button>
                    <button type="button" className="crm-btn" onClick={() => setEditingTag(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-crm-text-bright">{tag.nameEn}</span>
                    <span className="text-xs text-crm-text-dim">{tag.nameBn}</span>
                    {tag.groupName ? <span className="crm-badge">{tag.groupName}</span> : null}
                    <span className="text-xs text-crm-text-muted ml-auto">#{tag.slug}</span>
                    <button type="button" className="crm-btn" onClick={() => setEditingTag({ ...tag })}><FiEdit2 /></button>
                    <button type="button" className="crm-btn border-crm-danger/30 text-crm-danger" onClick={() => removeTag(tag.id)}><FiTrash2 /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
