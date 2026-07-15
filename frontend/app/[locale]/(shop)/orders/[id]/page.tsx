import { redirect } from 'next/navigation';
import { staticExportPlaceholderIdParams } from '@/lib/staticExportDummyParams';

export async function generateStaticParams() {
  return staticExportPlaceholderIdParams();
}

export default async function LegacyOrderDetailRedirect(
  props: {
    params: Promise<{ locale: string; id: string }>;
  }
) {
  const params = await props.params;
  redirect(`/${params.locale}/account/orders/${params.id}`);
}
