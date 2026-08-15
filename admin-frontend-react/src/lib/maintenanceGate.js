/**
 * Redirect to storefront maintenance page when VITE_MAINTENANCE_MODE is enabled.
 * Staff bypass: visit storefront once with ?bypass=TOKEN (sets ob_maint_bypass cookie on parent domain).
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export function isMaintenanceMode() {
  const v = String(import.meta.env.VITE_MAINTENANCE_MODE ?? "").trim().toLowerCase();
  return TRUTHY.has(v);
}

function getBypassToken() {
  return String(import.meta.env.VITE_MAINTENANCE_BYPASS_TOKEN ?? "").trim();
}

function hasBypassCookie() {
  const token = getBypassToken();
  if (!token) return false;
  return document.cookie.split(";").some((c) => {
    const [name, ...rest] = c.trim().split("=");
    return name === "ob_maint_bypass" && decodeURIComponent(rest.join("=")) === token;
  });
}

function hasBypassQuery() {
  const token = getBypassToken();
  if (!token) return false;
  return new URLSearchParams(window.location.search).get("bypass") === token;
}

/** Call before rendering React root. May redirect or set cookie from ?bypass=. */
export function enforceMaintenanceGate() {
  if (!isMaintenanceMode()) return false;

  if (hasBypassQuery()) {
    const token = getBypassToken();
    const maxAge = 60 * 60 * 24 * 14;
    const domain = import.meta.env.VITE_MAINTENANCE_COOKIE_DOMAIN;
    let cookie = `ob_maint_bypass=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    if (import.meta.env.PROD) cookie += "; Secure";
    if (domain) cookie += `; domain=${domain}`;
    document.cookie = cookie;
    const url = new URL(window.location.href);
    url.searchParams.delete("bypass");
    window.history.replaceState({}, "", url.pathname + url.search);
    return false;
  }

  if (hasBypassCookie()) return false;

  const target =
    import.meta.env.VITE_MAINTENANCE_PAGE_URL ||
    "https://oceanbazar.com.bd/en/maintenance";
  window.location.replace(target);
  return true;
}
