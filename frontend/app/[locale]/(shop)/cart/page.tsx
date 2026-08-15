'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCartStore } from '@/stores/cartStore';

export default function CartPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const { setOpen, cart } = useCartStore();
  const goCheckout = searchParams.get('checkout') === '1';

  useEffect(() => {
    setOpen(true);
    if (goCheckout) {
      window.location.replace(`/${locale}/checkout`);
    }
  }, [goCheckout, locale, setOpen]);

  return (
    <div className="container-tight flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-lg font-semibold text-foreground">
        {cart?.itemCount ? `Your cart · ${cart.itemCount} item(s)` : 'Your cart'}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Review items in the cart panel. Guests can keep shopping — sign in only when you are ready to checkout.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold"
        >
          Open cart
        </button>
        <Link
          href={`/${locale}/checkout`}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Proceed to checkout
        </Link>
        <Link href={`/${locale}/products`} className="text-sm font-semibold text-primary hover:underline">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
