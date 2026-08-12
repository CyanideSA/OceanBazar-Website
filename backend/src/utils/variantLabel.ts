/** Format product variant attributes for cart / order / invoice display. */
export function formatVariantLabelFromAttrs(
  attrs: unknown,
  fallbackName?: string | null,
): string | null {
  let map: Record<string, unknown> = {};
  if (typeof attrs === 'string') {
    try {
      map = JSON.parse(attrs) as Record<string, unknown>;
    } catch {
      map = {};
    }
  } else if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
    map = attrs as Record<string, unknown>;
  }

  const get = (...keys: string[]) => {
    for (const k of Object.keys(map)) {
      if (keys.some((x) => x.toLowerCase() === k.toLowerCase()) && !k.startsWith('_')) {
        const v = map[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
    }
    return null;
  };

  const parts: string[] = [];
  const color = get('color', 'colour', 'shade', 'কালার', 'শতাদ');
  const size = get('size', 'সাইজ');
  const style = get('style', 'finish', 'type', 'option', 'স্টাইল');
  if (color) parts.push(`Color: ${color}`);
  if (size) parts.push(`Size: ${size}`);
  if (style) parts.push(`Style: ${style}`);
  if (parts.length) return parts.join(' · ');
  const name = fallbackName?.trim();
  return name || null;
}

export async function attachVariantLabels<T extends { variantId?: string | null }>(
  prisma: { productVariant: { findMany: (args: unknown) => Promise<Array<{ id: string; attributes: unknown; nameEn?: string | null }>> } },
  items: T[],
): Promise<Array<T & { variantLabel: string | null }>> {
  const ids = [...new Set(items.map((i) => i.variantId).filter((v): v is string => !!v))];
  if (!ids.length) return items.map((i) => ({ ...i, variantLabel: null }));
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: ids } },
    select: { id: true, attributes: true, nameEn: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  return items.map((i) => {
    const v = i.variantId ? byId.get(i.variantId) : undefined;
    return {
      ...i,
      variantLabel: v ? formatVariantLabelFromAttrs(v.attributes, v.nameEn) : null,
    };
  });
}
