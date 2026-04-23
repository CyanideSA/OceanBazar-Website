const TOKEN_KEY = "oceanbazar_admin_token";
const USER_KEY = "oceanbazar_admin_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getAdminUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setSession(token, admin) {
  localStorage.setItem(TOKEN_KEY, token || "");
  localStorage.setItem(USER_KEY, JSON.stringify(admin || null));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
