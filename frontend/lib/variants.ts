import type { ProductImage, ProductVariant } from '@/types';

export function slugColorKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function findAttrKey(attrs: Record<string, string>, names: string[]): string | null {
  const keys = Object.keys(attrs);
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
  };
}

/** @deprecated prefer getVariantAxes */
export function getColorAndSize(attrs: Record<string, string>) {
  const { color, size } = getVariantAxes(attrs);
  return { color, size };
}

export function uniqueVariantOptions(variants: ProductVariant[]) {
  const colors = new Map<string, string>();
  const sizes = new Map<string, string>();
  const styles = new Map<string, string>();
  for (const v of variants) {
    const { color, size, style } = getVariantAxes(v.attributes || {});
    if (color) colors.set(slugColorKey(color), color);
    if (size) sizes.set(size, size);
    if (style) styles.set(style, style);
  }
  return {
    colors: [...colors.entries()].map(([slug, label]) => ({ slug, label })),
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
  if (!selectedColorSlug && !selectedSize && !selectedStyle) return null;

  const match = variants.find((v) => {
    const { color, size, style } = getVariantAxes(v.attributes || {});
    const cSlug = color ? slugColorKey(color) : null;
    const colorOk = !selectedColorSlug || (cSlug != null && cSlug === selectedColorSlug);
    const sizeOk = !selectedSize || (size != null && size === selectedSize);
    const styleOk = !selectedStyle || (style != null && style === selectedStyle);
    return colorOk && sizeOk && styleOk;
  });
  if (match) return match;

  if (selectedColorSlug) {
    const byColor = variants.find((v) => {
      const { color } = getVariantAxes(v.attributes || {});
      return color && slugColorKey(color) === selectedColorSlug;
    });
    if (byColor) return byColor;
  }
  if (selectedStyle) {
    const byStyle = variants.find((v) => getVariantAxes(v.attributes || {}).style === selectedStyle);
    if (byStyle) return byStyle;
  }
  if (selectedSize) {
    const bySize = variants.find((v) => getVariantAxes(v.attributes || {}).size === selectedSize);
    if (bySize) return bySize;
  }
  return null;
}

export function filterImagesByColor(images: ProductImage[], colorSlug: string | null): ProductImage[] {
  if (!colorSlug) return images;
  const keyed = images.filter((i) => i.colorKey && slugColorKey(i.colorKey) === colorSlug);
  if (keyed.length) return keyed;
  return images.filter((i) => !i.colorKey);
}

/** True when the shopper must pick an option before add-to-cart. */
export function requiresVariantSelection(variants: ProductVariant[]): boolean {
  return variants.length > 1;
}
