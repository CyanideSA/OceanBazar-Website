'use client';

import { useQuery } from '@tanstack/react-query';
import { adminStudio } from '@/lib/adminApi';

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => adminStudio.analytics().then((r) => r.data),
  });

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="text-sm text-muted-foreground">Aggregated from orders (last ~30 days where applicable).</p>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <pre className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-muted/30 p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}
