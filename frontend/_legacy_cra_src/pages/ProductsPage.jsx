import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { SlidersHorizontal, ArrowRight, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Slider } from '../components/ui/slider';
import { useToast } from '../hooks/use-toast';
import { productAPI, categoryAPI } from '../api/service';
import { getApiErrorMessage } from '@/utils/apiError';
import { logger } from '@/utils/logger';
import { CATEGORY_FALLBACK } from '../constants/categories';
import { useWishlist } from '../context/WishlistContext';
import { useCustomerInbox } from '../context/CustomerInboxContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import WaveBannerCarousel from '../components/WaveBannerCarousel';

const PRICE_SLIDER_MAX = 1000;

const MIN_ROWS = 15;
const PRODUCTS_PER_ROW_DESKTOP = 8;
const MIN_PRODUCTS_PER_PAGE = MIN_ROWS * PRODUCTS_PER_ROW_DESKTOP;
const PRODUCTS_PER_PAGE_LS_KEY = "oceanBazar_products_per_page";

const ProductsPage = ({ onAddToCart }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const { catalogLive } = useCustomerInbox();
  const site = useSiteSettings();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [priceRange, setPriceRange] = useState([0, PRICE_SLIDER_MAX]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [brandFilter, setBrandFilter] = useState('');
  const [minRating, setMinRating] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [productsPerPage, setProductsPerPage] = useState(() => {
    const saved = localStorage.getItem(PRODUCTS_PER_PAGE_LS_KEY);
    const n = saved ? Number(saved) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
    return MIN_PRODUCTS_PER_PAGE;
  });

  const effectivePerPage = Math.max(Number(productsPerPage) || MIN_PRODUCTS_PER_PAGE, MIN_PRODUCTS_PER_PAGE);

  const searchQuery = searchParams.get('search') || '';
  const categoryQuery = searchParams.get('category') || '';
  const featuredSaleOnly = searchParams.get('featuredSale') === 'true';

  const placementBanners = useMemo(() => {
    const raw = (site.productBanners || []).filter((b) => b && b.imageUrl && b.enabled !== false);
    const sorted = [...raw].sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
    return sorted.filter((b) => {
      const p = String(b.placement || 'ALL').toUpperCase();
      if (p === 'ALL') return true;
      if (p === 'FEATURED') return featuredSaleOnly;
      if (p === 'CATEGORY') return Boolean(categoryQuery) && String(b.category || '').trim() === categoryQuery;
      return false;
    });
  }, [site.productBanners, featuredSaleOnly, categoryQuery]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchProducts(1, true);
  }, [
    searchQuery,
    categoryQuery,
    featuredSaleOnly,
    selectedCategories,
    priceRange,
    verifiedOnly,
    sortBy,
    effectivePerPage,
    brandFilter,
    minRating
  ]);

  const catalogSeqSeenRef = useRef(null);
  useEffect(() => {
    if (catalogSeqSeenRef.current === null) {
      catalogSeqSeenRef.current = catalogLive.seq;
      return;
    }
    if (catalogLive.seq === catalogSeqSeenRef.current) return;
    catalogSeqSeenRef.current = catalogLive.seq;
    if (!catalogLive.seq) return;
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchProducts(1, true);
  }, [catalogLive.seq]);

  const fetchCategories = async () => {
    categoryAPI
      .getAll()
      .then((response) => {
        const list = Array.isArray(response.data) ? response.data : [];
        setCategories(list.length > 0 ? list : CATEGORY_FALLBACK);
      })
      .catch(() => setCategories(CATEGORY_FALLBACK));
  };

  const fetchProducts = async (pageNum = 1, reset = false) => {
    if (reset) {
      setLoading(true);
      setErrorMessage('');
    } else {
      setLoadingMore(true);
    }

    try {
      const params = {
        search: searchQuery || undefined,
        category: categoryQuery || undefined,
        categories: !categoryQuery && selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
        verified: verifiedOnly || undefined,
        featuredSale: featuredSaleOnly ? true : undefined,
        sort: sortBy,
        page: pageNum,
        limit: effectivePerPage,
      };
      if (priceRange[0] > 0) {
        params.minPrice = priceRange[0];
      }
      if (priceRange[1] < PRICE_SLIDER_MAX) {
        params.maxPrice = priceRange[1];
      }
      const b = String(brandFilter || '').trim();
      if (b) params.brand = b;
      const r = Number(minRating);
      if (Number.isFinite(r) && r > 0) params.minRating = r;

      const response = await productAPI.getAll(params);
      const newProducts = response.data.products || [];

      if (reset) {
        setProducts(newProducts);
      } else {
        setProducts((prev) => [...prev, ...newProducts]);
      }

      setHasMore(newProducts.length === effectivePerPage);
    } catch (error) {
      logger.error('Error fetching products:', error);
      const msg = getApiErrorMessage(error, 'Failed to load products. Please try again.');
      setErrorMessage(msg);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const showMore = async () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      await fetchProducts(nextPage, false);
    }
  };

  const handleCategoryToggle = (categoryName) => {
    if (categoryQuery) {
      const next = new URLSearchParams(searchParams);
      if (categoryQuery === categoryName) {
        next.delete('category');
      } else {
        next.set('category', categoryName);
      }
      setSearchParams(next, { replace: true });
      return;
    }
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setPriceRange([0, PRICE_SLIDER_MAX]);
    setVerifiedOnly(false);
    setBrandFilter('');
    setMinRating('');
    setSortBy('relevance');
    const next = new URLSearchParams();
    if (searchQuery) next.set('search', searchQuery);
    setSearchParams(next, { replace: true });
  };

  const handleAddToCart = (product) => {
    onAddToCart(product);
    toast({
      title: 'Added to cart',
      description: `${product.name} has been added to your cart.`,
    });
  };

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    verifiedOnly ||
    categoryQuery ||
    featuredSaleOnly ||
    priceRange[0] > 0 ||
    priceRange[1] < PRICE_SLIDER_MAX ||
    Boolean(String(brandFilter || '').trim()) ||
    Boolean(String(minRating || '').trim());

  const FilterContent = ({ isMobile = false }) => (
    <>
      <div className="mb-6">
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 text-sm">Categories</h4>
        <div className={`space-y-2 ${isMobile ? 'max-h-52' : ''} overflow-y-auto pr-1`}>
          {categories.map((category) => {
            const fid = `${isMobile ? 'mobile-' : ''}category-filter-${category.id || category.name}`;
            const checked = Boolean(
              categoryQuery
                ? categoryQuery === category.name
                : selectedCategories.includes(category.name)
            );
            return (
              <div key={category.id || category.name} className="flex items-center gap-2.5">
                <Checkbox
                  id={fid}
                  checked={checked}
                  onCheckedChange={() => handleCategoryToggle(category.name)}
                />
                <Label htmlFor={fid} className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  {category.name}
                  {typeof category.count === 'number' ? (
                    <span className="text-gray-400 dark:text-gray-500 ml-1">({category.count})</span>
                  ) : null}
                </Label>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 text-sm">Price Range</h4>
        <Slider
          value={priceRange}
          onValueChange={setPriceRange}
          max={PRICE_SLIDER_MAX}
          step={1}
          className="mb-3"
        />
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium">${priceRange[0]}</span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium">${priceRange[1]}{priceRange[1] >= PRICE_SLIDER_MAX ? '+' : ''}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 mb-5">
        <Checkbox
          id={`${isMobile ? 'mobile-' : ''}verified`}
          checked={verifiedOnly}
          onCheckedChange={setVerifiedOnly}
        />
        <Label htmlFor={`${isMobile ? 'mobile-' : ''}verified`} className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          Verified sellers only
        </Label>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 text-sm">Brand</h4>
        <input
          type="text"
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          placeholder="e.g. Samsung"
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-[#5BA3D0]/30 focus:border-[#5BA3D0]"
        />
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 text-sm">Minimum rating</h4>
        <select
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#5BA3D0]/30 focus:border-[#5BA3D0]"
        >
          <option value="">Any</option>
          <option value="4">4+ stars</option>
          <option value="4.5">4.5+ stars</option>
        </select>
      </div>

      {isMobile && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={clearFilters} className="rounded-xl">Reset</Button>
          <Button className="bg-[#5BA3D0] rounded-xl" onClick={() => setShowFilters(false)}>Apply</Button>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 overflow-x-hidden">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
        {/* Page header */}
        <div className="mb-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate tracking-tight">
                {featuredSaleOnly
                  ? 'Featured sales'
                  : searchQuery
                    ? `Search: "${searchQuery}"`
                    : categoryQuery || 'All products'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{products.length} products found</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4 inline mr-2" />
                Filters
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl focus:ring-2 focus:ring-[#5BA3D0]/30 focus:border-[#5BA3D0] transition-colors"
              >
                <option value="relevance">Most relevant</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest rated</option>
                <option value="orders">Most orders</option>
              </select>
              <select
                value={effectivePerPage}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setProductsPerPage(next);
                  localStorage.setItem(PRODUCTS_PER_PAGE_LS_KEY, String(next));
                }}
                className="px-2.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl focus:ring-2 focus:ring-[#5BA3D0]/30 focus:border-[#5BA3D0] transition-colors"
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
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar */}
          <div className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-60 xl:w-64 flex-shrink-0`}>
            {showFilters ? (
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
                aria-label="Close filters backdrop"
              />
            ) : null}

            {/* Mobile filter drawer */}
            <div className="lg:hidden fixed left-0 right-0 bottom-0 top-20 z-40 overflow-y-auto p-3">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-elevated p-5 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <FilterContent isMobile />
              </div>
            </div>

            {/* Desktop filter sidebar */}
            <div className="hidden lg:block bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft p-5 lg:sticky lg:top-40 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                </h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-[#5BA3D0] hover:text-[#4A90B8] font-medium transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <FilterContent />
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 min-w-0">
            {!site.loading && placementBanners.length > 0 ? (
              <WaveBannerCarousel
                slides={placementBanners}
                rotationMs={site.defaultBannerRotationMs || 6000}
                variant="compact"
                compactSpacing
              />
            ) : null}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800/80 rounded-2xl p-3.5 animate-pulse border border-gray-100 dark:border-gray-800">
                    <div className="bg-gray-100 dark:bg-gray-700 aspect-square rounded-xl mb-3"></div>
                    <div className="bg-gray-100 dark:bg-gray-700 h-4 rounded mb-2"></div>
                    <div className="bg-gray-100 dark:bg-gray-700 h-4 rounded mb-2 w-3/4"></div>
                    <div className="bg-gray-100 dark:bg-gray-700 h-8 rounded-lg mt-4"></div>
                  </div>
                ))}
              </div>
            ) : errorMessage ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-800">
                <p className="text-red-600 dark:text-red-300 text-base">{errorMessage}</p>
                <Button onClick={() => fetchProducts(1, true)} className="mt-4 bg-[#5BA3D0] hover:bg-[#4A90B8] rounded-xl">
                  Retry
                </Button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 dark:text-gray-400 text-base">No products found</p>
                <Button onClick={clearFilters} className="mt-4 bg-[#5BA3D0] hover:bg-[#4A90B8] rounded-xl">
                  Clear filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
                  {products.map((product) => (
                    <ProductCard
                      key={product._id || product.id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      onToggleWishlist={toggleWishlist}
                      isWishlisted={isWishlisted(product)}
                    />
                  ))}
                </div>
                {loadingMore && (
                  <div className="text-center py-10">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-[3px] border-[#5BA3D0] border-t-transparent"></div>
                  </div>
                )}

                {!loadingMore && hasMore && products.length > 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <Button
                      onClick={showMore}
                      className="group flex items-center gap-2 bg-[#5BA3D0] hover:bg-[#4A90B8] text-white rounded-xl px-8 py-3 h-auto text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      Show More
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </div>
                ) : null}

                {!loadingMore && !hasMore && products.length > 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400 dark:text-gray-500">You reached the end.</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
