import { adminApi } from "./api";
import { getToken } from "./auth";

let cachedRealtimeToken = "";
let cachedRealtimeTokenExp = 0;
let inFlightPromise = null;

function decodeBase64Url(input) {
  if (!input) return "";
  let normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  try {
    return atob(normalized);
  } catch {
    return "";
  }
}

function getJwtExpMs(token) {
  try {
    const payloadPart = token?.split(".")[1];
    const payloadJson = decodeBase64Url(payloadPart);
    if (!payloadJson) return 0;
    const payload = JSON.parse(payloadJson);
    const exp = Number(payload?.exp || 0);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function isLikelyAdminToken(token) {
  try {
    const payloadPart = token?.split(".")[1];
    const payloadJson = decodeBase64Url(payloadPart);
    if (!payloadJson) return false;
    const payload = JSON.parse(payloadJson);
    return Boolean(payload?.adminId || payload?.admin_id || payload?.role);
  } catch {
    return false;
  }
}

export function clearAdminRealtimeTokenCache() {
  cachedRealtimeToken = "";
  cachedRealtimeTokenExp = 0;
  inFlightPromise = null;
}

export async function getAdminRealtimeToken(forceRefresh = false) {
  const stillValid = cachedRealtimeToken && cachedRealtimeTokenExp > Date.now() + 30_000;
  if (!forceRefresh && stillValid) {
    return cachedRealtimeToken;
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const data = await adminApi.realtimeToken();
      const nextToken = String(data?.token || "");
      if (nextToken) {
        cachedRealtimeToken = nextToken;
        cachedRealtimeTokenExp = getJwtExpMs(nextToken) || (Date.now() + (Number(data?.expiresIn || 900) * 1000));
        return nextToken;
      }
    } catch {
      /* fall back to the current session token */
    } finally {
      inFlightPromise = null;
    }

    const sessionToken = getToken();
    return isLikelyAdminToken(sessionToken) ? sessionToken : "";
  })();

  return inFlightPromise;
}
