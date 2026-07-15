export default function ProductDetailLoading() {
  return (
    <div className="container-tight flex min-h-[50vh] flex-col items-center justify-center gap-3 py-12">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden
      />
      <p className="text-sm font-medium text-muted-foreground">Loading product…</p>
    </div>
  );
}
