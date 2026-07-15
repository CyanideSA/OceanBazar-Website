import { redirect } from 'next/navigation';

export default async function LegacyOrdersRedirect(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  redirect(`/${params.locale}/account/orders`);
}
