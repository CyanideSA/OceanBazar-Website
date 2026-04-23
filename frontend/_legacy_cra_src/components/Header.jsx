import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Globe, User, Menu, Camera, ChevronDown, ChevronRight, Moon, Sun, X, GitCompare } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useTheme } from '../context/ThemeContext';
import SideMenu from './SideMenu';
import { categoryAPI } from '../api/service';
import { CATEGORY_FALLBACK } from '../constants/categories';
import { getCategoryIcon } from '../utils/categoryIcons';
import { useComparison } from '../context/ComparisonContext';

function userInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

const Header = ({ cartCount = 0, isLoggedIn = false, user = null, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { comparisonCount } = useComparison();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [headerCategories, setHeaderCategories] = useState([]);
  const [hoveredParent, setHoveredParent] = useState(null);
  const { theme, toggleTheme } = useTheme();
  const categoriesRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  useEffect(() => {
    const closeIfOutside = (event) => {
      if (categoriesRef.current && !categoriesRef.current.contains(event.target)) {
        setShowCategories(false);
        setHoveredParent(null);
      }
    };
    document.addEventListener('mousedown', closeIfOutside);
    document.addEventListener('touchstart', closeIfOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', closeIfOutside);
      document.removeEventListener('touchstart', closeIfOutside);
    };
  }, []);

  useEffect(() => {
    if (!showCategories) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowCategories(false);
        setHoveredParent(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCategories]);

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const res = await categoryAPI.getAll();
        const list = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) setHeaderCategories(list.length > 0 ? list : CATEGORY_FALLBACK);
      } catch (_) {
        if (!cancelled) setHeaderCategories(CATEGORY_FALLBACK);
      }
    };
    loadCategories();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setShowCategories(false);
    setHoveredParent(null);
  }, [isLoggedIn, location.pathname, location.search]);

  const categories = headerCategories.length > 0 ? headerCategories : CATEGORY_FALLBACK;

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const closeMenu = useCallback(() => {
    setShowCategories(false);
    setHoveredParent(null);
  }, []);

  const handleParentHoverEnter = useCallback((catName) => {
    clearTimeout(hoverTimeoutRef.current);
    setHoveredParent(catName);
  }, []);

  const handleParentHoverLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => setHoveredParent(null), 150);
  }, []);

  return (
    <header className="sticky top-0 z-50 isolate bg-white/95 shadow-soft backdrop-blur-xl dark:bg-gray-900/95 border-b border-gray-100 dark:border-gray-800">
      {/* Top Banner */}
      <div className="hidden sm:block bg-gradient-to-r from-[#4A90B8] via-[#5BA3D0] to-[#7BB8DC] text-white py-2 px-4 text-center text-[13px] font-medium tracking-wide">
        Limited-time offer: up to 20% off 8M+ products
      </div>

      {/* Main Header */}
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 sm:gap-5 md:gap-6">
          <Link to="/" className="flex items-center flex-shrink-0 group">
            <img
              src="https://customer-assets.emergentagent.com/job_ocean-commerce-4/artifacts/nudvg1tt_OceanBazar%20Logo.png"
              alt="OceanBazar"
              className="w-[90px] sm:w-[108px] md:w-[126px] h-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </Link>

          <form onSubmit={handleSearch} className="order-3 md:order-none w-full md:flex-1 md:max-w-2xl">
            <div className="relative flex items-center">
              <Input
                type="text"
                placeholder="Search products, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-12 sm:pr-24 h-10 sm:h-[44px] text-sm rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-[#5BA3D0] bg-gray-50 dark:bg-gray-800 transition-colors duration-200 placeholder:text-gray-400"
              />
              <button
                type="button"
                className="absolute right-12 sm:right-[72px] text-gray-400 dark:text-gray-500 hover:text-[#5BA3D0] transition-colors hidden sm:flex items-center justify-center"
                title="Image Search"
              >
                <Camera className="w-4 h-4" />
              </button>
              <Button
                type="submit"
                className="absolute right-0 h-10 sm:h-[44px] px-4 sm:px-5 bg-[#5BA3D0] hover:bg-[#4A90B8] text-white rounded-l-none rounded-r-xl transition-colors duration-200"
              >
                <Search className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline text-sm font-medium">Search</span>
              </Button>
            </div>
          </form>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0 ml-auto">
            <button
              onClick={toggleTheme}
              className="h-9 w-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4 text-gray-600" /> : <Sun className="w-4 h-4 text-yellow-400" />}
            </button>

            <button className="hidden md:flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200">
              <Globe className="w-4 h-4" />
              <span className="hidden lg:inline text-[13px]">EN-USD</span>
            </button>

            <Link
              to="/comparison"
              className="relative h-9 w-9 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
              title="Compare products"
              aria-label="Compare products"
            >
              <GitCompare className="w-5 h-5" />
              {comparisonCount > 0 ? (
                <span className="absolute -top-1 -right-1 bg-[#5BA3D0] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {comparisonCount}
                </span>
              ) : null}
            </Link>

            <Link to="/cart" className="relative h-9 w-9 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#5BA3D0] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setShowSideMenu(true)}
              className="lg:hidden h-9 w-9 rounded-lg flex items-center justify-center bg-[#5BA3D0] text-white hover:bg-[#4A90B8] transition-colors duration-200"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {isLoggedIn ? (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to="/account/dashboard"
                  className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                >
                  {user?.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-600 shrink-0"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5BA3D0] text-[11px] font-bold text-white">
                      {userInitials(user?.name)}
                    </span>
                  )}
                  <span className="max-w-[120px] truncate">{user?.name ? user.name.split(' ')[0] : 'Account'}</span>
                </Link>
                <button
                  onClick={onLogout}
                  className="h-9 px-3 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 whitespace-nowrap">
                <Link
                  to="/login"
                  className="inline-flex items-center h-9 px-3 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                >
                  Sign in
                </Link>
                <Link to="/signup">
                  <Button className="h-9 px-4 bg-[#5BA3D0] hover:bg-[#4A90B8] text-white text-sm font-medium rounded-lg transition-colors duration-200">
                    Create account
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <SideMenu isOpen={showSideMenu} onOpenChange={setShowSideMenu} isLoggedIn={isLoggedIn} />

      {/* Secondary Navigation — categories sit outside overflow-x so mega menu is not clipped */}
      <div className="relative overflow-visible border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-screen-2xl mx-auto overflow-visible px-3 sm:px-6 lg:px-8 py-1.5">
          <div className="flex min-w-0 items-center justify-between gap-4 sm:gap-6 text-[13px] overflow-visible whitespace-nowrap">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5 overflow-visible">
              <div className="relative shrink-0" ref={categoriesRef}>
                <button
                  type="button"
                  aria-expanded={showCategories}
                  aria-haspopup="menu"
                  aria-controls="header-categories-menu"
                  id="header-all-categories-btn"
                  onClick={() => {
                    setShowCategories((o) => !o);
                    if (showCategories) setHoveredParent(null);
                  }}
                  className={`flex items-center gap-1.5 font-semibold transition-colors duration-200 py-1.5 ${
                    showCategories
                      ? 'text-[#5BA3D0]'
                      : 'text-gray-700 dark:text-gray-300 hover:text-[#5BA3D0]'
                  }`}
                >
                  <Menu className="w-4 h-4 shrink-0" />
                  <span>All categories</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${showCategories ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>

                {/* --- Mega Dropdown --- */}
                <div
                  id="header-categories-menu"
                  role="menu"
                  aria-labelledby="header-all-categories-btn"
                  aria-hidden={!showCategories}
                  className={`absolute left-0 top-full z-[60] mt-1.5 origin-top-left transition-[opacity,transform,visibility] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
                    showCategories
                      ? 'visible translate-y-0 scale-100 opacity-100 pointer-events-auto'
                      : 'invisible -translate-y-1 scale-[0.98] opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="flex overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
                    {/* Left panel — parent categories */}
                    <div className="flex w-64 flex-col border-r border-gray-100 bg-white py-2 dark:border-gray-700 dark:bg-gray-800">
                      <Link
                        to="/products"
                        role="menuitem"
                        className="block px-4 py-2.5 text-[#5BA3D0] font-semibold hover:bg-[#f0f7fc] dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 text-sm"
                        onClick={closeMenu}
                      >
                        Browse all products
                      </Link>
                      <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        Categories
                      </p>
                      <div className="flex-1 overflow-y-auto max-h-[60vh]">
                        {categories.map((cat) => {
                          const CatIcon = getCategoryIcon(cat.icon);
                          const hasChildren = cat.children && cat.children.length > 0;
                          const isHovered = hoveredParent === cat.name;
                          return (
                            <div
                              key={cat.id || cat.name}
                              className="relative"
                              onMouseEnter={() => handleParentHoverEnter(cat.name)}
                              onMouseLeave={handleParentHoverLeave}
                            >
                              <Link
                                role="menuitem"
                                to={`/products?category=${encodeURIComponent(cat.name)}`}
                                className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors duration-150 ${
                                  isHovered
                                    ? 'bg-[#f0f7fc] dark:bg-gray-700 text-[#5BA3D0]'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-[#5BA3D0]'
                                }`}
                                onClick={closeMenu}
                              >
                                <span className="flex items-center gap-2.5 min-w-0">
                                  <CatIcon className="w-4 h-4 shrink-0 text-[#5BA3D0]" aria-hidden />
                                  <span className="truncate">{cat.name}</span>
                                </span>
                                <span className="flex items-center gap-2 shrink-0">
                                  {typeof cat.count === 'number' && (
                                    <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{cat.count}</span>
                                  )}
                                  {hasChildren && (
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                  )}
                                </span>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                      <Link
                        to="/products?featuredSale=true"
                        role="menuitem"
                        className="block px-4 py-2.5 text-sm text-[#5BA3D0] font-medium hover:bg-[#f0f7fc] dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700 mt-auto"
                        onClick={closeMenu}
                      >
                        Featured sales only →
                      </Link>
                    </div>

                    {/* Right panel — child categories (appears on hover) */}
                    {categories.map((cat) => {
                      const hasChildren = cat.children && cat.children.length > 0;
                      if (!hasChildren) return null;
                      const isVisible = hoveredParent === cat.name;
                      return (
                        <div
                          key={`sub-${cat.id || cat.name}`}
                          className={`w-56 bg-white py-2 transition-[opacity,transform,visibility] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 dark:bg-gray-800 ${
                            isVisible
                              ? 'pointer-events-auto visible translate-x-0 scale-100 rounded-r-xl opacity-100'
                              : 'pointer-events-none invisible absolute left-64 top-0 -translate-x-1 scale-[0.99] opacity-0'
                          }`}
                          style={isVisible ? { position: 'relative', marginLeft: '-1px' } : { position: 'absolute', left: '16rem', top: 0 }}
                          onMouseEnter={() => handleParentHoverEnter(cat.name)}
                          onMouseLeave={handleParentHoverLeave}
                        >
                          <p className="px-4 pt-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                            {cat.name}
                          </p>
                          {cat.children.map((child) => {
                            const ChildIcon = getCategoryIcon(child.icon);
                            return (
                              <Link
                                key={child.id || child.name}
                                role="menuitem"
                                to={`/products?category=${encodeURIComponent(child.name)}`}
                                className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-[#f0f7fc] dark:hover:bg-gray-700 hover:text-[#5BA3D0] transition-colors duration-150"
                                onClick={closeMenu}
                              >
                                <ChildIcon className="w-3.5 h-3.5 shrink-0 text-[#5BA3D0]/70" aria-hidden />
                                <span className="truncate">{child.name}</span>
                                {typeof child.count === 'number' && (
                                  <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{child.count}</span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="hidden min-w-0 overflow-x-auto md:flex md:items-center [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Link
                  to="/protections"
                  className="inline-block shrink-0 py-1.5 font-medium text-gray-500 transition-colors duration-200 hover:text-[#5BA3D0] dark:text-gray-400"
                >
                  Order protections
                </Link>
              </div>
            </div>
            <div className="flex max-w-[min(100%,22rem)] shrink-0 items-center gap-4 overflow-x-auto whitespace-nowrap sm:max-w-none md:gap-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link to="/wholesale-hub" className="text-gray-500 dark:text-gray-400 hover:text-[#5BA3D0] transition-colors duration-200 font-medium py-1.5">
                Wholesale Hub
              </Link>
              <Link to="/help" className="text-gray-500 dark:text-gray-400 hover:text-[#5BA3D0] transition-colors duration-200 font-medium py-1.5">
                Help Center
              </Link>
              <Link to="/business-inquiry" className="text-gray-500 dark:text-gray-400 hover:text-[#5BA3D0] transition-colors duration-200 hidden lg:inline font-medium py-1.5">
                Business inquiries
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
