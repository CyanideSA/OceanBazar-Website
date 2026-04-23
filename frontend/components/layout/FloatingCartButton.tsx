'use client';

import { useEffect, useRef, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { cn } from '@/lib/utils';

export default function FloatingCartButton() {
  const { cart, setOpen, isOpen } = useCartStore();
  const count = cart?.itemCount ?? 0;
  const subtotal = cart?.subtotal ?? 0;
  const [bounce, setBounce] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setBounce(true);
      const id = setTimeout(() => setBounce(false), 600);
      return () => clearTimeout(id);
    }
    prevCount.current = count;
  }, [count]);

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'fixed right-0 top-1/2 -translate-y-1/2 z-[45]',
        'flex flex-col items-center gap-1 rounded-l-2xl px-3 py-3.5',
        'bg-primary text-primary-foreground shadow-lg',
        'border border-r-0 border-primary-foreground/10',
        'transition-all hover:pr-5 hover:shadow-glow-primary active:scale-95',
        'focus-ring',
        bounce && 'animate-bounce-once',
      )}
      aria-label="Open cart"
    >
      <span className="relative inline-flex">
        <ShoppingCart className="h-5 w-5" />
        {count > 0 && (
          <span
            className={cn(
              'absolute -right-2.5 -top-2.5 flex h-5 min-w-[1.25rem] items-center justify-center',
              'rounded-full bg-destructive px-1 text-2xs font-bold text-destructive-foreground',
              'shadow-sm ring-2 ring-primary',
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      {subtotal > 0 && (
        <span className="mt-1 text-2xs font-bold leading-none opacity-90">
          ৳{subtotal > 9999 ? `${Math.round(subtotal / 1000)}k` : subtotal.toLocaleString()}
        </span>
      )}
    </button>
  );
}
