/**
 * @param {unknown} error — typically an Axios error
 * @param {string} [fallback]
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const status = error?.response?.status;
  if (status === 401) return "Please sign in again.";
  const d = error?.response?.data;
  if (d == null || d === "") return error?.message || fallback;
  if (typeof d === "string") return d || fallback;
  if (typeof d === "object" && !Array.isArray(d)) {
    const msg = d.detail ?? d.message ?? d.error ?? d.title;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return fallback;
}
