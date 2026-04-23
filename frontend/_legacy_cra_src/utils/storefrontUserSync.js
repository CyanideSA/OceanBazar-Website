/** Fired after login/signup/profile save/photo upload with full merged `oceanBazarUser` payload. */
export const STOREFRONT_PROFILE_UPDATED = "oceanbazar:profile-updated";

/**
 * Merge patch into `oceanBazarUser`, persist, and broadcast so Header / dashboard / chat / account shell stay in sync.
 */
export function syncStorefrontUser(patch) {
  if (!patch || typeof patch !== "object") return;
  let base = {};
  try {
    const raw = localStorage.getItem("oceanBazarUser");
    if (raw) base = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const next = { ...base, ...patch };
  localStorage.setItem("oceanBazarUser", JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(STOREFRONT_PROFILE_UPDATED, { detail: next }));
}

/** Replace stored user (e.g. after login) so no stale fields remain from a previous session. */
export function replaceStorefrontUser(user) {
  if (!user || typeof user !== "object") return;
  localStorage.setItem("oceanBazarUser", JSON.stringify(user));
  window.dispatchEvent(new CustomEvent(STOREFRONT_PROFILE_UPDATED, { detail: user }));
}
