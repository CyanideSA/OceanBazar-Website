'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useShopRouter } from '@/lib/shopNavigation';
import { useLocale } from 'next-intl';
import { Search, Loader2, TrendingUp, Clock, X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMediaUrl } from '@/lib/mediaUrl';
import { resolvePublicApiBase } from '@/lib/api';

const RECENT_KEY = 'ob_recent_searches';
const MAX_RECENT = 6;

interface Suggestion {
  id: string;
  title: string;
  price: number | null;
  image: string | null;
  category: string | null;
}

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

async function fetchSuggestions(q: string, lang: string): Promise<Suggestion[]> {
  try {
    const res = await fetch(`${resolvePublicApiBase()}/api/search/suggest?q=${encodeURIComponent(q)}&lang=${lang}&limit=8`);
    const data = await res.json();
    return data.suggestions ?? [];
  } catch { return []; }
}

async function fetchTrending(lang: string): Promise<string[]> {
  try {
    const res = await fetch(`${resolvePublicApiBase()}/api/search/trending?lang=${lang}&limit=8`);
    const data = await res.json();
    return data.trending ?? [];
  } catch {
    return lang === 'bn'
      ? ['আইফোন', 'স্যামসাং', 'ল্যাপটপ', 'হেডফোন', 'স্মার্ট ওয়াচ']
      : ['iPhone', 'Samsung Galaxy', 'Laptop', 'Headphones', 'Smart Watch'];
  }
}

export default function SearchAutocomplete({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useShopRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounced = useDebouncedValue(query, 250);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch trending on open (once)
  const trendingFetched = useRef(false);
  useEffect(() => {
    if (open && !trendingFetched.current) {
      trendingFetched.current = true;
      fetchTrending(locale).then(setTrending);
    }
    if (open) setRecent(getRecentSearches());
  }, [open, locale]);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSuggestions(debounced.trim(), locale)
      .then((r) => { if (!cancelled) setResults(r); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, locale]);

  // Click outside closes dropdown
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => { setActiveIdx(-1); }, [results, query]);

  const onPick = useCallback((title?: string) => {
    if (title) addRecentSearch(title);
    setOpen(false);
    setQuery('');
  }, []);

  function navigateToSearch(term: string) {
    addRecentSearch(term);
    setOpen(false);
    setQuery('');
    // Log search for analytics
    fetch(`${resolvePublicApiBase()}/api/search/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: term }),
      keepalive: true,
    }).catch(() => {});
    router.push(`/${locale}/products?search=${encodeURIComponent(term)}`);
  }

  function fillQuery(term: string) {
    setQuery(term);
    setOpen(true);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    const showResults = query.trim().length >= 2 && results.length > 0;
    if (!showResults) {
      if (e.key === 'Enter' && query.trim().length >= 2) {
        e.preventDefault();
        navigateToSearch(query.trim());
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0) {
        const p = results[activeIdx];
        if (p) { onPick(p.title); router.push(`/${locale}/product/${p.id}`); }
      } else {
        navigateToSearch(query.trim());
      }
    }
  }

  const showSuggestions = open && query.trim().length < 2;
  const showResults = open && query.trim().length >= 2;
  const dropdownOpen = showSuggestions || (showResults && (results.length > 0 || (!loading && debounced.trim().length >= 2)));

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 sm:gap-2.5 sm:rounded-xl sm:px-3.5 sm:py-2.5',
          'transition-all duration-200 shadow-sm dark:shadow-none dark:ring-1 dark:ring-primary/20 dark:bg-muted/20',
          open && 'border-primary/40 bg-background ring-2 ring-primary/10 shadow-md dark:shadow-none dark:ring-2 dark:ring-primary/40 dark:shadow-[0_0_12px_rgba(var(--primary-rgb,59,130,246),0.25)]',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground sm:h-4 sm:w-4" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={locale === 'bn' ? 'খুঁজুন...' : 'Search...'}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none sm:text-sm sm:placeholder:text-muted-foreground/60"
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
            'max-h-[min(70vh,440px)] overflow-auto rounded-xl border border-border/60',
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

              {/* Trending (dynamic from backend) */}
              <div className="px-4 pt-1 pb-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  <TrendingUp className="h-3 w-3" />
                  {locale === 'bn' ? 'ট্রেন্ডিং' : 'Trending'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(trending.length > 0 ? trending : ['...loading']).map((term) => (
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

          {/* ── Live search results ── */}
          {showResults && (
            <>
              {results.length === 0 && !loading ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {locale === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products found'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    {locale === 'bn' ? 'সব পণ্য দেখতে এন্টার চাপুন' : 'Press Enter to browse all products'}
                  </p>
                </div>
              ) : (
                <>
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
                            {p.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getMediaUrl(p.image)} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-lg text-muted-foreground/40">📦</span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-1 font-medium text-foreground">{p.title}</span>
                            <span className="flex items-center gap-2 mt-0.5">
                              {p.price != null && (
                                <span className="text-xs font-semibold text-primary">৳{Number(p.price).toLocaleString()}</span>
                              )}
                              {p.category && (
                                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <Tag className="h-2.5 w-2.5" />{p.category}
                                </span>
                              )}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {/* See all results */}
                  <div className="border-t border-border/40 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => navigateToSearch(query.trim())}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      <Search className="h-3.5 w-3.5" />
                      {locale === 'bn' ? `"${query}" এর সব ফলাফল দেখুন` : `See all results for "${query}"`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

