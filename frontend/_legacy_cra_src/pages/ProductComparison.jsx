import React from 'react';
import { useComparison } from '../context/ComparisonContext';
import { ShoppingCart } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import ComparisonPanel from '../components/ComparisonPanel';

const ProductComparison = () => {
  const { comparisonList, removeFromComparison, clearComparison } = useComparison();
  const navigate = useNavigate();

  if (comparisonList.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 py-10">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 tracking-tight">Product comparison</h1>
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800 shadow-soft animate-fade-in">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No products to compare</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Add products from listing or detail pages using the compare action.</p>
            <Button
              onClick={() => navigate('/products')}
              className="bg-[#5BA3D0] hover:bg-[#4A90B8] text-white rounded-xl"
            >
              Browse products
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 py-8 pb-24">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8">
        <ComparisonPanel
          comparisonList={comparisonList}
          removeFromComparison={removeFromComparison}
          clearComparison={clearComparison}
          showHeaderActions
        />
      </div>
    </div>
  );
};

export default ProductComparison;
