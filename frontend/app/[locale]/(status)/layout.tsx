/**
 * Lightweight layout for system status pages (maintenance, generic oops).
 * Intentionally outside (shop) — no catalog chrome, no navigation loading shell.
 */
export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen antialiased">{children}</div>;
}
