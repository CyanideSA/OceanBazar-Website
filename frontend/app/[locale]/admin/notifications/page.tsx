'use client';

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <p className="max-w-lg text-sm text-muted-foreground">
        Centralized admin notifications (email/SMS/push) can be wired to your messaging providers. Customer-facing notifications remain in the storefront account area; use{' '}
        <strong>Analytics</strong> and <strong>Tickets</strong> for operational alerts.
      </p>
    </div>
  );
}
