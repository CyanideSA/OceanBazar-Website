'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  count?: number;
  size?: 'sm' | 'md';
}

export default function ProductStarRating({ value, count, size = 'md' }: Props) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < full || (i === full && half);
        return (
          <Star
            key={i}
            className={cn(dim, filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
          />
        );
      })}
      {count != null && <span className="text-sm text-muted-foreground">({count})</span>}
    </div>
  );
}
