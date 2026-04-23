'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCartStore } from '@/stores/cartStore';

export default function CartPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { setOpen, cart } = useCartStore();

  useEffect(() => {
    if (cart && cart.itemCount > 0) {
      setOpen(true);
    }
    router.replace(`/${locale}/checkout`);
  }, []);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-muted-foreground animate-pulse">Redirecting to checkout...</p>
    </div>
  );
}
