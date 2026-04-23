import CatalogStudioClient from '@/components/admin/CatalogStudioClient';

export default function AdminCatalogPage() {
  return (
    <div className="h-full min-h-screen">
      <div className="border-b border-border bg-muted/50 px-4 py-3">
        <h1 className="text-lg font-semibold">Catalog Studio</h1>
        <p className="text-xs text-muted-foreground">
          Tree = database catalog. Drag products onto another subfolder to reassign. Folder scan uses the server path (set ADMIN_STUDIO_ROOT or paste path).
        </p>
      </div>
      <CatalogStudioClient />
    </div>
  );
}
