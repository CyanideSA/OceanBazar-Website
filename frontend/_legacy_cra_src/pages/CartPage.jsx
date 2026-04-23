import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, ArrowRight, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import ProductCard from '../components/ProductCard';
import { productAPI } from '../api/service';
import { productDetailPath } from '../utils/productId';
import { getCurrentUserType, RETAIL_MAX_ORDER_QTY } from '../utils/pricing';
import { computeCheckoutTotals, GST_RATE } from '../utils/checkoutTotals';

const CartPage = ({ cartItems, onUpdateQuantity, onRemoveFromCart, onAddToCart }) => {
  const navigate = useNavigate();
  const userType = getCurrentUserType();
  const qtyCap = userType === 'wholesale' ? 999999 : RETAIL_MAX_ORDER_QTY;

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const { gst, serviceFee, shipping, total } = computeCheckoutTotals(subtotal);

  const MIN_ROWS = 15;
  const PRODUCTS_PER_ROW_DESKTOP = 8;
  const MIN_PRODUCTS_PER_PAGE = MIN_ROWS * PRODUCTS_PER_ROW_DESKTOP;
  const PRODUCTS_PER_PAGE_LS_KEY = 'oceanBazar_products_per_page';

  const [productsPerPage] = useState(() => {
    const saved = localStorage.getItem(PRODUCTS_PER_PAGE_LS_KEY);
    const n = saved ? Number(saved) : NaN;
    if (Number.isFinite(n) && n > 0) return Math.max(n, MIN_PRODUCTS_PER_PAGE);
    return MIN_PRODUCTS_PER_PAGE;
  });

  const cartProductIds = useMemo(() => {
    const set = new Set();
    cartItems.forEach((item) => {
      const id = item?.id || item?._id;
      if (id != null) set.add(String(id));
    });
    return set;
  }, [cartItems]);

  const [moreProducts, setMoreProducts] = useState([]);
  const [morePage, setMorePage] = useState(1);
  const [moreHasMore, setMoreHasMore] = useState(false);
  const [moreLoadingMore, setMoreLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchPage1 = async () => {
      try {
        const res = await productAPI.getAll({ limit: productsPerPage, page: 1 });
        if (cancelled) return;
        const serverProducts = res.data.products || [];
        setMoreProducts(serverProducts);
        setMorePage(1);
        setMoreHasMore(serverProducts.length === productsPerPage);
      } catch (e) {
        if (cancelled) return;
        setMoreProducts([]);
        setMoreHasMore(false);
      }
    };
    fetchPage1();
    return () => {
      cancelled = true;
    };
  }, [productsPerPage]);

  const displayedMoreProducts = moreProducts.filter((p) => !cartProductIds.has(String(p?._id || p?.id)));

  const mergeUniqueProducts = (prev, next) => {
    const map = new Map();
    [...prev, ...next].forEach((p) => {
      const key = p?._id || p?.id;
      if (!key) return;
      map.set(String(key), p);
    });
    return Array.from(map.values());
  };

  const showMoreProducts = async () => {
    if (moreLoadingMore || !moreHasMore) return;
    setMoreLoadingMore(true);
    try {
      const nextPage = morePage + 1;
      const res = await productAPI.getAll({ limit: productsPerPage, page: nextPage });
      const serverProducts = res.data.products || [];
      setMoreProducts((prev) => mergeUniqueProducts(prev, serverProducts));
      setMorePage(nextPage);
      setMoreHasMore(serverProducts.length === productsPerPage);
    } catch (e) {
      setMoreHasMore(false);
    } finally {
      setMoreLoadingMore(false);
    }
  };

  const isEmpty = cartItems.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-[#5BA3D0] dark:hover:text-[#7BB8DC] mb-6 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Continue Shopping
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6 tracking-tight">Shopping Cart</h1>

        {isEmpty ? (
          <div className="bg-white dark:bg-gray-900/60 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700/80 p-12 text-center animate-fade-in backdrop-blur-sm">
            <ShoppingBag className="w-20 h-20 text-gray-300 dark:text-[#5BA3D0]/45 mx-auto mb-4" aria-hidden />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Your cart is empty</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">Add some products to get started</p>
            <Button
              type="button"
              onClick={() => navigate('/products')}
              className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white shadow-sm rounded-xl px-6 h-11 font-semibold border border-transparent"
            >
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-900/50 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700/80 divide-y divide-gray-100 dark:divide-gray-700/80 backdrop-blur-sm">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row gap-4 sm:gap-5 p-4 sm:p-5">
                    <img
                      src={item.image || 'https://placehold.co/300x300/f0f4f8/5ba3d0?text=OceanBazar'}
                      alt={item.name}
                      className="w-full sm:w-28 h-44 sm:h-28 object-cover rounded-xl bg-gray-100 dark:bg-gray-800/90 ring-1 ring-gray-200/80 dark:ring-gray-700/80 cursor-pointer"
                      onClick={() => navigate(productDetailPath(item.id))}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-50 mb-2 text-sm leading-snug">{item.name}</h3>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-950/50 shadow-inner dark:shadow-none">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-l-lg text-gray-700 dark:text-gray-200"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 border-x border-gray-200 dark:border-gray-600 min-w-[44px] text-center tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.id, Math.min(qtyCap, item.quantity + 1))}
                            className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-r-lg text-gray-700 dark:text-gray-200"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveFromCart(item.id)}
                          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors duration-200"
                          aria-label={`Remove ${item.name} from cart`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-left sm:text-right pt-1 sm:pt-0">
                      <div className="text-xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">${(item.price * item.quantity).toFixed(2)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                        ${item.price} each
                        {userType === 'wholesale' && Number(item?.retailPrice) > Number(item?.price) ? (
                          <span className="line-through ml-2 text-gray-400 dark:text-gray-500">${Number(item.retailPrice).toFixed(2)}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-900/60 rounded-2xl shadow-soft p-5 sm:p-6 sticky top-28 lg:top-32 border border-gray-100 dark:border-gray-700/80 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-5">Order Summary</h2>
                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>GST ({Math.round(GST_RATE * 100)}%)</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">${gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Service fee</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">${serviceFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Shipping</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">${shipping.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between text-base font-bold text-gray-900 dark:text-gray-50">
                    <span>Total</span>
                    <span className="tabular-nums">${total.toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-[#5BA3D0] hover:bg-[#4A90B8] text-white h-11 rounded-xl font-semibold text-sm mb-2.5 transition-colors duration-200 shadow-sm border border-transparent"
                >
                  Proceed to Checkout
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/products')}
                  className="w-full h-11 rounded-xl text-sm font-medium border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950/40 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                >
                  Continue Shopping
                </Button>
                <div className="mt-5 p-3.5 bg-gray-50 dark:bg-gray-950/50 rounded-xl border border-gray-100 dark:border-gray-700/90 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-[#5BA3D0] dark:text-[#7BB8DC] mt-0.5 flex-shrink-0" aria-hidden />
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">Trade Assurance:</span>{' '}
                    <span className="text-gray-600 dark:text-gray-400">Your order is protected by OceanBazar&apos;s buyer protection</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-5 tracking-tight">More Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
            {displayedMoreProducts.map((p) => (
              <ProductCard key={p._id || p.id} product={p} onAddToCart={onAddToCart} />
            ))}
          </div>

          {moreHasMore ? (
            <div className="mt-10 flex justify-center">
              <Button
                type="button"
                onClick={showMoreProducts}
                disabled={moreLoadingMore}
                className="group flex items-center gap-2 bg-[#5BA3D0] hover:bg-[#4A90B8] text-white rounded-xl px-8 h-11 font-semibold text-sm transition-all duration-200 shadow-sm border border-transparent disabled:opacity-60"
              >
                {moreLoadingMore ? 'Loading…' : 'Show More'}
                {!moreLoadingMore && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CartPage;
