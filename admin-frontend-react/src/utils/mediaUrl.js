import { resolveAdminApiBase } from "../lib/api";

function backendOrigin() {
  const base = resolveAdminApiBase().replace(/\/$/, "");
  return base.replace(/\/api$/i, "");
}

/** Admin previews: same backend serves /uploads — resolve relative paths. */
export function resolveAdminMediaUrl(raw) {
  if (raw == null) return raw;
  const url = String(raw).trim();
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/uploads/")) {
    return `${backendOrigin()}${url}`;
  }
  return normalizeProductImageUrl(url);
}

export function normalizeProductImageUrl(raw) {
  if (raw == null) return raw;
  const url = String(raw).trim();
  if (!url) return url;
  const lower = url.toLowerCase();
  if (!lower.includes("drive.google.com") && !lower.includes("docs.google.com")) {
    return url;
  }
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
  }
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
  }
  return url;
}
