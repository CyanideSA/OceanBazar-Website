import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { TrendingUp, Shield, Zap, ArrowRight, LayoutGrid, Percent, Sparkles, Search, Layers } from 'lucide-react';
import { toast } from '../hooks/use-toast';
import { productAPI, categoryAPI } from '../api/service';
import { getApiErrorMessage } from '@/utils/apiError';
import { logger } from '@/utils/logger';
import { CATEGORY_FALLBACK } from '../constants/categories';
import { getCategoryIcon } from '../utils/categoryIcons';
import { useWishlist } from '../context/WishlistContext';
import { useCustomerInbox } from '../context/CustomerInboxContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import WaveBannerCarousel, { WaveDivider } from '../components/WaveBannerCarousel';
import TestimonialCarousel from '../components/TestimonialCarousel';
import TrustBadgeStrip from '../components/TrustBadgeStrip';

const MIN_ROWS = 15;
const PRODUCTS_PER_ROW_DESKTOP = 8;
const MIN_PRODUCTS_PER_PAGE = MIN_ROWS * PRODUCTS_PER_ROW_DESKTOP;
const PRODUCTS_PER_PAGE_LS_KEY = "oceanBazar_products_per_page";

const HomePage = ({ onAddToCart }) => {
  const navigate = useNavigate();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const { catalogLive } = useCustomerInbox();
  const site = useSiteSettings();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [featuredSales, setFeaturedSales] = useState([]);
  const [categories, setCategories] = useState([]);

  const [productsPerPage, setProductsPerPage] = useState(() => {
    const saved = localStorage.getItem(PRODUCTS_PER_PAGE_LS_KEY);
    const n = saved ? Number(saved) : NaN;
    if (Number.isFinite(n) && n > 0) return Math.max(n, MIN_PRODUCTS_PER_PAGE);
    return MIN_PRODUCTS_PER_PAGE;
  });

  const effectivePerPage = Math.max(Number(productsPerPage) || MIN_PRODUCTS_PER_PAGE, MIN_PRODUCTS_PER_PAGE);
  const [featuredPage, setFeaturedPage] = useState(1);
  const [featuredHasMore, setFeaturedHasMore] = useState(true);
  const [featuredLoadingMore, setFeaturedLoadingMore] = useState(false);

  const [featuredSalesPage, setFeaturedSalesPage] = useState(1);
  const [featuredSalesHasMore, setFeaturedSalesHasMore] = useState(true);
  const [featuredSalesLoadingMore, setFeaturedSalesLoadingMore] = useState(false);

  const [newArrivals, setNewArrivals] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const frequentlySearched = ['Smart TVs', 'Electric Cars', 'Laptops', 'Mobile Phones', 'LED Lights', 'Solar Panels'];

  const fetchData = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [categoriesRes, featuredRes, featuredSalesRes] = await Promise.all([
        categoryAPI.getAll(),
        productAPI.getAll({ limit: effectivePerPage, page: 1 }),
        productAPI.getAll({ featuredSale: true, limit: effectivePerPage, page: 1 })
      ]);

      setFeaturedProducts(featuredRes.data.products || []);
      const rawCats = categoriesRes.data;
      const catList = Array.isArray(rawCats) ? rawCats : [];
      setCategories(catList.length > 0 ? catList : CATEGORY_FALLBACK);
      setFeaturedPage(1);
      setFeaturedHasMore((featuredRes.data.products || []).length === effectivePerPage);

      setFeaturedSales(featuredSalesRes.data.products || []);
      setFeaturedSalesPage(1);
      setFeaturedSalesHasMore((featuredSalesRes.data.products || []).length === effectivePerPage);
    } catch (error) {
      logger.error('Error fetching data:', error);
      const msg = getApiErrorMessage(error, 'Unable to load home feed.');
      setError(msg);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [effectivePerPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const heroSlides = (site.heroSlides || []).filter((s) => s && s.imageUrl);

  useEffect(() => {
    if (site.loading) return;
    const ids = (site.featuredProductIds || []).filter(Boolean);
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await Promise.all(
          ids.slice(0, 48).map((id) => productAPI.getById(String(id).trim()).then((r) => r.data).catch(() => null))
        );
        if (!cancelled) setFeaturedProducts(rows.filter(Boolean));
      } catch {
        /* keep feed from fetchData */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [site.loading, (site.featuredProductIds || []).join('|')]);

  useEffect(() => {
    if (site.loading) return;
    const ids = (site.bestDealsProductIds || []).filter(Boolean);
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await Promise.all(
          ids.slice(0, 48).map((id) => productAPI.getById(String(id).trim()).then((r) => r.data).catch(() => null))
        );
        if (!cancelled) setFeaturedSales(rows.filter(Boolean));
      } catch {
        /* keep */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [site.loading, (site.bestDealsProductIds || []).join('|')]);

  useEffect(() => {
    if (site.loading) return;
    const ids = (site.newArrivalsProductIds || []).filter(Boolean);
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await Promise.all(
          ids.slice(0, 48).map((id) => productAPI.getById(String(id).trim()).then((r) => r.data).catch(() => null))
        );
        if (!cancelled) setNewArrivals(rows.filter(Boolean));
      } catch {
        /* keep */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [site.loading, (site.newArrivalsProductIds || []).join('|')]);

  const catalogSeqSeenRef = useRef(null);
  useEffect(() => {
    if (catalogSeqSeenRef.current === null) {
      catalogSeqSeenRef.current = catalogLive.seq;
      return;
    }
    if (catalogLive.seq === catalogSeqSeenRef.current) return;
    catalogSeqSeenRef.current = catalogLive.seq;
    if (!catalogLive.seq) return;
    fetchData();
  }, [catalogLive.seq, fetchData]);

  const mergeUniqueProducts = (prev, next) => {
    const map = new Map();
    [...prev, ...next].forEach((p) => {
      const key = p?._id || p?.id;
      if (!key) return;
      map.set(key, p);
    });
    return Array.from(map.values());
  };

  const showMoreFeatured = async () => {
    if (!featuredHasMore || featuredLoadingMore) return;
    setFeaturedLoadingMore(true);
    try {
      const nextPage = featuredPage + 1;
      const res = await productAPI.getAll({ limit: effectivePerPage, page: nextPage });
      const newProducts = res.data.products || [];
      setFeaturedProducts((prev) => mergeUniqueProducts(prev, newProducts));
      setFeaturedPage(nextPage);
      setFeaturedHasMore(newProducts.length === effectivePerPage);
    } catch (e) {
      toast({
        title: 'Error',
        description: e?.response?.data?.detail || 'Failed to load more products.',
        variant: 'destructive'
      });
    } finally {
      setFeaturedLoadingMore(false);
    }
  };

  const showMoreFeaturedSales = async () => {
    if (!featuredSalesHasMore || featuredSalesLoadingMore) return;
    setFeaturedSalesLoadingMore(true);
    try {
      const nextPage = featuredSalesPage + 1;
      const res = await productAPI.getAll({ featuredSale: true, limit: effectivePerPage, page: nextPage });
      const newProducts = res.data.products || [];
      setFeaturedSales((prev) => mergeUniqueProducts(prev, newProducts));
      setFeaturedSalesPage(nextPage);
      setFeaturedSalesHasMore(newProducts.length === effectivePerPage);
    } catch (e) {
      toast({
        title: 'Error',
        description: e?.response?.data?.detail || 'Failed to load more featured sales.',
        variant: 'destructive'
      });
    } finally {
      setFeaturedSalesLoadingMore(false);
    }
  };

  const handleCategoryClick = (categoryName) => {
    navigate(`/products?category=${encodeURIComponent(categoryName)}`);
  };

  const handleAddToCart = (product) => {
    onAddToCart(product);
    toast({
      title: 'Added to cart',
      description: `${product.name} has been added to your cart.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-8">
          <div className="h-44 rounded-2xl bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/50 animate-pulse mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 p-4 animate-pulse">
                <div className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-700 mb-3" />
                <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded mb-2" />
                <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 overflow-x-hidden">
      {/* Subtle tab bar */}
      <div className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 py-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="px-1 py-3 text-sm font-semibold text-[#5BA3D0] border-b-2 border-[#5BA3D0] flex-shrink-0 hover:opacity-90 transition-opacity"
            >
              All products
            </button>
            <button
              type="button"
              onClick={() => {
                navigate('/products?featuredSale=true');
              }}
              className="px-1 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#5BA3D0] flex-shrink-0 border-b-2 border-transparent hover:border-[#5BA3D0]/30 transition-all duration-200"
            >
              Featured sales
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Category sidebar */}
          <div className="w-full lg:w-60 xl:w-64 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft p-5 border border-gray-100 dark:border-gray-800 lg:sticky lg:top-40 animate-fade-in">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#5BA3D0] shrink-0" aria-hidden />
                Categories
              </h3>
              <button
                type="button"
                onClick={() => navigate('/products')}
                className="w-full mb-4 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-[#5BA3D0] hover:bg-[#4A90B8] transition-colors duration-200"
              >
                Browse all categories
              </button>
              <div className="space-y-0.5">
                {categories.map((category) => {
                  const CatIcon = getCategoryIcon(category.icon);
                  return (
                    <button
                      key={category.id || category.name}
                      type="button"
                      onClick={() => handleCategoryClick(category.name)}
                      className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors duration-150 group text-left"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <CatIcon className="w-4 h-4 shrink-0 text-[#5BA3D0] opacity-70 group-hover:opacity-100 transition-opacity" aria-hidden />
                        <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white truncate transition-colors">
                          {category.name}
                        </span>
                      </span>
                      {typeof category.count === 'number' ? (
                        <span className="text-xs text-gray-400 shrink-0">{category.count}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Hero — wave slide carousel (Global settings → hero JSON) or branded default */}
            <div className="animate-slide-up">
              {heroSlides.length > 0 ? (
                <WaveBannerCarousel slides={heroSlides} rotationMs={site.defaultBannerRotationMs || 6000} variant="hero" />
              ) : (
                <div className="relative mb-8 min-h-[220px] sm:min-h-[260px] overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#4A90B8] via-[#5BA3D0] to-[#8EC5E3]" />
                  <div
                    className="absolute inset-0 opacity-[0.08]"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
                      backgroundSize: '60px 60px',
                    }}
                  />
                  <div className="relative z-[2] px-6 sm:px-8 lg:px-12 py-8 sm:py-10 text-white">
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur border border-white/20">
                      <Zap className="h-3.5 w-3.5" aria-hidden />
                      OceanBazar marketplace
                    </div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight max-w-xl">Welcome to OceanBazar.com.bd</h1>
                    <p className="mt-2 text-sm sm:text-base text-white/90 max-w-xl leading-relaxed">
                      B2B and retail sourcing with curated catalogs, secure payments, and delivery partners you can track.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      {[
                        { icon: TrendingUp, label: 'Volume pricing' },
                        { icon: Shield, label: 'Buyer protections' },
                        { icon: Zap, label: 'Fast dispatch' },
                      ].map(({ icon: Icon, label }) => (
                        <div
                          key={label}
                          className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/12 px-4 py-2.5 backdrop-blur-sm transition-colors hover:bg-white/18"
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="text-sm font-medium whitespace-nowrap">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <WaveDivider />
                </div>
              )}
            </div>

            {/* Frequently searched */}
            <div className="mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-5 w-5 text-[#5BA3D0] shrink-0" aria-hidden />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Frequently searched</h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Jump into popular B2B and retail categories.</p>
              <div className="flex flex-wrap gap-2">
                {frequentlySearched.map((term, index) => (
                  <button
                    key={index}
                    onClick={() => navigate(`/products?search=${encodeURIComponent(term)}`)}
                    className="px-4 py-2 text-sm bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl border border-gray-150 dark:border-gray-700 hover:border-[#5BA3D0] hover:text-[#5BA3D0] hover:shadow-sm transition-all duration-200 flex-shrink-0"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Featured products */}
            <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-[#5BA3D0] shrink-0" aria-hidden />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Featured products</h2>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 hidden sm:block">Hand-picked SKUs from your admin curated list or live catalog.</p>
                </div>
                <select
                  value={effectivePerPage}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setProductsPerPage(next);
                    localStorage.setItem(PRODUCTS_PER_PAGE_LS_KEY, String(next));
                  }}
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl focus:ring-2 focus:ring-[#5BA3D0]/30 focus:border-[#5BA3D0] transition-colors min-w-0 flex-shrink-0"
                  aria-label="Products per page"
                  title="Products per page"
                >
                  {[MIN_PRODUCTS_PER_PAGE, 160, 200, 240].map((n) => (
                    <option key={n} value={n}>
                      {n}/page
                    </option>
                  ))}
                </select>
              </div>
              {error ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/40 p-4">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  <button type="button" onClick={fetchData} className="mt-2 text-sm font-medium text-red-700 dark:text-red-300 underline">
                    Retry
                  </button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
                {featuredProducts.map((product) => (
                  <ProductCard
                    key={product.id || product._id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    onToggleWishlist={toggleWishlist}
                    isWishlisted={isWishlisted(product)}
                  />
                ))}
              </div>

              {featuredHasMore ? (
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    onClick={showMoreFeatured}
                    disabled={featuredLoadingMore}
                    className="group flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-white bg-[#5BA3D0] hover:bg-[#4A90B8] disabled:opacity-60 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {featuredLoadingMore ? 'Loading…' : 'Show More'}
                    {!featuredLoadingMore && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                  </button>
                </div>
              ) : null}
            </div>

            {/* Featured sales */}
            {featuredSales.length > 0 && (
              <div id="home-featured-sales" className="mt-12 scroll-mt-24">
                <div className="mb-5">
                  <div className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Best deals &amp; featured sales</h2>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Promotional SKUs with volume-friendly pricing.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
                  {featuredSales.map((product) => (
                    <ProductCard
                      key={product.id || product._id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      onToggleWishlist={toggleWishlist}
                      isWishlisted={isWishlisted(product)}
                    />
                  ))}
                </div>

                {featuredSalesHasMore ? (
                  <div className="mt-10 flex justify-center">
                    <button
                      type="button"
                      onClick={showMoreFeaturedSales}
                      disabled={featuredSalesLoadingMore}
                      className="group flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-white bg-[#5BA3D0] hover:bg-[#4A90B8] disabled:opacity-60 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {featuredSalesLoadingMore ? 'Loading…' : 'Show More'}
                      {!featuredSalesLoadingMore && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {newArrivals.length > 0 ? (
              <div id="home-new-arrivals" className="mt-12 scroll-mt-24">
                <div className="mb-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0" aria-hidden />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">New arrivals</h2>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recently listed products from your merchandising queue.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
                  {newArrivals.map((product) => (
                    <ProductCard
                      key={product.id || product._id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      onToggleWishlist={toggleWishlist}
                      isWishlisted={isWishlisted(product)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {(site.testimonials || []).length > 0 || (site.trustBadges || []).length > 0 ? (
              <div className="mt-14 space-y-10 border-t border-gray-100 dark:border-gray-800 pt-10">
                {(site.testimonials || []).length > 0 ? (
                  <TestimonialCarousel
                    items={site.testimonials}
                    rotationMs={site.testimonialCarouselMs || site.defaultBannerRotationMs || 6000}
                  />
                ) : null}
                {(site.trustBadges || []).length > 0 ? <TrustBadgeStrip badges={site.trustBadges} /> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
