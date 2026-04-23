import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailClient from './ProductDetailClient';

interface Props {
  params: { id: string; locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products/${params.id}?lang=${params.locale}`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: 'Product | Oceanbazar' };
    const data = await res.json();
    return {
      title: data.product.title,
      description: data.product.seoDescription ?? data.product.description?.slice(0, 160),
    };
  } catch {
    return { title: 'Product | Oceanbazar' };
  }
}

export default function ProductPage({ params }: Props) {
  return <ProductDetailClient productId={params.id} locale={params.locale} />;
}
