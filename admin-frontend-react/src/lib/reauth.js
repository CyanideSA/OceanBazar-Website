const KEY = "oceanbazar_admin_reauth";

export function setReauthToken(token, expiresInSec = 300) {
  const exp = Date.now() + Math.max(30, Number(expiresInSec || 300)) * 1000;
  sessionStorage.setItem(KEY, JSON.stringify({ token, exp }));
}

export function getReauthToken() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.exp) return "";
    if (Date.now() >= Number(parsed.exp)) {
      sessionStorage.removeItem(KEY);
      return "";
    }
    return String(parsed.token);
  } catch {
    return "";
  }
}

export function clearReauthToken() {
  sessionStorage.removeItem(KEY);
}

