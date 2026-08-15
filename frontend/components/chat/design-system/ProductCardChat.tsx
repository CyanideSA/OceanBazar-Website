'use client';

import Image from 'next/image';
import { ShoppingCart, ExternalLink } from 'lucide-react';

export interface ProductCardData {
  id: string;
  name: string;
  price: number;
  image?: string;
  rating?: number;
  stock?: number;
  url?: string;
}

interface Props {
  products: ProductCardData[];
  onAction: (action: string, payload: Record<string, unknown>) => void;
}

export function ProductCardChat({ products, onAction }: Props) {
  return (
    <div className="mt-2 space-y-2">
      {products.map((p) => (
        <div key={p.id} className="flex gap-2 rounded-xl border border-border/70 bg-background/80 p-2 shadow-sm">
          <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg bg-muted">
            {p.image ? (
              <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">No img</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{p.name}</p>
            <p className="text-xs font-bold text-primary">৳{p.price.toLocaleString()}</p>
            {p.rating != null && <p className="text-[10px] text-muted-foreground">★ {p.rating.toFixed(1)}</p>}
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                onClick={() => onAction('add_to_cart', { productId: p.id })}
                className="inline-flex items-center gap-0.5 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground"
              >
                <ShoppingCart className="h-3 w-3" /> Add
              </button>
              {p.url && (
                <a href={p.url} className="inline-flex items-center gap-0.5 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-foreground">
                  <ExternalLink className="h-3 w-3" /> View
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
