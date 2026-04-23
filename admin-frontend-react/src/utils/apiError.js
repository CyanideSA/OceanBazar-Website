/**
 * @param {unknown} error
 * @param {string} [fallback]
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = "Something went wrong.") {
  const d = error?.response?.data;
  if (d == null || d === "") return error?.message || fallback;
  if (typeof d === "string") return d || fallback;
  if (typeof d === "object" && !Array.isArray(d)) {
    const msg = d.detail ?? d.message ?? d.error;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return fallback;
}
