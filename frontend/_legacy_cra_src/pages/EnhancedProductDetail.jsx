import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Heart, Share2, CheckCircle, Truck, Shield, MessageCircle, Plus, Minus, Package, GitCompare, User, X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';
import ProductCard from '../components/ProductCard';
import { productAPI, wholesaleAPI } from '../api/service';
import { normalizeProductIdParam, productDetailPath } from '../utils/productId';
import { getDisplayProductTitle } from '../utils/productDisplay';
import {
  getDisplayPrices,
  maxOrderQuantityForUser,
  RETAIL_MAX_ORDER_QTY,
  buildWholesalePricingPreview,
  getMsrpPerUnit,
  getFullRetailLineTotal,
} from '../utils/pricing';
import { normalizeProductImageUrl, resolveMediaUrl } from '../utils/mediaUrl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useComparison } from '../context/ComparisonContext';
import { useWishlist } from '../context/WishlistContext';
import { useCustomerInbox } from '../context/CustomerInboxContext';

const EnhancedProductDetail = ({ onAddToCart }) => {
  const MIN_ROWS = 15;
  const PRODUCTS_PER_ROW_DESKTOP = 8;
  const MIN_PRODUCTS_PER_PAGE = MIN_ROWS * PRODUCTS_PER_ROW_DESKTOP;
  const PRODUCTS_PER_PAGE_LS_KEY = 'oceanBazar_products_per_page';

  const [productsPerPage] = React.useState(() => {
    const saved = localStorage.getItem(PRODUCTS_PER_PAGE_LS_KEY);
    const n = saved ? Number(saved) : NaN;
    if (Number.isFinite(n) && n > 0) return Math.max(n, MIN_PRODUCTS_PER_PAGE);
    return MIN_PRODUCTS_PER_PAGE;
  });
  // We filter out the current product from results, so fetch a tiny bit extra
  // to keep the "15 rows minimum" requirement reliable.
  const relatedFetchLimit = productsPerPage + 1;

  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToComparison, comparisonCount } = useComparison();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const { catalogLive } = useCustomerInbox();
  const [product, setProduct] = React.useState(null);
  const [quantity, setQuantity] = React.useState(1);
  const [maxOrderQty, setMaxOrderQty] = React.useState(RETAIL_MAX_ORDER_QTY);
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [userType, setUserType] = React.useState('retail');
  const [relatedProducts, setRelatedProducts] = React.useState([]);
  const [relatedPage, setRelatedPage] = React.useState(1);
  const [relatedHasMore, setRelatedHasMore] = React.useState(false);
  const [relatedLoadingMore, setRelatedLoadingMore] = React.useState(false);
  const [fullscreenOpen, setFullscreenOpen] = React.useState(false);
  const [fullscreenIndex, setFullscreenIndex] = React.useState(0);

  React.useEffect(() => {
    // Get user type from localStorage
    const savedUser = localStorage.getItem('oceanBazarUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setUserType(user.userType || user.role || 'retail');
    }

    // Re-check wholesale approval from backend (prevents stale localStorage after admin approval/revoke).
    const token = localStorage.getItem('oceanBazarToken');
    if (token) {
      (async () => {
        try {
          const res = await wholesaleAPI.status();
          const status = res?.data?.status;
          if (status === 'approved') {
            setUserType('wholesale');
          } else {
            setUserType('retail');
          }
        } catch {
          // If the status endpoint fails, fall back to localStorage value.
        }
      })();
    }
    fetchProduct();
    return undefined;
  }, [id]);

  React.useEffect(() => {
    if (!product) return;
    const cap = maxOrderQuantityForUser(product, userType);
    setMaxOrderQty(cap);
    setQuantity((q) => Math.min(Math.max(1, q), cap));
  }, [product, userType]);

  React.useEffect(() => {
    if (product?.name) {
      document.title = `${getDisplayProductTitle(product)} · OceanBazar`;
    }
    return () => {
      document.title = 'OceanBazar';
    };
  }, [product]);

  const fetchProduct = async () => {
    const param = normalizeProductIdParam(id);
    if (!param) {
      setProduct(null);
      setLoading(false);
      toast({ title: 'Invalid link', description: 'No product id in the URL.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const response = await productAPI.getById(param);
      const prod = response.data;
      const canonicalId = prod.id || prod._id;
      if (canonicalId && canonicalId !== param) {
        navigate(productDetailPath(canonicalId), { replace: true });
      }
      prod.availability = 'in_stock';
      
      // Use backend attributes or fallback to defaults
      if (!prod.attributes || Object.keys(prod.attributes).length === 0) {
        prod.attributes = {
          application: 'Daily Use',
          feature: 'Durable, Lightweight',
          mainIngredient: 'Premium Materials',
          sizeType: 'Standard',
          gender: 'Unisex',
          efficacy: 'Long-lasting',
          certification: 'ISO 9001',
          use: 'Multi-purpose',
          placeOfOrigin: 'Bangladesh',
          modelNumber: 'OB-' + prod.id,
          productType: prod.category,
          effect: 'High Quality',
          function: 'Professional Grade',
          keywords: prod.tags?.join(', ') || 'quality, reliable',
          productName: prod.name,
          sellingUnits: 'Pieces',
          singlePackageSize: '20cm x 15cm x 10cm',
          singleGrossWeight: '0.5 kg'
        };
      }
      
      setProduct(prod);
      setActiveMediaIndex(0);
      setFullscreenIndex(0);
      setFullscreenOpen(false);
      const currentProductId = prod.id || prod._id;
      const rel = await productAPI.getAll({ category: prod.category, limit: relatedFetchLimit, page: 1 });
      const serverProducts = rel.data.products || [];
      const relProducts = serverProducts.filter((p) => (p.id || p._id) !== currentProductId);
      setRelatedProducts(relProducts);
      setRelatedPage(1);
      setRelatedHasMore(serverProducts.length === relatedFetchLimit);
      setRelatedLoadingMore(false);
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        'Product not found';
      toast({ title: 'Unable to load product', description: String(detail), variant: 'destructive' });
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductRef = React.useRef(fetchProduct);
  fetchProductRef.current = fetchProduct;

  const catalogSeqSeenRef = React.useRef(null);
  React.useEffect(() => {
    catalogSeqSeenRef.current = null;
  }, [id]);

  React.useEffect(() => {
    if (catalogSeqSeenRef.current === null) {
      catalogSeqSeenRef.current = catalogLive.seq;
      return;
    }
    if (catalogLive.seq === catalogSeqSeenRef.current) return;
    if (!catalogLive?.seq) {
      catalogSeqSeenRef.current = catalogLive.seq;
      return;
    }
    const routeId = normalizeProductIdParam(id);
    const relevant = routeId && String(catalogLive.productId) === routeId;
    if (!relevant) {
      catalogSeqSeenRef.current = catalogLive.seq;
      return;
    }
    catalogSeqSeenRef.current = catalogLive.seq;
    if (catalogLive.change === 'deleted') {
      toast({
        title: 'Product removed',
        description: 'This product is no longer available.',
        variant: 'destructive',
      });
      navigate('/products');
      return;
    }
    void fetchProductRef.current();
  }, [catalogLive.seq, catalogLive.productId, catalogLive.change, id, navigate, toast]);

  const mergeUniqueProducts = (prev, next) => {
    const map = new Map();
    [...prev, ...next].forEach((p) => {
      const key = p?._id || p?.id;
      if (!key) return;
      map.set(key, p);
    });
    return Array.from(map.values());
  };

  const showMoreProducts = async () => {
    if (relatedLoadingMore || !relatedHasMore || !product) return;
    setRelatedLoadingMore(true);
    try {
      const nextPage = relatedPage + 1;
      const currentProductId = product.id || product._id;
      const rel = await productAPI.getAll({ category: product.category, limit: relatedFetchLimit, page: nextPage });
      const serverProducts = rel.data.products || [];
      const relProducts = serverProducts.filter((p) => (p.id || p._id) !== currentProductId);

      setRelatedProducts((prev) => mergeUniqueProducts(prev, relProducts));
      setRelatedPage(nextPage);
      setRelatedHasMore(serverProducts.length === relatedFetchLimit);
    } catch (e) {
      toast({
        title: 'Error',
        description: e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'Failed to load more products.',
        variant: 'destructive'
      });
    } finally {
      setRelatedLoadingMore(false);
    }
  };

  const calculatePrice = () => {
    if (!product) {
      return {
        unitPrice: 0,
        retailBase: 0,
        wholesaleBase: 0,
        payTotal: '0.00',
        msrpTotal: null,
        preTierRetailTotal: '0.00',
        saveVsMsrp: null,
        saveVsPreTier: null,
      };
    }
    const pricing = getDisplayPrices(product, userType, quantity);
    const pay = pricing.unitPrice * quantity;
    const msrpUnit = getMsrpPerUnit(product);
    const msrpTot = msrpUnit != null ? msrpUnit * quantity : null;
    const preTierRetail = getFullRetailLineTotal(product, quantity);
    const saveMsrp = msrpTot != null && msrpTot > pay + 1e-6 ? msrpTot - pay : null;
    const savePre = preTierRetail > pay + 1e-6 ? preTierRetail - pay : null;
    return {
      unitPrice: pricing.unitPrice,
      retailBase: pricing.retailBase,
      wholesaleBase: pricing.wholesaleBase,
      payTotal: pay.toFixed(2),
      msrpTotal: msrpTot != null ? msrpTot.toFixed(2) : null,
      preTierRetailTotal: preTierRetail.toFixed(2),
      saveVsMsrp: saveMsrp != null ? saveMsrp.toFixed(2) : null,
      saveVsPreTier: savePre != null ? savePre.toFixed(2) : null,
    };
  };

  const handleShare = async () => {
    try {
      const url = window.location.href;
      const title = product?.name ? `${getDisplayProductTitle(product)} · OceanBazar` : "OceanBazar";

      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Product link copied to clipboard." });
    } catch {
      toast({
        title: "Share failed",
        description: "Could not share this product. Please try again.",
        variant: "destructive"
      });
    }
  };

  const images = (product?.images && product.images.length > 0 ? product.images : product?.image ? [product.image, product.image, product.image] : [])
    .map((u) => normalizeProductImageUrl(u))
    .filter(Boolean);
  const videos = (product?.videos || [])
    .filter(Boolean)
    .map((v) => resolveMediaUrl(String(v).trim()))
    .filter(Boolean);
  const galleryItems = [
    ...images.map((src, idx) => ({ type: 'image', src, key: `img-${idx}` })),
    ...videos.map((src, idx) => ({ type: 'video', src, key: `vid-${idx}` })),
  ];

  const goFullscreenTo = useCallback((idx) => {
    const len = galleryItems.length;
    if (len <= 0) return;
    const safeIndex = ((idx % len) + len) % len;
    setFullscreenIndex(safeIndex);
    setActiveMediaIndex(safeIndex);
  }, [galleryItems.length]);

  const openFullscreenAt = (idx) => {
    if (galleryItems.length <= 0) return;
    goFullscreenTo(idx);
    setFullscreenOpen(true);
  };

  const closeFullscreen = useCallback(() => setFullscreenOpen(false), []);

  React.useEffect(() => {
    if (!fullscreenOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFullscreen();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goFullscreenTo(fullscreenIndex - 1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goFullscreenTo(fullscreenIndex + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [fullscreenOpen, fullscreenIndex, goFullscreenTo, closeFullscreen]);

  if (loading) return <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-[3px] border-[#5BA3D0] border-t-transparent"></div></div>;
  if (!product) return <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center"><div className="text-gray-500 dark:text-gray-400">Product not found</div></div>;

  const displayTitle = getDisplayProductTitle(product);
  const pricing = calculatePrice();
  const wholesaleTableRows =
    Array.isArray(product.wholesalePricing) && product.wholesalePricing.some((r) => r && r.kind)
      ? product.wholesalePricing
      : buildWholesalePricingPreview(product);
  const wholesaleRowsFiltered =
    userType === 'wholesale' && quantity > RETAIL_MAX_ORDER_QTY
      ? wholesaleTableRows.filter((r) => r && r.kind !== 'retail_volume')
      : wholesaleTableRows;
  const showRetailPricingTable = userType === 'retail' || (userType === 'wholesale' && quantity <= RETAIL_MAX_ORDER_QTY);

  const reviews = [
    { name: 'Ahmed Khan', rating: 5, date: '2024-03-10', comment: 'Excellent quality! Highly recommended for business use.', verified: true },
    { name: 'Sarah Ali', rating: 5, date: '2024-03-08', comment: 'Great product, fast shipping. Will order again.', verified: true },
    { name: 'Karim Rahman', rating: 4, date: '2024-03-05', comment: 'Good value for money. Quality is as described.', verified: true },
    { name: 'Fatima Begum', rating: 5, date: '2024-03-02', comment: 'Perfect for wholesale orders. Very satisfied!', verified: true }
  ];

  const overallRating = 4.8;
  const totalReviews = 245;
  const ratingDistribution = [
    { stars: 5, count: 198, percentage: 81 },
    { stars: 4, count: 35, percentage: 14 },
    { stars: 3, count: 8, percentage: 3 },
    { stars: 2, count: 3, percentage: 1 },
    { stars: 1, count: 1, percentage: 1 }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white dark:bg-gray-800/90 rounded-2xl shadow-soft p-5 sm:p-8 border border-gray-100 dark:border-gray-800 mb-8 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <div>
              {(() => {
                const activeIndex = galleryItems.length > 0 ? Math.min(activeMediaIndex, galleryItems.length - 1) : 0;
                const activeItem = galleryItems[activeIndex];

                return (
                  <>
                    {/* Main (Amazon-style) preview */}
                    <button
                      type="button"
                      onClick={() => openFullscreenAt(activeIndex)}
                      className="block w-full text-left"
                      aria-label="Open fullscreen gallery"
                    >
                      <div className="relative w-full aspect-[4/3] max-h-[420px] rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 mb-4">
                        {activeItem?.type === 'video' ? (
                          <video
                            src={activeItem.src}
                            controls
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={activeItem?.src}
                            alt={displayTitle}
                            className="w-full h-full object-contain bg-transparent"
                          />
                        )}
                      </div>
                    </button>

                    {/* Horizontal gallery (images + videos) */}
                    <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Product media gallery">
                      {galleryItems.map((item, index) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => openFullscreenAt(index)}
                          className={`relative w-20 h-20 md:w-24 md:h-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                            index === activeMediaIndex
                              ? 'border-[#5BA3D0]'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                          aria-label={`Open ${item.type === 'video' ? 'video' : 'image'} ${index + 1}`}
                        >
                          {item.type === 'video' ? (
                            <>
                              <video src={item.src} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center">
                                <Play className="w-6 h-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <img src={item.src} alt="" className="w-full h-full object-cover" />
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle className="w-3 h-3" />In Stock
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">{displayTitle}</h1>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-600'}`} />
                  ))}
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{product.rating}</span>
                </div>
                <span className="text-gray-500 dark:text-gray-400">|</span>
                <span className="text-gray-600 dark:text-gray-300">{product.orders} orders</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-sm text-gray-600 dark:text-gray-300">
                <span><span className="font-medium text-gray-800 dark:text-gray-200">MOQ:</span> {product.moq ?? 1} pcs</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className={`font-medium ${product.featuredSale ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                  {product.featuredSale ? 'High demand - fast dispatch' : 'Standard dispatch'}
                </span>
                {product.verified && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  </>
                )}
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{product.category || 'General'}</span>
              </div>

              <div className="mb-6 p-5 sm:p-6 bg-gradient-to-br from-gray-50 to-gray-50/50 dark:from-gray-800 dark:to-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col gap-2 sm:gap-3 mb-4">
                  {pricing.msrpTotal ? (
                    <span className="inline-flex w-fit items-center text-sm font-medium text-amber-900/90 dark:text-amber-200/95 line-through px-3 py-1 rounded-full border-2 border-amber-400/70 bg-amber-400/15 dark:border-amber-500/50 dark:bg-amber-500/10">
                      ${pricing.msrpTotal}
                    </span>
                  ) : null}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-3xl sm:text-4xl font-bold text-[#5BA3D0]">${pricing.payTotal}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">for {quantity} {quantity === 1 ? 'unit' : 'units'}</span>
                  </div>
                  {Number(pricing.preTierRetailTotal) > Number(pricing.payTotal) + 1e-6 ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-400 line-through">${pricing.preTierRetailTotal}</span>
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        Save ${pricing.saveVsPreTier}
                      </span>
                    </div>
                  ) : null}
                  {pricing.msrpTotal && Number(pricing.msrpTotal) > Number(pricing.payTotal) + 1e-6 ? (
                    <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                      vs. list ${pricing.msrpTotal}: save ${pricing.saveVsMsrp}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex flex-wrap gap-x-2 gap-y-1 items-center">
                  {userType === 'wholesale' && quantity > RETAIL_MAX_ORDER_QTY ? (
                    <>
                      <span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">Wholesale:</span> ${pricing.wholesaleBase.toFixed(2)} / unit
                      </span>
                      <span className="text-gray-400">|</span>
                      <span>
                        <span className="font-medium">Retail:</span> ${pricing.retailBase.toFixed(2)} / unit
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="inline-flex items-center gap-1 font-medium text-[#5BA3D0]" title="No retail cap for approved wholesale buyers">
                        MOQ: <span className="text-base leading-none">∞</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">Retail:</span> ${pricing.retailBase.toFixed(2)} / unit
                      </span>
                      <span className="text-gray-400">|</span>
                      <span>
                        Max: {Math.min(maxOrderQty, RETAIL_MAX_ORDER_QTY)} units (wholesale tiers: {RETAIL_MAX_ORDER_QTY + 1}+)
                      </span>
                      {userType === 'wholesale' ? (
                        <>
                          <span className="text-gray-400">|</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Wholesale account — switch qty to {RETAIL_MAX_ORDER_QTY + 1}+ for volume price</span>
                        </>
                      ) : null}
                    </>
                  )}
                </div>

                {showRetailPricingTable ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-[#D0E7F5] dark:border-gray-600">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Retail Pricing Table</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">1–{RETAIL_MAX_ORDER_QTY} units (volume discounts on base retail)</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-gray-600">
                          <th className="text-left py-2 text-gray-700 dark:text-gray-300">Quantity</th>
                          <th className="text-left py-2 text-gray-700 dark:text-gray-300">Discount</th>
                          <th className="text-right py-2 text-gray-700 dark:text-gray-300">Price per Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(product.retailPricing) && product.retailPricing.length > 0
                          ? product.retailPricing
                          : [
                              { minQty: 1, maxQty: 1, discount: 0, pricePerUnit: pricing.retailBase },
                              { minQty: 2, maxQty: 10, discount: 5, pricePerUnit: pricing.retailBase * 0.95 },
                              { minQty: 11, maxQty: 20, discount: 10, pricePerUnit: pricing.retailBase * 0.9 },
                              { minQty: 21, maxQty: 25, discount: 15, pricePerUnit: pricing.retailBase * 0.85 },
                            ]
                        ).map((tier, idx) => (
                          <tr key={idx} className="border-b dark:border-gray-600 last:border-0">
                            <td className="py-2 text-gray-700 dark:text-gray-300">
                              {tier.maxQty != null && tier.maxQty !== '' ? `${tier.minQty}–${tier.maxQty} units` : `${tier.minQty}+ units`}
                            </td>
                            <td className={`py-2 ${Number(tier.discount) > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                              {Number(tier.discount) > 0 ? `${tier.discount}% off` : '0%'}
                            </td>
                            <td className="text-right py-2 font-semibold text-gray-800 dark:text-gray-100">
                              ${Number(tier.pricePerUnit).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-[#D0E7F5] dark:border-gray-600">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Wholesale Pricing Table</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b dark:border-gray-600">
                          <th className="text-left py-2 text-gray-700 dark:text-gray-300">Quantity Range</th>
                          <th className="text-right py-2 text-gray-700 dark:text-gray-300">Price per Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wholesaleRowsFiltered.map((row, idx) => {
                          const vol = Number(row.volumeDiscountPct || 0);
                          const pctLabel = vol > 0 ? ` (${Math.round(vol * 100)}% vol. off)` : '';
                          const range =
                            row.maxQty != null && row.maxQty !== ''
                              ? `${row.minQty}–${row.maxQty} units`
                              : `${row.minQty}+ units`;
                          const label = `${range}${pctLabel}`;
                          return (
                            <tr key={idx} className="border-b dark:border-gray-600 last:border-0">
                              <td className="py-2 text-gray-700 dark:text-gray-300">{label}</td>
                              <td className={`text-right py-2 font-semibold ${vol > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                ${Number(row.pricePerUnit).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantity</label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                    </button>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(maxOrderQty, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="w-20 text-center border-x border-gray-300 dark:border-gray-600 py-2 focus:outline-none bg-background text-foreground dark:bg-gray-800"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(maxOrderQty, quantity + 1))}
                      className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mb-6">
                  <Button
                  onClick={() => {
                    onAddToCart({ ...product, quantity });
                    toast({ title: "Added to cart" });
                  }}
                  className="flex-1 bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-11 rounded-xl font-semibold text-sm transition-colors duration-200"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </Button>
              </div>

              <div className="flex gap-5">
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${
                    isWishlisted(product) ? "text-[#5BA3D0]" : "text-gray-500 hover:text-[#5BA3D0]"
                  }`}
                  aria-label={isWishlisted(product) ? "Remove from wishlist" : "Save to wishlist"}
                >
                  <Heart className={`w-5 h-5 ${isWishlisted(product) ? "fill-[#5BA3D0] text-[#5BA3D0]" : ""}`} />
                  Wishlist
                </button>

                <button
                  type="button"
                  onClick={() => addToComparison(product)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#5BA3D0] transition-colors duration-200"
                >
                  <GitCompare className="w-4 h-4" />
                  Compare {comparisonCount > 0 && `(${comparisonCount})`}
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#5BA3D0] transition-colors duration-200"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="attributes">Attributes</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({totalReviews})</TabsTrigger>
                <TabsTrigger value="specs">Specifications</TabsTrigger>
              </TabsList>
              
              <TabsContent value="description" className="mt-6">
                <div className="max-w-none text-gray-800 dark:text-gray-200">
                  <p className="mb-4 text-[15px] leading-relaxed text-gray-700 dark:text-gray-200">
                    {product.description || `${displayTitle} is premium quality, manufactured to highest standards.`}
                  </p>
                  <h3 className="mt-4 mb-3 text-lg font-semibold text-gray-900 dark:text-gray-50">
                    Key features
                  </h3>
                  <ul className="list-inside list-disc space-y-2.5 text-gray-700 dark:text-gray-300 marker:text-[#5BA3D0]">
                    <li>High-quality materials and construction</li>
                    <li>Durable and long-lasting design</li>
                    <li>Competitive wholesale pricing available</li>
                    <li>Fast shipping and reliable delivery</li>
                    <li>Quality assurance guaranteed</li>
                  </ul>
                </div>
              </TabsContent>
              
              <TabsContent value="attributes" className="mt-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      <tr className="border-b border-gray-100 dark:border-gray-700"><td className="py-3 px-4 font-semibold text-sm w-1/3 bg-gray-50 dark:bg-gray-800/50">Application</td><td className="py-3 px-4">{product.attributes.application}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Feature</td><td className="py-3 px-4">{product.attributes.feature}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Main Ingredient</td><td className="py-3 px-4">{product.attributes.mainIngredient}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Size Type</td><td className="py-3 px-4">{product.attributes.sizeType}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Gender</td><td className="py-3 px-4">{product.attributes.gender}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Efficacy</td><td className="py-3 px-4">{product.attributes.efficacy}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Certification</td><td className="py-3 px-4">{product.attributes.certification}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Use</td><td className="py-3 px-4">{product.attributes.use}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Place of Origin</td><td className="py-3 px-4">{product.attributes.placeOfOrigin}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Model Number</td><td className="py-3 px-4">{product.attributes.modelNumber}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Product Type</td><td className="py-3 px-4">{product.attributes.productType}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Effect</td><td className="py-3 px-4">{product.attributes.effect}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Function</td><td className="py-3 px-4">{product.attributes.function}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Keywords</td><td className="py-3 px-4">{product.attributes.keywords}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Product Name</td><td className="py-3 px-4">{product.attributes.productName}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Selling Units</td><td className="py-3 px-4">{product.attributes.sellingUnits}</td></tr>
                      <tr className="border-b"><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Single Package Size</td><td className="py-3 px-4">{product.attributes.singlePackageSize}</td></tr>
                      <tr><td className="py-3 px-4 font-semibold bg-[#F5F9FC]">Single Gross Weight</td><td className="py-3 px-4">{product.attributes.singleGrossWeight}</td></tr>
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              
              <TabsContent value="reviews" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-6 border border-gray-100 dark:border-gray-800">
                    <div className="text-center mb-6">
                      <div className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-2">{overallRating}</div>
                      <div className="flex justify-center mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-sm text-gray-600">{totalReviews} total reviews</p>
                    </div>
                    <div className="space-y-2">
                      {ratingDistribution.map((dist) => (
                        <div key={dist.stars} className="flex items-center gap-2">
                          <span className="text-sm w-8">{dist.stars}⭐</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className="bg-[#5BA3D0] h-2 rounded-full" style={{ width: `${dist.percentage}%` }} />
                          </div>
                          <span className="text-sm text-gray-600 w-12">{dist.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Customer Reviews</h3>
                    {reviews.map((review, index) => (
                      <div key={index} className="bg-white dark:bg-gray-800/60 rounded-xl p-5 border border-gray-100 dark:border-gray-800">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-800">{review.name}</span>
                              {review.verified && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Verified Purchase</span>}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-[#7BB8DC] text-[#7BB8DC]' : 'text-gray-300'}`} />
                                ))}
                              </div>
                              <span className="text-xs text-gray-500">{review.date}</span>
                            </div>
                            <p className="text-gray-700">{review.comment}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="specs" className="mt-6">
                <table className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <tbody>
                    <tr className="border-b border-gray-100 dark:border-gray-700"><td className="py-3 px-4 font-semibold text-sm w-1/3 bg-gray-50 dark:bg-gray-800/50">Product Code</td><td className="py-3 px-4 text-sm">{product.id}</td></tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700"><td className="py-3 px-4 font-semibold text-sm bg-gray-50 dark:bg-gray-800/50">Category</td><td className="py-3 px-4 text-sm">{product.category}</td></tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700"><td className="py-3 px-4 font-semibold text-sm bg-gray-50 dark:bg-gray-800/50">Dispatch</td><td className="py-3 px-4 text-sm">{product.featuredSale ? 'High demand - fast dispatch' : 'Standard dispatch'}</td></tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700"><td className="py-3 px-4 font-semibold text-sm bg-gray-50 dark:bg-gray-800/50">MOQ</td><td className="py-3 px-4 text-sm">{product.moq} pieces</td></tr>
                    <tr><td className="py-3 px-4 font-semibold text-sm bg-gray-50 dark:bg-gray-800/50">Shipping</td><td className="py-3 px-4 text-sm">Worldwide Available</td></tr>
                  </tbody>
                </table>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {fullscreenOpen && galleryItems.length > 0 && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 dark:bg-black/90 px-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeFullscreen();
              }}
            />

            <div className="relative w-full max-w-5xl">
              <div className="flex items-center justify-between gap-4 text-white mb-3">
                <div className="text-sm opacity-90">
                  {fullscreenIndex + 1} / {galleryItems.length}
                </div>
                <button
                  type="button"
                  onClick={closeFullscreen}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                  aria-label="Close fullscreen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/20">
                {galleryItems[fullscreenIndex]?.type === 'video' ? (
                  <video
                    src={galleryItems[fullscreenIndex]?.src}
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[80vh] object-contain"
                  />
                ) : (
                  <img
                    src={galleryItems[fullscreenIndex]?.src}
                    alt={displayTitle || 'Product media'}
                    className="w-full max-h-[80vh] object-contain bg-black"
                  />
                )}
              </div>

              {galleryItems.length > 1 && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => goFullscreenTo(fullscreenIndex - 1)}
                    className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
                    aria-label="Previous media"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => goFullscreenTo(fullscreenIndex + 1)}
                    className="px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-white"
                    aria-label="Next media"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* More Products */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5 tracking-tight">More Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
            {relatedProducts.map((rp) => (
              <ProductCard
                key={rp._id || rp.id}
                product={rp}
                onAddToCart={onAddToCart}
                onToggleWishlist={toggleWishlist}
                isWishlisted={isWishlisted(rp)}
              />
            ))}
          </div>

          {relatedHasMore ? (
            <div className="mt-10 flex justify-center">
              <Button
                onClick={showMoreProducts}
                disabled={relatedLoadingMore}
                className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white rounded-xl px-10 font-semibold text-sm transition-colors duration-200"
              >
                {relatedLoadingMore ? 'Loading…' : 'Show More'}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default EnhancedProductDetail;
