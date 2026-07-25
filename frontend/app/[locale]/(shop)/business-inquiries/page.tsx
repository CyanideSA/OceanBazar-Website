import { fetchStorefrontSettings } from '@/lib/fetchStorefrontCatalog';
import BusinessInquiriesClient from './BusinessInquiriesClient';

export default async function BusinessInquiriesPage() {
  const initialSettings = await fetchStorefrontSettings();
  return <BusinessInquiriesClient initialSettings={initialSettings} />;
}
