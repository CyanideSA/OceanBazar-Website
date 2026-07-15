'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function GlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('glass rounded-2xl border border-border/60 shadow-lg backdrop-blur-xl', className)}>
      {children}
    </div>
  );
}
