import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { sellerAPI, productAPI } from "@/api/service";
import ProductCard from "@/components/ProductCard";
import { useCustomerInbox } from "@/context/CustomerInboxContext";
import { getApiErrorMessage } from "@/utils/apiError";
import { logger } from "@/utils/logger";

export default function SellerStorePage({ onAddToCart }) {
  const { sellerId } = useParams();
  const { catalogLive } = useCustomerInbox();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadStore = useCallback(async () => {
    if (!sellerId) return;
    setLoading(true);
    setLoadError("");
    try {
      const [sellerRes, productsRes] = await Promise.all([
        sellerAPI.getProfile(sellerId),
        productAPI.getAll({ sellerId }),
      ]);
      setSeller(sellerRes.data);
      setProducts(productsRes.data?.products || productsRes.data || []);
    } catch (e) {
      logger.error(e);
      const msg = getApiErrorMessage(e, "Could not load this store.");
      setLoadError(msg);
      setSeller(null);
      setProducts([]);
    }
    setLoading(false);
  }, [sellerId]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const catalogSeqSeenRef = useRef(null);
  useEffect(() => {
    if (catalogSeqSeenRef.current === null) {
      catalogSeqSeenRef.current = catalogLive.seq;
      return;
    }
    if (catalogLive.seq === catalogSeqSeenRef.current) return;
    catalogSeqSeenRef.current = catalogLive.seq;
    if (!catalogLive.seq) return;
    loadStore();
  }, [catalogLive.seq, loadStore]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!seller) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center text-gray-500">
        {loadError || "Seller not found"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center gap-6">
            {seller.logo && <img src={seller.logo} alt={seller.businessName} className="w-24 h-24 rounded-full border-4 border-white/30 object-cover" />}
            <div>
              <h1 className="text-3xl font-bold">{seller.businessName}</h1>
              <p className="text-blue-100 mt-1">{seller.businessType}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                {seller.averageRating > 0 && <span>★ {seller.averageRating}/5 ({seller.totalReviews} reviews)</span>}
                <span>{seller.totalOrders || 0} orders</span>
                {seller.verificationStatus === "verified" && <span className="bg-green-500/20 px-2 py-0.5 rounded-full text-xs">✓ Verified</span>}
              </div>
            </div>
          </div>
          {seller.description && <p className="mt-4 text-blue-50 max-w-2xl">{seller.description}</p>}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-4">Products ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No products listed yet</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map(product => (
              <ProductCard key={product.id || product._id} product={product} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
