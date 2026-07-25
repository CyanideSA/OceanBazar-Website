'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function GlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border/60 bg-card shadow-lg', className)}>
      {children}
    </div>
  );
}
