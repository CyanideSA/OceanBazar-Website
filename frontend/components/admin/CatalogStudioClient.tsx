'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, FileScan, FolderPlus, GripVertical, RefreshCw, Save } from 'lucide-react';
import { adminStudio } from '@/lib/adminApi';
import { cn } from '@/lib/utils';

const DEFAULT_SCAN_PATH =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ADMIN_STUDIO_ROOT
    ? process.env.NEXT_PUBLIC_ADMIN_STUDIO_ROOT
    : 'C:\\Users\\akand\\Desktop\\All Categories (Demo)';

type TreeNode = {
  id: string;
  nameEn: string;
  children: Array<{
    id: string;
    nameEn: string;
    products: Array<{ id: string; titleEn: string; status: string; stock: number }>;
  }>;
};

function flattenSubs(tree: TreeNode[]) {
  const opts: { id: string; label: string }[] = [];
  for (const c of tree) {
    for (const s of c.children) {
      opts.push({ id: s.id, label: `${c.nameEn} › ${s.nameEn}` });
    }
  }
  return opts;
}

export default function CatalogStudioClient() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [scanPath, setScanPath] = useState(DEFAULT_SCAN_PATH);
  const [scanResult, setScanResult] = useState<unknown>(null);

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['admin-catalog-tree'],
    queryFn: () => adminStudio.catalogTree().then((r) => r.data.tree as TreeNode[]),
  });
  const tree = treeData ?? [];

  const { data: brandsData } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => adminStudio.brands().then((r) => r.data.brands as string[]),
  });
  const brands = brandsData ?? [];

  const { data: productData } = useQuery({
    queryKey: ['admin-product', selectedProductId],
    queryFn: () => adminStudio.getProduct(selectedProductId!).then((r) => r.data.product),
    enabled: !!selectedProductId,
  });

  const flatCats = useMemo(() => flattenSubs(tree), [tree]);

  const scanMut = useMutation({
    mutationFn: () => adminStudio.fileScan(scanPath || undefined),
    onSuccess: (r) => setScanResult(r.data),
  });

  const moveMut = useMutation({
    mutationFn: ({ productId, categoryId }: { productId: string; categoryId: string }) =>
      adminStudio.moveProduct(productId, categoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-catalog-tree'] }),
  });

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const onDropProduct = useCallback(
    (e: React.DragEvent, categoryId: string) => {
      e.preventDefault();
      const pid = e.dataTransfer.getData('productId');
      if (pid) moveMut.mutate({ productId: pid, categoryId });
    },
    [moveMut]
  );

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-[560px] flex-col md:flex-row">
      <div className="flex w-full flex-col border-b border-border bg-card md:w-[340px] md:border-b-0 md:border-r">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ['admin-catalog-tree'] })}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              const name = typeof window !== 'undefined' ? window.prompt('New top-level category name (EN)') : null;
              if (!name?.trim()) return;
              adminStudio.createCategory({ nameEn: name.trim(), nameBn: name.trim() }).then(() => {
                qc.invalidateQueries({ queryKey: ['admin-catalog-tree'] });
              });
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Category
          </button>
        </div>
        <div className="max-h-48 space-y-2 overflow-auto border-b border-border p-2 text-xs md:max-h-none md:flex-1 md:border-b-0">
          {isLoading ? (
            <p className="text-muted-foreground">Loading tree…</p>
          ) : (
            <ul className="space-y-0.5 font-mono text-[11px]">
              {tree.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => toggle(`c-${cat.id}`)}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted"
                  >
                    {expanded[`c-${cat.id}`] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="font-semibold text-foreground">{cat.nameEn}</span>
                  </button>
                  {expanded[`c-${cat.id}`] ? (
                    <ul className="ml-3 border-l border-border pl-2">
                      {cat.children.map((sub) => (
                        <li
                          key={sub.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDropProduct(e, sub.id)}
                          className="rounded border border-transparent py-0.5 hover:border-dashed hover:border-primary/40"
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggle(`s-${sub.id}`)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {expanded[`s-${sub.id}`] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategoryId(sub.id);
                                setSelectedProductId(null);
                              }}
                              className="flex-1 truncate text-left text-foreground"
                            >
                              {sub.nameEn}
                            </button>
                          </div>
                          {expanded[`s-${sub.id}`] ? (
                            <ul className="ml-4 mt-0.5 space-y-0.5">
                              {sub.products.map((p) => (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    draggable
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('productId', p.id);
                                      e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onClick={() => {
                                      setSelectedProductId(p.id);
                                      setSelectedCategoryId(null);
                                    }}
                                    className={cn(
                                      'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted',
                                      selectedProductId === p.id && 'bg-primary/15 text-primary'
                                    )}
                                  >
                                    <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{p.titleEn}</span>
                                    <span className="shrink-0 text-[10px] text-muted-foreground">{p.stock}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 p-2 text-xs">
          <p className="font-semibold text-foreground">Folder import (server path)</p>
          <input
            className="w-full rounded border border-border bg-background px-2 py-1 font-mono text-[10px]"
            value={scanPath}
            onChange={(e) => setScanPath(e.target.value)}
            placeholder="Absolute path to All Categories (Demo)"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => scanMut.mutate()}
              disabled={scanMut.isPending}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground"
            >
              <FileScan className="h-3.5 w-3.5" />
              Scan
            </button>
          </div>
          {scanResult ? (
            <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground">
              {JSON.stringify((scanResult as { stats?: unknown }).stats ?? scanResult, null, 2)}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={() =>
              adminStudio
                .fileExecute({ rootPath: scanPath || undefined, dryRun: true })
                .then((r) => setScanResult(r.data))
            }
            className="w-full rounded border border-border py-1 text-[11px]"
          >
            Dry-run import
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && !window.confirm('Run real import from this folder?')) return;
              adminStudio.fileExecute({ rootPath: scanPath || undefined, dryRun: false }).then((r) => {
                setScanResult(r.data);
                qc.invalidateQueries({ queryKey: ['admin-catalog-tree'] });
              });
            }}
            className="w-full rounded border border-destructive/40 bg-destructive/10 py-1 text-[11px] font-semibold text-destructive"
          >
            Execute import (live)
          </button>
        </div>
      </div>

      <div className="min-h-[320px] flex-1 overflow-auto bg-background p-4">
        {selectedProductId && productData ? (
          <ProductEditor
            key={selectedProductId}
            product={productData}
            categories={flatCats}
            brands={brands}
            onSaved={() => qc.invalidateQueries({ queryKey: ['admin-catalog-tree'] })}
          />
        ) : selectedCategoryId ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-medium">Subcategory selected</p>
            <p className="mt-2 text-muted-foreground">ID: {selectedCategoryId}</p>
            <p className="mt-2 text-xs text-muted-foreground">Drag products onto another subcategory to move them.</p>
          </div>
        ) : (
          <p className="text-muted-foreground">Select a product in the tree to edit, or use folder scan on the left.</p>
        )}
      </div>
    </div>
  );
}

function ProductEditor({
  product,
  categories,
  brands,
  onSaved,
}: {
  product: Record<string, unknown> & { id: string; pricing?: Array<Record<string, unknown>>; images?: Array<Record<string, unknown>> };
  categories: { id: string; label: string }[];
  brands: string[];
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const retail = product.pricing?.find((p) => p.customerType === 'retail');
  const wholesale = product.pricing?.find((p) => p.customerType === 'wholesale');
  const n = (v: unknown) => (v == null ? '' : String(v));

  const [titleEn, setTitleEn] = useState(String(product.titleEn ?? ''));
  const [titleBn, setTitleBn] = useState(String(product.titleBn ?? ''));
  const [descEn, setDescEn] = useState(String(product.descriptionEn ?? ''));
  const [descBn, setDescBn] = useState(String(product.descriptionBn ?? ''));
  const [categoryId, setCategoryId] = useState(String(product.categoryId ?? ''));
  const [brand, setBrand] = useState(String(product.brand ?? ''));
  const [brandLogoUrl, setBrandLogoUrl] = useState(String(product.brandLogoUrl ?? ''));
  const [tags, setTags] = useState(Array.isArray(product.tags) ? (product.tags as string[]).join(', ') : '');

  const [tagFeatured, setTagFeatured] = useState(Array.isArray(product.tags) ? (product.tags as string[]).includes('ob_featured') : false);
  const [tagTrending, setTagTrending] = useState(Array.isArray(product.tags) ? (product.tags as string[]).includes('ob_top_trending') : false);
  const [tagBestSeller, setTagBestSeller] = useState(Array.isArray(product.tags) ? (product.tags as string[]).includes('ob_best_seller') : false);
  const [tagMostSold, setTagMostSold] = useState(Array.isArray(product.tags) ? (product.tags as string[]).includes('ob_most_sold') : false);
  const [tagBeauty, setTagBeauty] = useState(Array.isArray(product.tags) ? (product.tags as string[]).includes('ob_beauty') : false);
  const [tagGadgets, setTagGadgets] = useState(Array.isArray(product.tags) ? (product.tags as string[]).includes('ob_gadgets') : false);
  const [tagHome, setTagHome] = useState(Array.isArray(product.tags) ? (product.tags as string[]).includes('ob_home') : false);
  const [tagKids, setTagKids] = useState(Array.isArray(product.tags) ? (product.tags as string[]).includes('ob_kids') : false);
  const [tagMore, setTagMore] = useState(Array.isArray(product.tags) ? (product.tags as string[]).includes('ob_more_for_you') : false);

  const mergedTagsArray = useMemo(() => {
    const base = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const s = new Set(base);
    const set = (key: string, on: boolean) => {
      if (on) s.add(key);
      else s.delete(key);
    };
    set('ob_featured', tagFeatured);
    set('ob_top_trending', tagTrending);
    set('ob_best_seller', tagBestSeller);
    set('ob_most_sold', tagMostSold);
    set('ob_beauty', tagBeauty);
    set('ob_gadgets', tagGadgets);
    set('ob_home', tagHome);
    set('ob_kids', tagKids);
    set('ob_more_for_you', tagMore);
    return [...s];
  }, [tags, tagFeatured, tagTrending, tagBestSeller, tagMostSold, tagBeauty, tagGadgets, tagHome, tagKids, tagMore]);

  const mergedTagsString = useMemo(() => mergedTagsArray.join(', '), [mergedTagsArray]);
  const [stock, setStock] = useState(Number(product.stock ?? 0));
  const [moq, setMoq] = useState(Number(product.moq ?? 1));
  const [status, setStatus] = useState(String(product.status ?? 'draft'));
  const [featured, setFeatured] = useState(Boolean(product.isFeatured));
  const [confirmed, setConfirmed] = useState(false);

  const [rPrice, setRPrice] = useState(n(retail?.price));
  const [rCompare, setRCompare] = useState(n(retail?.compareAt));
  const [rT1, setRT1] = useState({ min: n(retail?.tier1MinQty), d: n(retail?.tier1Discount) });
  const [rT2, setRT2] = useState({ min: n(retail?.tier2MinQty), d: n(retail?.tier2Discount) });
  const [rT3, setRT3] = useState({ min: n(retail?.tier3MinQty), d: n(retail?.tier3Discount) });

  const [wPrice, setWPrice] = useState(n(wholesale?.price));
  const [wCompare, setWCompare] = useState(n(wholesale?.compareAt));
  const [wT1, setWT1] = useState({ min: n(wholesale?.tier1MinQty), d: n(wholesale?.tier1Discount) });
  const [wT2, setWT2] = useState({ min: n(wholesale?.tier2MinQty), d: n(wholesale?.tier2Discount) });
  const [wT3, setWT3] = useState({ min: n(wholesale?.tier3MinQty), d: n(wholesale?.tier3Discount) });
  const [hasWholesale, setHasWholesale] = useState(!!wholesale);

  const [mediaRows, setMediaRows] = useState<{ url: string; type: 'image' | 'video' }[]>(() =>
    (product.images ?? []).map((im) => ({
      url: String(im.url ?? ''),
      type: (im.mediaType as 'image' | 'video') || 'image',
    }))
  );

  const saveMut = useMutation({
    mutationFn: () =>
      adminStudio.updateProduct(product.id, {
        titleEn,
        titleBn,
        descriptionEn: descEn,
        descriptionBn: descBn,
        categoryId,
        brand: brand || null,
        brandLogoUrl: brandLogoUrl || null,
        tags: mergedTagsArray,
        stock,
        moq,
        status,
        isFeatured: featured,
        retail: {
          price: parseFloat(rPrice) || 0,
          compareAt: rCompare ? parseFloat(rCompare) : null,
          tier1MinQty: rT1.min ? parseInt(rT1.min, 10) : 2,
          tier1Discount: rT1.d ? parseFloat(rT1.d) : 5,
          tier2MinQty: rT2.min ? parseInt(rT2.min, 10) : 6,
          tier2Discount: rT2.d ? parseFloat(rT2.d) : 10,
          tier3MinQty: rT3.min ? parseInt(rT3.min, 10) : 11,
          tier3Discount: rT3.d ? parseFloat(rT3.d) : 15,
        },
        wholesale: hasWholesale
          ? {
              price: parseFloat(wPrice) || 0,
              compareAt: wCompare ? parseFloat(wCompare) : null,
              tier1MinQty: wT1.min ? parseInt(wT1.min, 10) : moq,
              tier1Discount: wT1.d ? parseFloat(wT1.d) : 2,
              tier2MinQty: wT2.min ? parseInt(wT2.min, 10) : moq * 3,
              tier2Discount: wT2.d ? parseFloat(wT2.d) : 5,
              tier3MinQty: wT3.min ? parseInt(wT3.min, 10) : moq * 6,
              tier3Discount: wT3.d ? parseFloat(wT3.d) : 8,
            }
          : null,
        images: mediaRows
          .filter((m) => m.url.trim())
          .map((m, i) => ({
            url: m.url.trim(),
            mediaType: m.type,
            isPrimary: i === 0,
            sortOrder: i,
          })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-product', product.id] });
      onSaved();
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Edit product</h2>
        <button
          type="button"
          disabled={!confirmed || saveMut.isPending}
          onClick={() => saveMut.mutate()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>I confirm these catalog changes are correct.</span>
      </label>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">Name (EN)</span>
          <input className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">Name (BN)</span>
          <input className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={titleBn} onChange={(e) => setTitleBn(e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">Description (EN)</span>
          <textarea className="mt-1 min-h-[100px] w-full rounded border border-border px-2 py-1.5 text-sm" value={descEn} onChange={(e) => setDescEn(e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">Description (BN)</span>
          <textarea className="mt-1 min-h-[80px] w-full rounded border border-border px-2 py-1.5 text-sm" value={descBn} onChange={(e) => setDescBn(e.target.value)} />
        </label>
        <label>
          <span className="text-xs text-muted-foreground">Subcategory</span>
          <select className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs text-muted-foreground">Brand</span>
          <input className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={brand} onChange={(e) => setBrand(e.target.value)} list="brand-list" />
          <datalist id="brand-list">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>
        <label className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">Brand logo URL</span>
          <input className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={brandLogoUrl} onChange={(e) => setBrandLogoUrl(e.target.value)} placeholder="https://..." />
        </label>
        <label className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">Tags (comma-separated)</span>
          <input className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={mergedTagsString} onChange={(e) => setTags(e.target.value)} />
        </label>

        <div className="sm:col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collection overrides</p>
          <p className="mt-1 text-xs text-muted-foreground">These tags manually place a product into storefront collections (auto-detection still applies).</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tagFeatured} onChange={(e) => setTagFeatured(e.target.checked)} /> Featured</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tagTrending} onChange={(e) => setTagTrending(e.target.checked)} /> Top trending</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tagBestSeller} onChange={(e) => setTagBestSeller(e.target.checked)} /> Best seller</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tagMostSold} onChange={(e) => setTagMostSold(e.target.checked)} /> Most sold</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tagBeauty} onChange={(e) => setTagBeauty(e.target.checked)} /> Beauty</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tagGadgets} onChange={(e) => setTagGadgets(e.target.checked)} /> Gadgets</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tagHome} onChange={(e) => setTagHome(e.target.checked)} /> Home</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tagKids} onChange={(e) => setTagKids(e.target.checked)} /> Kids</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tagMore} onChange={(e) => setTagMore(e.target.checked)} /> More for you</label>
          </div>
        </div>
        <label>
          <span className="text-xs text-muted-foreground">Stock</span>
          <input type="number" className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={stock} onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)} />
        </label>
        <label>
          <span className="text-xs text-muted-foreground">MOQ</span>
          <input type="number" className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={moq} onChange={(e) => setMoq(parseInt(e.target.value, 10) || 1)} />
        </label>
        <label>
          <span className="text-xs text-muted-foreground">Status</span>
          <select className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pt-6">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          <span className="text-sm">Featured</span>
        </label>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Retail pricing</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label>
            <span className="text-xs text-muted-foreground">Current price</span>
            <input className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={rPrice} onChange={(e) => setRPrice(e.target.value)} />
          </label>
          <label>
            <span className="text-xs text-muted-foreground">Compare-at (was)</span>
            <input className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={rCompare} onChange={(e) => setRCompare(e.target.value)} />
          </label>
        </div>
        <p className="mt-3 text-xs font-medium text-muted-foreground">Volume tiers (min qty / % off)</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          <div className="flex gap-1">
            <input placeholder="T1 min" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={rT1.min} onChange={(e) => setRT1({ ...rT1, min: e.target.value })} />
            <input placeholder="T1 %" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={rT1.d} onChange={(e) => setRT1({ ...rT1, d: e.target.value })} />
          </div>
          <div className="flex gap-1">
            <input placeholder="T2 min" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={rT2.min} onChange={(e) => setRT2({ ...rT2, min: e.target.value })} />
            <input placeholder="T2 %" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={rT2.d} onChange={(e) => setRT2({ ...rT2, d: e.target.value })} />
          </div>
          <div className="flex gap-1">
            <input placeholder="T3 min" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={rT3.min} onChange={(e) => setRT3({ ...rT3, min: e.target.value })} />
            <input placeholder="T3 %" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={rT3.d} onChange={(e) => setRT3({ ...rT3, d: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <label className="mb-3 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={hasWholesale} onChange={(e) => setHasWholesale(e.target.checked)} />
          Wholesale pricing
        </label>
        {hasWholesale ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <label>
                <span className="text-xs text-muted-foreground">Wholesale price</span>
                <input className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={wPrice} onChange={(e) => setWPrice(e.target.value)} />
              </label>
              <label>
                <span className="text-xs text-muted-foreground">Compare-at</span>
                <input className="mt-1 w-full rounded border border-border px-2 py-1.5 text-sm" value={wCompare} onChange={(e) => setWCompare(e.target.value)} />
              </label>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="flex gap-1">
                <input placeholder="W1 min" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={wT1.min} onChange={(e) => setWT1({ ...wT1, min: e.target.value })} />
                <input placeholder="W1 %" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={wT1.d} onChange={(e) => setWT1({ ...wT1, d: e.target.value })} />
              </div>
              <div className="flex gap-1">
                <input placeholder="W2 min" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={wT2.min} onChange={(e) => setWT2({ ...wT2, min: e.target.value })} />
                <input placeholder="W2 %" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={wT2.d} onChange={(e) => setWT2({ ...wT2, d: e.target.value })} />
              </div>
              <div className="flex gap-1">
                <input placeholder="W3 min" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={wT3.min} onChange={(e) => setWT3({ ...wT3, min: e.target.value })} />
                <input placeholder="W3 %" className="w-1/2 rounded border border-border px-1 py-1 text-xs" value={wT3.d} onChange={(e) => setWT3({ ...wT3, d: e.target.value })} />
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 font-semibold">Media (URL or upload via static hosting)</h3>
        {mediaRows.map((row, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <select className="rounded border border-border px-1 text-xs" value={row.type} onChange={(e) => {
              const next = [...mediaRows];
              next[i] = { ...row, type: e.target.value as 'image' | 'video' };
              setMediaRows(next);
            }}>
              <option value="image">image</option>
              <option value="video">video</option>
            </select>
            <input
              className="flex-1 rounded border border-border px-2 py-1 text-xs"
              value={row.url}
              onChange={(e) => {
                const next = [...mediaRows];
                next[i] = { ...row, url: e.target.value };
                setMediaRows(next);
              }}
              placeholder="https://..."
            />
            <button
              type="button"
              className="text-xs text-destructive"
              onClick={() => setMediaRows(mediaRows.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="text-xs text-primary" onClick={() => setMediaRows([...mediaRows, { url: '', type: 'image' }])}>
          + Add media URL
        </button>
      </section>

      <section className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
        <h3 className="mb-2 text-sm font-semibold">Preview</h3>
        <div className="flex gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
            {mediaRows[0]?.url ? <img src={mediaRows[0].url} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div>
            <p className="font-semibold">{titleEn || 'Product name'}</p>
            <p className="text-sm text-primary">
              ৳{rPrice || '0'} {rCompare ? <span className="text-muted-foreground line-through">৳{rCompare}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{brand || 'Brand'}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
