import React from "react";
import { X, Star } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { productDetailPath } from "../utils/productId";
import { normalizeProductImageUrl } from "../utils/mediaUrl";
import { getCurrentUserType, getDisplayPrices, getMsrpPerUnit } from "../utils/pricing";

/**
 * Shared compare table for full page and dialog (light/dark + mobile scroll).
 */
export default function ComparisonPanel({
  comparisonList,
  removeFromComparison,
  clearComparison,
  showHeaderActions = true,
}) {
  const navigate = useNavigate();
  const userType = getCurrentUserType();

  if (!comparisonList?.length) {
    return null;
  }

  return (
    <div className="w-full">
      {showHeaderActions ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Compare products
          </h2>
          <Button
            type="button"
            onClick={clearComparison}
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 rounded-xl text-sm shrink-0"
          >
            Clear all
          </Button>
        </div>
      ) : null}

      <div className="bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-x-auto shadow-soft">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="p-3 sm:p-4 text-left text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 sticky left-0 z-10 min-w-[100px]">
                Feature
              </th>
              {comparisonList.map((product) => {
                const pid = product.id || product._id;
                const img = normalizeProductImageUrl(product?.image);
                return (
                  <th key={pid} className="p-3 sm:p-4 text-center min-w-[160px] sm:min-w-[200px]">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => removeFromComparison(String(pid))}
                        className="absolute -top-1 -right-1 w-7 h-7 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors duration-200"
                        aria-label="Remove from compare"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <img
                        src={img || "https://placehold.co/400x400/f0f4f8/5ba3d0?text=OceanBazar"}
                        alt=""
                        className="w-full h-24 sm:h-28 object-cover rounded-xl mb-2 bg-gray-50 dark:bg-gray-800"
                      />
                      <p className="font-semibold text-gray-800 dark:text-gray-200 text-xs sm:text-sm line-clamp-2">
                        {product.name}
                      </p>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 sticky left-0">
                Price
              </td>
              {comparisonList.map((product) => {
                const pid = product.id || product._id;
                const pricing = getDisplayPrices(product, userType, 1);
                const msrp = getMsrpPerUnit(product);
                return (
                  <td key={pid} className="p-3 sm:p-4 text-center align-top">
                    {msrp != null && msrp > pricing.unitPrice + 1e-6 ? (
                      <div className="text-xs text-gray-500 line-through mb-0.5">${Number(msrp).toFixed(2)}</div>
                    ) : null}
                    <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                      ${Number(pricing.unitPrice).toFixed(2)}
                    </span>
                  </td>
                );
              })}
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 sticky left-0">
                Rating
              </td>
              {comparisonList.map((product) => (
                <td key={product.id || product._id} className="p-3 sm:p-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                      {Number(product.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 sticky left-0">
                Brand
              </td>
              {comparisonList.map((product) => (
                <td key={product.id || product._id} className="p-3 sm:p-4 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {product.brand || "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 sticky left-0">
                Category
              </td>
              {comparisonList.map((product) => (
                <td key={product.id || product._id} className="p-3 sm:p-4 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {product.category || "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 sticky left-0">
                MOQ
              </td>
              {comparisonList.map((product) => (
                <td key={product.id || product._id} className="p-3 sm:p-4 text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {product.moq ?? 1} units
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 sticky left-0">
                Stock
              </td>
              {comparisonList.map((product) => (
                <td key={product.id || product._id} className="p-3 sm:p-4 text-center">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      product.stock > 100
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : product.stock > 0
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {product.stock > 0 ? `${product.stock} available` : "Out of stock"}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3 sm:p-4 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 sticky left-0">
                Actions
              </td>
              {comparisonList.map((product) => {
                const pid = String(product.id || product._id);
                return (
                  <td key={pid} className="p-3 sm:p-4 text-center">
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        onClick={() => navigate(productDetailPath(pid))}
                        className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white w-full rounded-lg text-xs sm:text-sm"
                      >
                        View details
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => removeFromComparison(pid)}
                        className="w-full rounded-lg text-xs sm:text-sm"
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-xs sm:text-sm text-gray-400 dark:text-gray-500">
        Comparing {comparisonList.length} of 4 products maximum
      </p>
    </div>
  );
}
