export function getDisplayProductTitle(product) {
  const name = String(product?.name || '').trim();
  const supplier = String(product?.supplier || '').trim();
  if (!name) return 'Product';
  if (!supplier) return name;
  const escaped = supplier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = name.replace(new RegExp(`\\s*(?:[-|·•]|\\s-\\s|\\s\\|\\s)\\s*${escaped}\\s*$`, 'i'), '').trim();
  return stripped || name;
}
