/**
 * CDN / responsive image helpers for Cloudinary URLs.
 * Prefer Next.js <Image> with remotePatterns; use this for raw URLs or non-React contexts.
 */

const DEFAULT_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';

export type CldOpts = {
  width?: number;
  height?: number;
  quality?: 'auto' | 'auto:good' | 'auto:best' | number;
  format?: 'auto' | 'webp' | 'avif';
  crop?: 'fill' | 'limit' | 'scale';
};

/** Build transformation segment: f_auto,q_auto,w_400 */
export function cloudinaryTransforms(opts: CldOpts = {}): string {
  const parts: string[] = [];
  parts.push(`f_${opts.format ?? 'auto'}`);
  parts.push(`q_${opts.quality ?? 'auto'}`);
  if (opts.width) parts.push(`w_${opts.width}`);
  if (opts.height) parts.push(`h_${opts.height}`);
  if (opts.crop) parts.push(`c_${opts.crop}`);
  return parts.join(',');
}

/** If `url` is a res.cloudinary.com image URL, inject transforms after /upload/. */
export function optimizeCloudinaryUrl(url: string, opts: CldOpts = {}): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  const marker = '/image/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const rest = url.slice(i + marker.length);
  if (rest.startsWith('v') && /^v\d+\//.test(rest)) {
    return `${url.slice(0, i + marker.length)}${cloudinaryTransforms(opts)}/${rest}`;
  }
  if (/^f_|^q_|^w_|^h_|^c_/.test(rest)) return url;
  return `${url.slice(0, i + marker.length)}${cloudinaryTransforms(opts)}/${rest}`;
}

/** Public_id style: `folder/id` → full HTTPS URL */
export function cloudinaryPublicIdToUrl(publicId: string, opts: CldOpts = {}): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUD;
  if (!cloud || !publicId) return '';
  const id = publicId.replace(/^\/+/, '');
  return `https://res.cloudinary.com/${cloud}/image/upload/${cloudinaryTransforms(opts)}/${id}`;
}
