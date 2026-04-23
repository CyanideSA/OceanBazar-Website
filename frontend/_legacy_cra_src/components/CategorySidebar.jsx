import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { categoryAPI } from '../api/service';
import { CATEGORY_FALLBACK } from '../constants/categories';
import { getCategoryIcon } from '../utils/categoryIcons';

const CategorySidebar = ({ onCategoryClick }) => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await categoryAPI.getAll();
        const list = Array.isArray(res.data) ? res.data : [];
        setCategories(list.length > 0 ? list : CATEGORY_FALLBACK);
      } catch (e) {
        setCategories(CATEGORY_FALLBACK);
      }
    };
    load();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 w-64">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <span>Categories for you</span>
      </h3>
      <div className="space-y-1">
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.icon);
          return (
            <button
              key={category.id || category.name}
              onClick={() => onCategoryClick(category.name)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-orange-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-gray-600 group-hover:text-orange-500" />
                <span className="text-sm text-gray-700 group-hover:text-orange-600">
                  {category.name}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategorySidebar;
