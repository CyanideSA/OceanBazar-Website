'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Search, Loader2, TrendingUp, Clock, X } from 'lucide-react';
import { productsApi } from '@/lib/api';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';
import { getMediaUrl } from '@/lib/mediaUrl';

const RECENT_KEY = 'ob_recent_searches';
const MAX_RECENT = 6;

const TRENDING: Record<string, string[]> = {
  en: ['iPhone', 'Samsung Galaxy', 'Laptop', 'Headphones', 'Smart Watch', 'Camera'],
  bn: ['আইফোন', 'স্যামসাং গ্যালাক্সি', 'ল্যাপটপ', 'হেডফোন', 'স্মার্ট ওয়াচ', 'ক্যামেরা'],
};

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecentSearch(term: string) {
  try {
    const arr = getRecentSearches().filter((s) => s !== term);
    arr.unshift(term);
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}
function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
}

export default function SearchAutocomplete({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounced = useDebouncedValue(query, 280);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trending = TRENDING[locale] ?? TRENDING.en;
  const showSuggestions = open && query.trim().length < 2;
  const showResults = open && query.trim().length >= 2;

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    productsApi
      .list({ search: debounced.trim(), limit: 10, lang: locale })
      .then((r) => { if (!cancelled) setResults(r.data?.products ?? []); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, locale]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => { setActiveIdx(-1); }, [results, query]);

  useEffect(() => {
    if (open) setRecent(getRecentSearches());
  }, [open]);

  const onPick = useCallback((title?: string) => {
    if (title) addRecentSearch(title);
    setOpen(false);
    setQuery('');
  }, []);

  function fillQuery(term: string) {
    setQuery(term);
    setOpen(true);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!showResults || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      const p = results[activeIdx];
      if (p) {
        addRecentSearch(p.title);
        setOpen(false);
        setQuery('');
        router.push(`/${locale}/product/${p.id}`);
      }
    }
  }

  const dropdownOpen = showSuggestions || (showResults && (results.length > 0 || (!loading && debounced.trim().length >= 2)));

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5',
          'transition-all duration-200',
          open && 'border-primary/40 bg-background ring-2 ring-primary/10 shadow-soft',
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={locale === 'bn' ? 'পণ্য খুঁজুন...' : 'Search products...'}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          autoComplete="off"
          aria-expanded={open}
          aria-controls="search-autocomplete-list"
          aria-activedescendant={activeIdx >= 0 ? `search-opt-${activeIdx}` : undefined}
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
        {query && (
          <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-muted-foreground hover:text-foreground" aria-label="Clear">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {dropdownOpen && (
        <div
          id="search-autocomplete-list"
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-[60] mt-2',
            'max-h-[min(70vh,420px)] overflow-auto rounded-xl border border-border/60',
            'bg-popover text-popover-foreground shadow-soft-lg',
            'animate-scale-in',
          )}
        >
          {/* ── Suggestions panel (empty query) ── */}
          {showSuggestions && (
            <div className="py-2">
              {/* Recent searches */}
              {recent.length > 0 && (
                <div className="px-4 pb-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {locale === 'bn' ? 'সাম্প্রতিক' : 'Recent'}
                    </span>
                    <button
                      type="button"
                      onClick={() => { clearRecentSearches(); setRecent([]); }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      {locale === 'bn' ? 'মুছুন' : 'Clear'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => fillQuery(term)}
                        className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending */}
              <div className="px-4 pt-1 pb-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <TrendingUp className="h-3 w-3" />
                  {locale === 'bn' ? 'ট্রেন্ডিং' : 'Trending'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {trending.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => fillQuery(term)}
                      className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <TrendingUp className="h-3 w-3" />
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Search results ── */}
          {showResults && (
            <>
              {results.length === 0 && !loading ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  {locale === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}
                </p>
              ) : (
                <ul className="py-1.5">
                  {results.map((p, idx) => (
                    <li key={p.id} id={`search-opt-${idx}`} role="option" aria-selected={idx === activeIdx}>
                      <Link
                        href={`/${locale}/product/${p.id}`}
                        onClick={() => onPick(p.title)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent',
                          idx === activeIdx && 'bg-accent',
                        )}
                      >
                        <span className="relative flex h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {p.primaryImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getMediaUrl(p.primaryImage)} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-lg text-muted-foreground/40">📦</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 font-medium text-foreground">{p.title}</span>
                          {p.retailPrice != null && (
                            <span className="mt-0.5 block text-xs font-semibold text-primary">৳{Number(p.retailPrice).toLocaleString()}</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
