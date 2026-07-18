import React, { useCallback, useEffect, useState } from "react";
import { FiShield, FiSave } from "react-icons/fi";
import { api } from "../lib/api";
import { useToast } from "../components/ToastProvider";
import { PERMISSION_CATALOG, setCustomRolePermissions } from "../auth/permissionMatrix";

const BASE = "/api/admin/governance";
const ROLES = [
  { key: "admin", label: "Admin" },
  { key: "staff", label: "Staff" },
];

function buildMatrix(catalog, saved) {
  const matrix = {};
  for (const { module, actions } of catalog) {
    matrix[module] = {};
    for (const action of actions) {
      matrix[module][action] = saved?.[module]?.[action] ?? null;
    }
  }
  return matrix;
}

export default function RolePermissionsPage() {
  const toast = useToast();
  const [role, setRole] = useState("admin");
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (r) => {
    setLoading(true);
    try {
      const res = await api.get(`${BASE}/permissions/${r}`);
      setMatrix(buildMatrix(PERMISSION_CATALOG, res.data?.permissions || {}));
    } catch {
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load(role);
  }, [role, load]);

  function toggle(module, action) {
    setMatrix((m) => ({
      ...m,
      [module]: {
        ...m[module],
        [action]: m[module][action] === true ? false : m[module][action] === false ? null : true,
      },
    }));
  }

  function cellLabel(val) {
    if (val === true) return "Allow";
    if (val === false) return "Deny";
    return "Default";
  }

  async function save() {
    setSaving(true);
    try {
      const permissions = {};
      for (const [mod, actions] of Object.entries(matrix)) {
        permissions[mod] = {};
        for (const [act, val] of Object.entries(actions)) {
          if (val !== null) permissions[mod][act] = val;
        }
      }
      await api.put(`${BASE}/permissions/${role}`, { permissions });
      toast.success("Permissions saved");
      setCustomRolePermissions({ [role]: permissions });
    } catch (e) {
      toast.error(e?.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-crm-primary-dim text-crm-primary">
            <FiShield size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-crm-text-bright">Role Permissions</h2>
            <p className="text-crm-text-dim text-sm">Super Admin only · overrides default CRM access</p>
          </div>
        </div>
        <button type="button" disabled={saving} onClick={save} className="crm-btn-primary flex items-center gap-2">
          <FiSave size={16} /> Save {role}
        </button>
      </div>

      <div className="flex gap-2">
        {ROLES.map((r) => (
          <button key={r.key} type="button" onClick={() => setRole(r.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize ${
              role === r.key ? "bg-crm-primary-dim text-crm-primary" : "bg-crm-bg text-crm-text-dim"
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin h-10 w-10 border-b-2 border-crm-primary rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERMISSION_CATALOG.map(({ module, actions }) => (
            <div key={module} className="crm-card">
              <h3 className="font-bold text-crm-text-bright capitalize mb-3">{module.replace(/([A-Z])/g, " $1")}</h3>
              <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                  <button key={action} type="button" onClick={() => toggle(module, action)}
                    className={`px-2 py-1 rounded text-xs font-bold border capitalize ${
                      matrix[module]?.[action] === true ? "border-green-500/50 text-crm-success bg-green-500/10" :
                      matrix[module]?.[action] === false ? "border-crm-danger/50 text-crm-danger bg-crm-danger-dim" :
                      "border-crm-border text-crm-text-dim"
                    }`}>
                    {action}: {cellLabel(matrix[module]?.[action])}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-crm-text-dim md:col-span-2">Click to cycle: Default → Allow → Deny. Super Admin always has full access.</p>
        </div>
      )}
    </div>
  );
}
