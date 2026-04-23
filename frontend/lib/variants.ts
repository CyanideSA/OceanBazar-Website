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

export function getColorAndSize(attrs: Record<string, string>) {
  const colorKey = findAttrKey(attrs, ['color', 'colour', 'কালার']);
  const sizeKey = findAttrKey(attrs, ['size', 'সাইজ']);
  return {
    color: colorKey ? attrs[colorKey] : null,
    size: sizeKey ? attrs[sizeKey] : null,
  };
}

export function uniqueVariantOptions(variants: ProductVariant[]) {
  const colors = new Map<string, string>();
  const sizes = new Map<string, string>();
  for (const v of variants) {
    const { color, size } = getColorAndSize(v.attributes);
    if (color) colors.set(slugColorKey(color), color);
    if (size) sizes.set(size, size);
  }
  return {
    colors: [...colors.entries()].map(([slug, label]) => ({ slug, label })),
    sizes: [...sizes.values()],
  };
}

export function pickVariant(
  variants: ProductVariant[],
  selectedColorSlug: string | null,
  selectedSize: string | null
): ProductVariant | null {
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0];
  if (!selectedColorSlug && !selectedSize) return null;
  const match = variants.find((v) => {
    const { color, size } = getColorAndSize(v.attributes);
    const cSlug = color ? slugColorKey(color) : null;
    const colorOk = !selectedColorSlug || (cSlug && cSlug === selectedColorSlug);
    const sizeOk = !selectedSize || (size && size === selectedSize);
    if (selectedColorSlug && selectedSize) return colorOk && sizeOk;
    if (selectedColorSlug) return colorOk;
    if (selectedSize) return sizeOk;
    return false;
  });
  if (match) return match;
  if (selectedColorSlug) {
    const byColor = variants.find((v) => {
      const { color } = getColorAndSize(v.attributes);
      return color && slugColorKey(color) === selectedColorSlug;
    });
    if (byColor) return byColor;
  }
  if (selectedSize) {
    const bySize = variants.find((v) => getColorAndSize(v.attributes).size === selectedSize);
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
