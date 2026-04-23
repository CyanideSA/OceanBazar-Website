'use client';

import HeroSection from '@/components/layout/HeroSection';
import FrequentlySearched from '@/components/home/FrequentlySearched';
import ProductBanners from '@/components/home/ProductBanners';
import TopBrandsRow from '@/components/home/TopBrandsRow';
import ProductSection from '@/components/home/ProductSection';
import TrustBadgeStrip from '@/components/shared/TrustBadgeStrip';

export default function HomePageContent() {
  return (
    <div className="bg-background">
      <HeroSection />
      <TrustBadgeStrip />
      <FrequentlySearched />
      <ProductBanners />
      <TopBrandsRow />
      <ProductSection titleKey="trending" layout="thirty" searchQuery="trending" />
      <ProductSection titleKey="bestSeller" layout="eleven" searchQuery="best" />
      <ProductSection titleKey="beauty" layout="eleven" searchQuery="beauty" />
      <ProductSection titleKey="mostSold" layout="thirty" searchQuery="sold" />
      <ProductSection titleKey="gadgets" layout="eleven" searchQuery="gadget" />
      <ProductSection titleKey="home" layout="eleven" searchQuery="home appliance" />
      <ProductSection titleKey="kids" layout="eleven" searchQuery="kids" />
      <ProductSection titleKey="more" layout="thirty" searchQuery="new" />
    </div>
  );
}
