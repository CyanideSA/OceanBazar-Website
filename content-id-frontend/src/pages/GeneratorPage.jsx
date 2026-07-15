import { useCallback, useEffect, useState } from "react";
import { LogOut, RefreshCw, Sparkles } from "lucide-react";
import OceanBackground from "../components/OceanBackground";
import CatalogBrowser from "../components/CatalogBrowser";
import CatalogPicker from "../components/CatalogPicker";
import RecentIds, { CopyButton } from "../components/RecentIds";
import { contentIdApi } from "../lib/api";

const EMPTY_SELECTION = {
  categoryId: "",
  subcategoryId: "",
  brandId: "",
};

export default function GeneratorPage({ user, onLogout }) {
  const [productName, setProductName] = useState("");
  const [socialRef, setSocialRef] = useState("");
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [catalog, setCatalog] = useState({ categories: [], brands: [] });
  const [drafts, setDrafts] = useState([]);
  const [result, setResult] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalogLoadError, setCatalogLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogLoadError("");
    try {
      const data = await contentIdApi.catalog();
      setCatalog(data);
    } catch {
      setCatalogLoadError("Could not load catalog");
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();

    contentIdApi
      .mine()
      .then((res) => setDrafts(res.drafts || []))
      .catch(() => {})
      .finally(() => setLoadingMine(false));
  }, [loadCatalog]);

  const catalogEmpty =
    !loadingCatalog &&
    !catalogLoadError &&
    !catalog.categories?.length &&
    !catalog.brands?.length;

  function updateSelection(patch) {
    setSelection((prev) => ({ ...prev, ...patch }));
    setFormError("");
  }

  function handleBrowserSelect(patch) {
    setSelection((prev) => ({ ...prev, ...patch }));
    setFormError("");
  }

  function showNotice(message, isError = false) {
    if (isError) setFormError(message);
    else {
      setNotice(message);
      setTimeout(() => setNotice(""), 4000);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selection.categoryId || !selection.subcategoryId || !selection.brandId) {
      setFormError("Please select category, subcategory, and brand from the catalog.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    setResult(null);
    try {
      const created = await contentIdApi.generate({
        productName,
        categoryId: selection.categoryId,
        subcategoryId: selection.subcategoryId,
        brandId: selection.brandId,
        socialRef: socialRef || undefined,
      });
      setResult(created);
      setProductName("");
      setSocialRef("");
      setSelection(EMPTY_SELECTION);
      const mine = await contentIdApi.mine();
      setDrafts(mine.drafts || []);
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.[0]?.msg ||
        err?.response?.data?.error ||
        "Could not generate product ID. Please try again.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OceanBackground>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src="/ob-brand-logo.png" alt="OceanBazar" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-bold text-white sm:text-2xl">OceanBazar Content ID</h1>
              <p className="text-sm text-blue-100">Signed in as {user?.name || user?.email}</p>
            </div>
          </div>
          <button type="button" onClick={onLogout} className="ob-btn ob-btn-secondary self-start">
            <LogOut size={16} />
            Sign out
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="ob-card p-6 shadow-soft-lg">
              <div className="mb-6 flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <h2 className="text-lg font-bold">Generate product ID</h2>
              </div>

              {notice && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  {notice}
                </div>
              )}

              {catalogEmpty && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  No products in catalog yet — add your first product details below.
                </div>
              )}

              {catalogLoadError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{catalogLoadError}</span>
                    <button
                      type="button"
                      onClick={loadCatalog}
                      className="ob-btn ob-btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
                    >
                      <RefreshCw size={14} />
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {formError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Product name *
                  </span>
                  <input
                    className="ob-input"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Samsung Galaxy A54 128GB"
                  />
                </label>

                {loadingCatalog ? (
                  <p className="text-sm text-muted-foreground">Loading catalog…</p>
                ) : (
                  <CatalogPicker
                    catalog={catalog}
                    selection={selection}
                    onChange={updateSelection}
                    onRefreshCatalog={loadCatalog}
                    onNotice={showNotice}
                  />
                )}

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Social post link (optional)
                  </span>
                  <input
                    className="ob-input"
                    type="url"
                    value={socialRef}
                    onChange={(e) => setSocialRef(e.target.value)}
                    placeholder="https://facebook.com/... or Instagram post URL"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || loadingCatalog || Boolean(catalogLoadError)}
                className="ob-btn ob-btn-primary mt-6 w-full py-3"
              >
                {submitting ? "Generating…" : "Generate OceanBazar Product ID"}
              </button>
            </form>

            {result && (
              <div className="ob-card mt-6 border-primary/30 p-6 shadow-glow-primary">
                <p className="text-sm font-medium text-muted-foreground">Your OceanBazar Product ID</p>
                <p className="mt-2 font-mono text-3xl font-bold tracking-wide text-primary sm:text-4xl">
                  {result.displayId}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Raw ID: {result.id}</p>
                <p className="mt-4 text-sm text-foreground">
                  <span className="font-semibold">{result.productName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {result.categoryName} / {result.subcategoryName} · {result.brandName}
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <CopyButton value={result.displayId} label="Copy ID" />
                  <CopyButton value={result.id} label="Copy raw ID" />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  This ID is reserved for life. Use it on Facebook and Instagram posts — it will merge
                  into the OceanBazar catalog when the system goes live.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6 lg:col-span-2">
            {!loadingCatalog && !catalogLoadError && (
              <CatalogBrowser
                catalog={catalog}
                selection={selection}
                onSelect={handleBrowserSelect}
              />
            )}
            <RecentIds drafts={drafts} loading={loadingMine} />
          </div>
        </div>
      </div>
    </OceanBackground>
  );
}
