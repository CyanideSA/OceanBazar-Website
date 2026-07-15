import type { ReactNode } from 'react';

/** Match ProductSection collection keys + extras used by `/products/[collection]` client page */
const COLLECTION_KEYS = [
  'featured',
  'top-trending',
  'latest',
  'best-rated',
  'best-seller',
  'most-sold',
  'beauty',
  'gadgets',
  'home',
  'kids',
  'more-for-you',
] as const;

export function generateStaticParams() {
  return COLLECTION_KEYS.map((collection) => ({ collection }));
}

export default function ProductsCollectionLayout({ children }: { children: ReactNode }) {
  return children;
}
