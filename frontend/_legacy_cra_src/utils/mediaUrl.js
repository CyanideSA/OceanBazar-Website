/**
 * Google Drive "anyone with the link" URLs are HTML pages, not direct image bytes.
 * Relative `/uploads/...` paths are resolved against the API backend origin (CRA: REACT_APP_BACKEND_URL).
 */
import { BACKEND_URL } from '../api/service';

export function getMediaOrigin() {
  return String(BACKEND_URL || 'https://localhost:8000').replace(/\/$/, '');
}

/** Turn relative upload paths into absolute URLs for <img> / <video src>. */
export function resolveMediaUrl(raw) {
  if (raw == null) return raw;
  const url = String(raw).trim();
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (url.startsWith('/uploads/')) {
    return `${getMediaOrigin()}${url}`;
  }
  return url;
}

function normalizeDriveUrl(url) {
  const lower = url.toLowerCase();
  if (!lower.includes('drive.google.com') && !lower.includes('docs.google.com')) {
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

export function normalizeProductImageUrl(raw) {
  if (raw == null) return raw;
  const url = String(raw).trim();
  if (!url) return url;
  return resolveMediaUrl(normalizeDriveUrl(url));
}
