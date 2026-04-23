import React from 'react';
import { ShoppingCart, Star, CheckCircle, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { productDetailPath } from '../utils/productId';
import { getCurrentUserType, getDisplayPrices, getMsrpPerUnit } from '../utils/pricing';
import { getDisplayProductTitle } from '../utils/productDisplay';
import { normalizeProductImageUrl } from '../utils/mediaUrl';

const ProductCard = ({ product, onAddToCart, onToggleWishlist, isWishlisted }) => {
  const navigate = useNavigate();
  const productId = product.id || product._id;
  const cardTitle = getDisplayProductTitle(product);
  const imageSrc =
    normalizeProductImageUrl(product?.image) ||
    'https://placehold.co/600x600/f0f4f8/5ba3d0?text=OceanBazar';
  const rating = Number(product?.rating ?? 0);
  const orders = Number(product?.orders ?? 0);
  const isFeatured = Boolean(product?.featuredSale);
  const dispatchLabel = isFeatured ? 'High demand - fast dispatch' : 'Standard dispatch';
  const userType = getCurrentUserType();
  const pricing = getDisplayPrices(product, userType, 1);
  const msrp = getMsrpPerUnit(product);

  return (
    <div
      className="bg-white dark:bg-gray-800/90 rounded-2xl premium-card overflow-hidden group cursor-pointer border border-gray-100 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      onClick={() => {
        if (productId) navigate(productDetailPath(productId));
      }}
    >
      <div className="relative overflow-hidden aspect-square bg-gray-50 dark:bg-gray-800">
        <img
          src={imageSrc}
          alt={cardTitle}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          loading="lazy"
        />

        {typeof onToggleWishlist === "function" ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(product);
            }}
            className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-gray-900/70 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 flex items-center justify-center shadow-sm hover:shadow transition-all duration-200"
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            title={isWishlisted ? "Saved" : "Save"}
          >
            <Heart
              className={`w-3.5 h-3.5 transition-colors ${isWishlisted ? "fill-[#5BA3D0] text-[#5BA3D0]" : "text-gray-500 dark:text-gray-400"}`}
            />
          </button>
        ) : null}

        {product.tags && product.tags.length > 0 && (
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
            {product.tags.map((tag, index) => (
              <Badge key={index} className="bg-[#5BA3D0] text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2">
        <h3
          className="text-sm font-normal leading-[1.35] text-gray-900 dark:text-gray-100 line-clamp-2 overflow-hidden break-words group-hover:text-[#5BA3D0] transition-colors duration-200"
          title={cardTitle}
        >
          {cardTitle}
        </h3>
        {productId ? (
          <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 truncate" title={String(productId)}>
            ID {String(productId)}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-0.5 shrink-0">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">{rating.toFixed(1)}</span>
          </div>
          <span className="text-gray-400 dark:text-gray-500">·</span>
          <span>{orders.toLocaleString()} sold</span>
          {product.verified ? (
            <>
              <span className="text-gray-400 dark:text-gray-500">·</span>
              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle className="w-3 h-3 shrink-0" />
                Verified
              </span>
            </>
          ) : null}
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-lg font-bold text-gray-900 dark:text-gray-50 tracking-tight">${pricing.unitPrice.toFixed(2)}</div>
          {msrp != null && msrp > pricing.unitPrice + 1e-6 ? (
            <div className="text-xs text-gray-500 dark:text-gray-400 line-through">${msrp.toFixed(2)}</div>
          ) : null}
          {pricing.strikeRetailForWholesale ? (
            <div className="text-xs text-gray-500 line-through">${pricing.retailBase.toFixed(2)}</div>
          ) : null}
        </div>

        <div className={`text-[11px] leading-snug ${isFeatured ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
          {dispatchLabel}
        </div>

        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate" title={product.category || 'General'}>
          {product.category || 'General'}
        </p>

        <Button
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
          className="w-full h-9 text-xs font-semibold bg-[#5BA3D0] hover:bg-[#4A90B8] text-white rounded-lg transition-colors duration-200 mt-0.5"
        >
          <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
          Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
