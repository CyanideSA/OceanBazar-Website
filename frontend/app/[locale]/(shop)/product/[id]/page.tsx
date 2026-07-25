import { Metadata } from 'next';
import ProductDetailClient from './ProductDetailClient';
import { ProductJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
import SeoContent from '@/components/seo/SeoContent';
import { redirect } from 'next/navigation';
import { shouldSkipLoopbackBffDuringBuild } from '@/lib/shouldSkipLoopbackBffDuringBuild';
import { fetchProductPathsForStaticExport } from '@/lib/staticExportProductPaths';
import { fetchSeoMeta } from '@/lib/seoMeta';

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export async function generateStaticParams() {
  return fetchProductPathsForStaticExport();
}

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SITE_URL = 'https://oceanbazar.com';

async function getProduct(id: string, locale: string) {
  if (shouldSkipLoopbackBffDuringBuild()) return null;
  try {
    const res = await fetch(`${API_URL}/api/products/${id}?lang=${locale}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.product ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const product = await getProduct(params.id, params.locale);
  if (!product) return { title: 'Product | Oceanbazar' };

  const price = product.pricing?.retail?.price;
  const image = product.primaryImage;

  // Admin/AI-managed SEO metadata takes precedence when present.
  const seo = await fetchSeoMeta('product', params.id, params.locale);
  const title = seo?.metaTitle || product.title;
  const description =
    seo?.metaDescription ?? product.seoDescription ?? (stripHtml(product.description).slice(0, 160) || product.title);

  return {
    title,
    description,
    ...(seo?.keywords?.length ? { keywords: seo.keywords } : {}),
    ...(seo?.canonicalUrl ? { alternates: { canonical: seo.canonicalUrl } } : {}),
    openGraph: {
      type: 'website',
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || stripHtml(product.description).slice(0, 200) || product.title,
      url: seo?.canonicalUrl || `${SITE_URL}/${params.locale}/product/${params.id}`,
      images: (seo?.ogImage || image) ? [{ url: (seo?.ogImage || image) as string, width: 800, height: 800, alt: title }] : [],
      siteName: 'Oceanbazar',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: stripHtml(product.description).slice(0, 200) || product.title,
      images: image ? [image] : [],
    },
    ...(price !== undefined && {
      other: {
        'product:price:amount': String(price),
        'product:price:currency': 'BDT',
      },
    }),
  };
}

export default async function ProductPage(props: Props) {
  const params = await props.params;
  const product = await getProduct(params.id, params.locale);
  if (product?.slug && product.slug !== params.id) {
    redirect(`/${params.locale}/product/${product.slug}`);
  }

  const breadcrumbs = [
    { name: 'Home', url: `${SITE_URL}/${params.locale}` },
    { name: 'Products', url: `${SITE_URL}/${params.locale}/products` },
    ...(product ? [{ name: product.title, url: `${SITE_URL}/${params.locale}/product/${product.slug || params.id}` }] : []),
  ];

  return (
    <>
      {/* JSON-LD structured data for Google rich snippets */}
      {product && <ProductJsonLd product={product} locale={params.locale} />}
      <BreadcrumbJsonLd items={breadcrumbs} />

      <ProductDetailClient
        productId={params.id}
        locale={params.locale}
        initialProduct={product}
      />

      {/* AI/admin-managed SEO content blocks + FAQ (FAQPage JSON-LD) */}
      <SeoContent entityType="product" entityId={params.id} locale={params.locale} />
    </>
  );
}
