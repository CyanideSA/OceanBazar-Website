import AccountOrderInvoicePageClient from './AccountOrderInvoicePageClient';
import { staticExportPlaceholderIdParams } from '@/lib/staticExportDummyParams';

export async function generateStaticParams() {
  return staticExportPlaceholderIdParams();
}

export default function AccountOrderInvoicePage() {
  return <AccountOrderInvoicePageClient />;
}
