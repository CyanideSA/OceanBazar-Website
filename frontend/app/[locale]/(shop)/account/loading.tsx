export default function AccountSegmentLoading() {
  return (
    <div className="container-tight py-10">
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">Loading account…</p>
      </div>
    </div>
  );
}
