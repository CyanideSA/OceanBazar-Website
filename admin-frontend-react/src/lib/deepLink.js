/**
 * Admin deep-link helpers — sessionStorage + module navigation.
 * App.jsx consumes these keys on module switch / mount.
 */
export const DEEP_LINK = {
  customer: "oceanbazar_customer_detail",
  timeline: "oceanbazar_timeline_customer",
  order: "oceanbazar_order_detail",
  product: "oceanbazar_product_search",
  return: "oceanbazar_return_detail",
  payment: "oceanbazar_payment_detail",
};

export function setDeepLink(key, value) {
  try {
    if (value == null || value === "") sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, String(value));
  } catch { /* ignore */ }
}

export function consumeDeepLink(key) {
  try {
    const v = sessionStorage.getItem(key);
    if (v != null) sessionStorage.removeItem(key);
    return v;
  } catch {
    return null;
  }
}

export function peekDeepLink(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** True if value looks like a registered User.id (8-char alphanumeric). */
export function isRealUserId(id) {
  return typeof id === "string" && /^[A-Za-z0-9]{8}$/.test(id) && !id.startsWith("visitor");
}
