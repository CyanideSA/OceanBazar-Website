'use client';

import HeroSection from '@/components/layout/HeroSection';
import ProductBanners from '@/components/home/ProductBanners';
import TopBrandsRow from '@/components/home/TopBrandsRow';
import FlashDealSection from '@/components/home/FlashDealSection';
import ProductSection from '@/components/home/ProductSection';
import TestimonialsCarousel from '@/components/home/TestimonialsCarousel';
import CategoryGrid from '@/components/product/CategoryGrid';
import TrustBadgeStrip from '@/components/shared/TrustBadgeStrip';
import type { HomeCatalog } from '@/lib/fetchHomeCatalog';

export default function HomePageContent({ catalog }: { catalog?: HomeCatalog }) {
  return (
    <div className="bg-background" data-ob-ssr-products={String(
      Object.values(catalog?.sections ?? {}).reduce((n, s) => n + (s?.products?.length ?? 0), 0)
    )}>
      <HeroSection
        initial={{
          heroSlides: (catalog?.heroSlides as never) || [],
          defaultBannerRotationMs: catalog?.defaultBannerRotationMs || 6000,
        }}
      />
      <ProductBanners />
      <CategoryGrid initialCategories={catalog?.categories} />
      <TopBrandsRow initialBrands={catalog?.brands} />
      <FlashDealSection initialCampaigns={catalog?.flashCampaigns} />
      <ProductSection titleKey="featured" initialProducts={catalog?.sections?.featured?.products} />
      <ProductSection titleKey="bestDeals" initialProducts={catalog?.sections?.bestDeals?.products} />
      <ProductSection titleKey="latest" initialProducts={catalog?.sections?.latest?.products} />
      <ProductSection titleKey="bestRated" initialProducts={catalog?.sections?.bestRated?.products} />
      <ProductSection titleKey="mostSold" initialProducts={catalog?.sections?.mostSold?.products} />
      <ProductSection titleKey="trending" initialProducts={catalog?.sections?.trending?.products} />
      <TestimonialsCarousel initialSettings={catalog?.siteSettings} />
      <TrustBadgeStrip />
    </div>
  );
}
