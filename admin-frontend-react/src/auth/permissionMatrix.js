/**
 * Role model (align with backend admin JWT roles):
 * - SUPER_ADMIN — full access (including deleting admin accounts).
 * - ADMIN — most operational access; cannot remove admins (Super Admin only).
 * - STAFF — read-only on sensitive areas; no Global Settings; cannot mutate admin team.
 */
const PERMISSIONS = {
  dashboard:    { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
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
  email:        { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], send: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  meta:         { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  customerTimeline: { view: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  integrations:   { view: ["SUPER_ADMIN", "ADMIN"], edit: ["SUPER_ADMIN", "ADMIN"] },
  seo:          { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  crmIntelligence: { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  analyticsAi:  { view: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  aiMarketing:  { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  engagement:   { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  disputes:     { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  audit:        { view: ["SUPER_ADMIN", "ADMIN"] },
  adminUsers:   { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"], delete: ["SUPER_ADMIN"] },
  applications: { view: ["SUPER_ADMIN", "ADMIN"], edit: ["SUPER_ADMIN", "ADMIN"] },
  settings:     { view: ["SUPER_ADMIN", "ADMIN"], edit: ["SUPER_ADMIN", "ADMIN"] },
  security:     { view: ["SUPER_ADMIN", "ADMIN"], edit: ["SUPER_ADMIN", "ADMIN"] },
  obPoints:     { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  tickets:      { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN", "STAFF"], reply: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  clientErrors: { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  abTests:      { view: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  flashSales:   { view: ["SUPER_ADMIN", "ADMIN", "STAFF"], edit: ["SUPER_ADMIN", "ADMIN"] },
  pendingApprovals: { view: ["SUPER_ADMIN"], edit: ["SUPER_ADMIN"] },
  searchAnalytics:  { view: ["SUPER_ADMIN", "ADMIN", "STAFF"] },
  rolePermissions:  { view: ["SUPER_ADMIN"], edit: ["SUPER_ADMIN"] },
};

/** Full catalog for Super Admin permission editor */
export const PERMISSION_CATALOG = Object.entries(PERMISSIONS).map(([module, actions]) => ({
  module,
  actions: Object.keys(actions),
}));

let customRoleOverrides = {};

export function setCustomRolePermissions(map) {
  customRoleOverrides = map || {};
}

export function hasPermission(role, module, action = "view") {
  const normalizedRole = String(role || "").toUpperCase();
  if (normalizedRole === "SUPER_ADMIN") return true;

  const override = customRoleOverrides[normalizedRole.toLowerCase()]?.[module]?.[action];
  if (override !== undefined) return Boolean(override);

  const modulePerms = PERMISSIONS[module];
  if (!modulePerms) return false;
  const allowed = modulePerms[action];
  if (!allowed) return false;
  return allowed.includes(normalizedRole);
}

export function getAccessibleModules(role) {
  const normalizedRole = String(role || "").toUpperCase();
  return Object.entries(PERMISSIONS)
    .filter(([key]) => hasPermission(normalizedRole, key, "view"))
    .map(([key]) => key);
}

export default PERMISSIONS;
