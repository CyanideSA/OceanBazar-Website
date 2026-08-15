import { redirect } from 'next/navigation';

/** Sends `/` to default storefront locale when middleware is absent (static export). With middleware enabled, this is effectively superseded. */
export default function RootPage() {
  redirect('/bn');
}
