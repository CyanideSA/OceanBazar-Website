/**
 * Role model (align with backend admin JWT roles):
 * - SUPER_ADMIN — full access (including deleting admin accounts).
 * - ADMIN — most operational access; cannot remove admins (Super Admin only).
 * - STAFF — read-only on sensitive areas; no Global Settings; cannot mutate admin team.
 */
const PERMISSIONS = {
  dashboard:    { view: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  products:     { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN", "ADMIN"] },
  catalog:      { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN", "ADMIN"] },
  customers:    { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN", "ADMIN"] },
  orders:       { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  payments:     { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  inventory:    { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  delivery:     { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN", "STAFF"], delete: ["SUPER_ADMIN", "ADMIN"] },
  reviews:      { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], moderate: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  returns:      { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"], refund: ["SUPER_ADMIN", "ADMIN"] },
  coupons:      { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  analytics:    { view: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  chat:         { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], reply: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  notifications:{ view: ["SUPER_ADMIN", "ADMIN", "STAFF"], send: ["SUPER_ADMIN", "ADMIN"] },
  disputes:     { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  audit:        { view: ["SUPER_ADMIN", "ADMIN"] },
  adminUsers:   { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN"] },
  applications: { view: ["SUPER_ADMIN", "ADMIN"], edit: ["SUPER_ADMIN", "ADMIN"] },
  /** Global Settings — Super Admin & Admin only (Staff cannot view or edit). */
  settings:     { view: ["SUPER_ADMIN", "ADMIN"], edit: ["SUPER_ADMIN", "ADMIN"] },
  /** File Import — Super Admin & Admin only */
  fileImport:   { view: ["SUPER_ADMIN", "ADMIN"], edit: ["SUPER_ADMIN", "ADMIN"] },
  /** OB Points management */
  obPoints:     { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  /** Support Tickets */
  tickets:      { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN", "STAFF"], reply: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
};

export function hasPermission(role, module, action = "view") {
  const normalizedRole = String(role || "").toUpperCase();
  const modulePerms = PERMISSIONS[module];
  if (!modulePerms) return false;
  const allowed = modulePerms[action];
  if (!allowed) return false;
  return allowed.includes(normalizedRole);
}

export function getAccessibleModules(role) {
  const normalizedRole = String(role || "").toUpperCase();
  return Object.entries(PERMISSIONS)
    .filter(([, perms]) => (perms.view || []).includes(normalizedRole))
    .map(([key]) => key);
}

export default PERMISSIONS;
