import { resolvePublicApiBase } from '@/lib/api';

function mediaBase(): string {
  return resolvePublicApiBase();
}

/** Normalize API/media URLs for `<img src>` (protocol-relative, BFF-relative, absolute). */
export function resolvePublicMediaUrl(url: string | null | undefined): string {
  if (!url?.trim()) return '';
  const u = url.trim();
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return getMediaUrl(u);
}

export function getMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${mediaBase()}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Optimize a Cloudinary URL with auto-format, auto-quality, and optional resize.
 * If the URL is not from Cloudinary, returns it unchanged via getMediaUrl.
 */
export function cloudinaryUrl(
  url: string | null | undefined,
  opts?: { width?: number; height?: number; crop?: string },
): string {
  const resolved = getMediaUrl(url);
  if (!resolved || !resolved.includes('res.cloudinary.com')) return resolved;

  const transforms: string[] = ['f_auto', 'q_auto'];
  if (opts?.width) transforms.push(`w_${opts.width}`);
  if (opts?.height) transforms.push(`h_${opts.height}`);
  if (opts?.crop) transforms.push(`c_${opts.crop}`);
  else if (opts?.width || opts?.height) transforms.push('c_fill');

  // Insert transforms after /upload/
  return resolved.replace('/upload/', `/upload/${transforms.join(',')}/`);
}

/**
 * Build a poster thumbnail URL from a Cloudinary video URL.
 * Uses a middle-frame capture (`so_50p`) so thumbnails are representative.
 */
export function cloudinaryVideoPosterUrl(
  url: string | null | undefined,
  opts?: { width?: number; height?: number; crop?: string },
): string {
  const resolved = getMediaUrl(url);
  if (!resolved || !resolved.includes('res.cloudinary.com')) return '';
  if (!resolved.includes('/video/upload/')) return '';

  const transforms: string[] = ['so_50p', 'f_jpg', 'q_auto'];
  if (opts?.width) transforms.push(`w_${opts.width}`);
  if (opts?.height) transforms.push(`h_${opts.height}`);
  if (opts?.crop) transforms.push(`c_${opts.crop}`);
  else if (opts?.width || opts?.height) transforms.push('c_fill');

  const transformed = resolved.replace('/video/upload/', `/video/upload/${transforms.join(',')}/`);
  return transformed.replace(/(\.mp4|\.mov|\.webm)(\?.*)?$/i, '.jpg$2');
}
