/**
 * JSON-LD structured data components for SEO rich snippets.
 * Used on product pages, homepage, and category pages.
 * Helps Google show price, rating, availability in search results.
 */

import type { Product } from '@/types';

// ─── Organization (homepage) ──────────────────────────────────────────────────

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Oceanbazar',
    url: 'https://oceanbazar.com',
    logo: 'https://oceanbazar.com/images/logo-dark.png',
    sameAs: [
      'https://www.facebook.com/oceanbazarbd',
      'https://www.instagram.com/oceanbazarbd',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+880-1700-000000',
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
    url: 'https://oceanbazar.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://oceanbazar.com/en/products?q={search_term_string}',
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
  const baseUrl = 'https://oceanbazar.com';
  const productUrl = `${baseUrl}/${locale}/product/${product.id}`;
  const price = product.pricing?.retail?.price ?? 0;
  const compareAt = product.pricing?.retail?.compareAt;

  const offers: Record<string, unknown> = {
    '@type': 'Offer',
    url: productUrl,
    priceCurrency: 'BDT',
    price: Number(price).toFixed(2),
    availability:
      (product.stock ?? 1) > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    seller: {
      '@type': 'Organization',
      name: 'Oceanbazar',
    },
    priceValidUntil: new Date(Date.now() + 30 * 86400_000).toISOString().split('T')[0],
  };

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

  if (product.brand) {
    data.brand = { '@type': 'Brand', name: product.brand };
  }

  if (product.sku) {
    data.sku = product.sku;
    data.mpn = product.sku;
  }

  if (product.ratingAvg != null && (product.reviewCount ?? 0) > 0) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.ratingAvg).toFixed(1),
      reviewCount: product.reviewCount,
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
  const baseUrl = 'https://oceanbazar.com';
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
