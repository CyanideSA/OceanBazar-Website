import { fetchStorefrontSettings } from '@/lib/fetchStorefrontCatalog';
import ContactPageClient from './ContactPageClient';

export default async function ContactPage() {
  const initialSettings = await fetchStorefrontSettings();
  return <ContactPageClient initialSettings={initialSettings} />;
}
