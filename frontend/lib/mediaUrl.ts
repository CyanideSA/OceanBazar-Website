const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:4000';

export function getMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BASE}${url.startsWith('/') ? '' : '/'}${url}`;
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
