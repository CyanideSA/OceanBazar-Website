/**
 * JSON-LD structured data components for SEO rich snippets.
 * Used on product pages, homepage, and category pages.
 * Helps Google show price, rating, availability in search results.
 */

import type { Product } from '@/types';

/** Live storefront origin — structured data must reference the real domain. */
const SITE_URL = 'https://oceanbazar.com.bd';

// ─── Organization (homepage) ──────────────────────────────────────────────────

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Oceanbazar',
    url: SITE_URL,
    logo: `${SITE_URL}/ob-brand-logo.png?v=10`,
    sameAs: [
      'https://www.facebook.com/oceanbazarbd',
      'https://www.instagram.com/oceanbazarbd',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+880 1349 358 825',
      email: 'contact@oceanbazar.com.bd',
      contactType: 'customer service',
      availableLanguage: ['Bengali', 'English'],
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── WebSite + Sitelinks SearchBox ───────────────────────────────────────────

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Oceanbazar',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/en/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── Product rich snippet ─────────────────────────────────────────────────────

interface ProductJsonLdProps {
  product: Product & {
    description?: string;
    images?: string[];
    ratingAvg?: number | null;
    reviewCount?: number;
    brand?: string;
    sku?: string;
    stock?: number;
  };
  locale?: string;
}

export function ProductJsonLd({ product, locale = 'en' }: ProductJsonLdProps) {
  const baseUrl = SITE_URL;
  const productUrl = `${baseUrl}/${locale}/product/${product.id}`;
  const price = product.pricing?.retail?.price ?? 0;
  const compareAt = product.pricing?.retail?.compareAt;
  const stock = product.stock ?? (product as { stockQuantity?: number }).stockQuantity ?? 1;
  const sku =
    product.sku ||
    (product as { mpn?: string }).mpn ||
    null;
  const ratingAvg =
    product.ratingAvg ??
    (product as { rating?: number }).rating ??
    null;
  const reviewCount =
    product.reviewCount ??
    (product as { reviewsCount?: number }).reviewsCount ??
    0;

  const offers: Record<string, unknown> = {
    '@type': 'Offer',
    url: productUrl,
    priceCurrency: 'BDT',
    price: Number(price).toFixed(2),
    availability:
      Number(stock) > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: {
      '@type': 'Organization',
      name: 'Oceanbazar',
    },
    priceValidUntil: new Date(Date.now() + 30 * 86400_000).toISOString().split('T')[0],
  };

  if (sku) {
    offers.sku = sku;
  }

  if (compareAt && compareAt > price) {
    offers.hasMerchantReturnPolicy = {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'BD',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
    };
  }

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: (product.description ?? product.title).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 5000) || product.title,
    url: productUrl,
    offers,
  };

  const imageUrls = (product.images ?? [])
    .filter((img: any) => typeof img === 'string' || (img && (img.mediaType ?? 'image') === 'image'))
    .map((img: any) => typeof img === 'string' ? img : img.url)
    .filter(Boolean);

  if (imageUrls.length > 0) {
    data.image = imageUrls;
  } else if (product.primaryImage) {
    data.image = product.primaryImage;
  }

  const brandDetailName = (product as { brandDetail?: { nameEn?: string } | null }).brandDetail?.nameEn;
  if (product.brand) {
    data.brand = { '@type': 'Brand', name: product.brand };
  } else if (brandDetailName) {
    data.brand = {
      '@type': 'Brand',
      name: brandDetailName,
    };
  }

  if (sku) {
    data.sku = sku;
    data.mpn = sku;
  }

  if (ratingAvg != null && Number(reviewCount) > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(ratingAvg).toFixed(1),
      reviewCount: Number(reviewCount),
      bestRating: '5',
      worstRating: '1',
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── BreadcrumbList ───────────────────────────────────────────────────────────

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── FAQPage (category buying guides, product FAQ) ────────────────────────────

export function FaqJsonLd({ faq }: { faq: Array<{ question: string; answer: string }> }) {
  if (!Array.isArray(faq) || faq.length === 0) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── Raw schema.org node (driven by SeoMetadata.schemaJson from the BFF) ──────

export function GenericJsonLd({ data }: { data: Record<string, unknown> | null | undefined }) {
  if (!data || typeof data !== 'object') return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// ─── ItemList (category / search results page) ────────────────────────────────

export function ItemListJsonLd({
  products,
  locale = 'en',
}: {
  products: Array<{ id: string; title: string; primaryImage?: string }>;
  locale?: string;
}) {
  const baseUrl = SITE_URL;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${baseUrl}/${locale}/product/${p.id}`,
      name: p.title,
      image: p.primaryImage,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
