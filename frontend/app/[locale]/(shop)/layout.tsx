import ShopShell from '@/components/layout/ShopShell';
import { fetchActiveFlashSaleMeta, fetchStorefrontSettings } from '@/lib/fetchStorefrontCatalog';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function ShopLayout({ children, params }: Props) {
  const { locale } = await params;
  const [siteSettings, flashSale] = await Promise.all([
    fetchStorefrontSettings(),
    fetchActiveFlashSaleMeta(locale),
  ]);
  return (
    <ShopShell initialSiteSettings={siteSettings} initialFlashSale={flashSale}>
      {children}
    </ShopShell>
  );
}
