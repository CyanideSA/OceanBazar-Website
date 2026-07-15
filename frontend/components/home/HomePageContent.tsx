'use client';

import HeroSection from '@/components/layout/HeroSection';
import FrequentlySearched from '@/components/home/FrequentlySearched';
import ProductBanners from '@/components/home/ProductBanners';
import TopBrandsRow from '@/components/home/TopBrandsRow';
import FlashDealSection from '@/components/home/FlashDealSection';
import ProductSection from '@/components/home/ProductSection';
import CategoryGrid from '@/components/product/CategoryGrid';
import TrustBadgeStrip from '@/components/shared/TrustBadgeStrip';

export default function HomePageContent() {
  return (
    <div className="bg-background">
      <HeroSection />
      <TrustBadgeStrip />
      <FrequentlySearched />
      <ProductBanners />
      <CategoryGrid />
      <TopBrandsRow />
      <FlashDealSection />
      <ProductSection titleKey="featured" />
      <ProductSection titleKey="bestRated" />
      <ProductSection titleKey="mostSold" />
      <ProductSection titleKey="trending" />
    </div>
  );
}
