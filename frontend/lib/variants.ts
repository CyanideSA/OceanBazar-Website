import type { ProductImage, ProductVariant } from '@/types';

/** OceanBazar logo blue / orange for non-color option chips */
export const OB_OPTION_BLUE = '#0B6BF5';
export const OB_OPTION_ORANGE = '#F97316';

export function slugColorKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function findAttrKey(attrs: Record<string, string>, names: string[]): string | null {
  const keys = Object.keys(attrs).filter((k) => !k.startsWith('_'));
  for (const n of names) {
    const hit = keys.find((k) => k.toLowerCase() === n.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

export function getVariantAxes(attrs: Record<string, string>) {
  const colorKey = findAttrKey(attrs, ['color', 'colour', 'কালার', 'shade', 'শতাদ']);
  const sizeKey = findAttrKey(attrs, ['size', 'সাইজ']);
  const styleKey = findAttrKey(attrs, ['style', 'স্টাইল', 'finish', 'type', 'option']);
  return {
    color: colorKey ? attrs[colorKey] : null,
    size: sizeKey ? attrs[sizeKey] : null,
    style: styleKey ? attrs[styleKey] : null,
    hex: attrs._hex || attrs._colorHex || null,
    mediaUrl: attrs._mediaUrl || null,
  };
}

/** @deprecated prefer getVariantAxes */
export function getColorAndSize(attrs: Record<string, string>) {
  const { color, size } = getVariantAxes(attrs);
  return { color, size };
}

export function uniqueVariantOptions(variants: ProductVariant[]) {
  const colors = new Map<string, { slug: string; label: string; hex: string | null }>();
  const sizes = new Map<string, string>();
  const styles = new Map<string, string>();
  for (const v of variants) {
    const { color, size, style, hex } = getVariantAxes(v.attributes || {});
    if (color) {
      const slug = slugColorKey(color);
      const prev = colors.get(slug);
      colors.set(slug, { slug, label: color, hex: hex || prev?.hex || null });
    }
    if (size) sizes.set(size, size);
    if (style) styles.set(style, style);
  }
  return {
    colors: [...colors.values()],
    sizes: [...sizes.values()],
    styles: [...styles.values()],
  };
}

export function pickVariant(
  variants: ProductVariant[],
  selectedColorSlug: string | null,
  selectedSize: string | null,
  selectedStyle: string | null = null
): ProductVariant | null {
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0];

  const opts = uniqueVariantOptions(variants);
  if (opts.colors.length && !selectedColorSlug) return null;
  if (opts.sizes.length && !selectedSize) return null;
  if (opts.styles.length && !selectedStyle) return null;

  const match = variants.find((v) => {
    const { color, size, style } = getVariantAxes(v.attributes || {});
    const cSlug = color ? slugColorKey(color) : null;
    const colorOk = !opts.colors.length || (cSlug != null && cSlug === selectedColorSlug);
    const sizeOk = !opts.sizes.length || (size != null && size === selectedSize);
    const styleOk = !opts.styles.length || (style != null && style === selectedStyle);
    return colorOk && sizeOk && styleOk;
  });
  return match ?? null;
}

export function filterImagesByOptionKey(
  images: ProductImage[],
  optionSlug: string | null
): ProductImage[] {
  if (!optionSlug) return images;
  const keyed = images.filter((i) => i.colorKey && slugColorKey(i.colorKey) === optionSlug);
  if (keyed.length) return keyed;
  return images.filter((i) => !i.colorKey);
}

/** @deprecated prefer filterImagesByOptionKey */
export function filterImagesByColor(images: ProductImage[], colorSlug: string | null): ProductImage[] {
  return filterImagesByOptionKey(images, colorSlug);
}

/** True when the shopper must pick an option before add-to-cart. */
export function requiresVariantSelection(variants: ProductVariant[]): boolean {
  return variants.length > 1;
}

/** Human-readable chosen options for cart / checkout / guest lines. */
export function formatVariantLabel(
  attrs: Record<string, string> | null | undefined,
  fallbackName?: string | null,
): string | null {
  const axes = getVariantAxes(attrs || {});
  const parts: string[] = [];
  if (axes.color) parts.push(`Color: ${axes.color}`);
  if (axes.size) parts.push(`Size: ${axes.size}`);
  if (axes.style) parts.push(`Style: ${axes.style}`);
  if (parts.length) return parts.join(' · ');
  const name = fallbackName?.trim();
  return name || null;
}

export function brandOptionAccent(index: number): string {
  return index % 2 === 0 ? OB_OPTION_BLUE : OB_OPTION_ORANGE;
}
