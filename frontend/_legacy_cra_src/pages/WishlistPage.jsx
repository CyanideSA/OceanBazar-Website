import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ShoppingBag, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { productAPI } from "../api/service";
import ProductCard from "../components/ProductCard";
import { useWishlist } from "../context/WishlistContext";

const WishlistPage = ({ onAddToCart }) => {
  const navigate = useNavigate();
  const { wishlistItems, removeFromWishlist, isWishlisted, toggleWishlist } = useWishlist();

  const wishlistIds = useMemo(
    () => wishlistItems.map((it) => String(it?.id)).filter(Boolean),
    [wishlistItems]
  );
  const wishlistKey = useMemo(() => wishlistIds.join("|"), [wishlistIds]);

  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      if (wishlistIds.length === 0) {
        setProducts([]);
        return;
      }
      setLoading(true);
      try {
        const results = await Promise.all(
          wishlistIds.map((id) =>
            productAPI
              .getById(id)
              .then((r) => ({ id, product: r.data }))
              .catch(() => ({ id, product: null }))
          )
        );
        if (cancelled) return;
        const valid = [];
        const invalidIds = [];
        results.forEach((row) => {
          if (row.product) valid.push(row.product);
          else invalidIds.push(row.id);
        });
        setProducts(valid);
        invalidIds.forEach((id) => removeFromWishlist(id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [wishlistKey, removeFromWishlist, wishlistIds]);

  if (wishlistIds.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#5BA3D0] mb-6 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-800 p-12 text-center animate-fade-in">
            <Heart className="w-16 h-16 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Your wishlist is empty</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Save products to see them here anytime.</p>
            <Button
              onClick={() => navigate("/products")}
              className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white rounded-xl px-6"
            >
              Browse Products
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#5BA3D0] mb-6 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 tracking-tight">Wishlist</h1>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800/80 rounded-2xl p-3.5 animate-pulse border border-gray-100 dark:border-gray-800 aspect-square"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-800 p-12 text-center">
            <ShoppingBag className="w-16 h-16 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No saved products found</h2>
            <p className="text-gray-500 dark:text-gray-400">These items may no longer be available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 sm:gap-5">
            {products.map((p) => (
              <div key={p._id || p.id} className="relative">
                <ProductCard
                  product={p}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={() => toggleWishlist(p)}
                  isWishlisted={isWishlisted(p)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-xs text-gray-400 dark:text-gray-500">
          Tip: tap the heart on any product to remove it from your wishlist.
        </div>
      </div>
    </div>
  );
};

export default WishlistPage;
