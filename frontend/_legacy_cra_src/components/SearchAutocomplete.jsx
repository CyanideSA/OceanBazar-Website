import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { productAPI } from "@/api/service";

export default function SearchAutocomplete({ onSearch, className = "" }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("oceanBazar_recentSearches") || "[]");
    setRecentSearches(saved.slice(0, 5));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await productAPI.getAll({ search: q, limit: 6 });
      const products = res.data?.products || res.data || [];
      setSuggestions(products.slice(0, 6));
    } catch {
      setSuggestions([]);
    }
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const saveRecent = (q) => {
    const saved = JSON.parse(localStorage.getItem("oceanBazar_recentSearches") || "[]");
    const updated = [q, ...saved.filter((s) => s !== q)].slice(0, 8);
    localStorage.setItem("oceanBazar_recentSearches", JSON.stringify(updated));
    setRecentSearches(updated.slice(0, 5));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    saveRecent(query.trim());
    setShowDropdown(false);
    if (onSearch) onSearch(query.trim());
    else navigate(`/products?search=${encodeURIComponent(query.trim())}`);
  };

  const handleSuggestionClick = (product) => {
    setShowDropdown(false);
    setQuery(product.name);
    saveRecent(product.name);
    navigate(`/product/${product.id || product._id}`);
  };

  const handleRecentClick = (term) => {
    setQuery(term);
    setShowDropdown(false);
    if (onSearch) onSearch(term);
    else navigate(`/products?search=${encodeURIComponent(term)}`);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search products, brands, categories..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-full bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition text-sm"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </form>

      {showDropdown && (query.length >= 2 || recentSearches.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-96">
          {loading && <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>}

          {!loading && suggestions.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">Products</div>
              {suggestions.map((product) => (
                <button
                  key={product.id || product._id}
                  onClick={() => handleSuggestionClick(product)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left"
                >
                  {product.image && <img src={product.image} alt="" className="w-10 h-10 object-cover rounded" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.category} — ${product.price}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && suggestions.length === 0 && query.length >= 2 && (
            <div className="px-4 py-3 text-sm text-gray-400">No products found</div>
          )}

          {recentSearches.length > 0 && !loading && suggestions.length === 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">Recent Searches</div>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => handleRecentClick(term)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition text-left"
                >
                  <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">{term}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
