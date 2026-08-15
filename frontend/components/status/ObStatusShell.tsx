'use client';

import type { ReactNode } from 'react';

/** Shared full-viewport backdrop for maintenance / error status routes (OceanBazar blue palette). */
export default function ObStatusShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-25%,rgba(56,189,248,0.2),transparent_55%),radial-gradient(ellipse_90%_70%_at_100%_100%,rgba(30,58,138,0.35),transparent_50%),radial-gradient(ellipse_70%_60%_at_0%_90%,rgba(14,165,233,0.12),transparent_45%)]"
      />
      <div
        aria-hidden
        className="absolute -left-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-sky-500/[0.12] blur-3xl motion-safe:animate-pulse"
      />
      <div
        aria-hidden
        className="absolute -right-20 bottom-0 h-[22rem] w-[22rem] rounded-full bg-blue-600/[0.15] blur-3xl motion-safe:animate-pulse"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(2,6,23,0.85))]" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-14 sm:px-8">
        {children}
      </div>
    </div>
  );
}
