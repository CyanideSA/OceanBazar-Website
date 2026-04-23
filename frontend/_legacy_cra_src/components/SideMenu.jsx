import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, Shield, Package, HelpCircle, Briefcase, LogIn, UserPlus, User, LayoutGrid, Heart, ChevronDown } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from './ui/sheet';
import { categoryAPI } from '../api/service';
import { CATEGORY_FALLBACK } from '../constants/categories';
import { getCategoryIcon } from '../utils/categoryIcons';

const SideMenu = ({ isOpen, onOpenChange, isLoggedIn }) => {
  const [shopCategories, setShopCategories] = useState([]);
  const [expandedCat, setExpandedCat] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await categoryAPI.getAll();
        if (!cancelled) {
          const list = Array.isArray(res.data) ? res.data : [];
          setShopCategories(list.length > 0 ? list : CATEGORY_FALLBACK);
        }
      } catch {
        if (!cancelled) setShopCategories(CATEGORY_FALLBACK);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isOpen) setExpandedCat(null);
  }, [isOpen]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const cats = shopCategories.length > 0 ? shopCategories : CATEGORY_FALLBACK;

  const toggleExpand = useCallback((catName) => {
    setExpandedCat((prev) => (prev === catName ? null : catName));
  }, []);

  const menuItems = [
    { to: '/protections', icon: Shield, label: 'Order Protection', description: 'Safe buying guarantee' },
    { to: '/wholesale-hub', icon: Package, label: 'Wholesale Hub', description: 'Bulk ordering & deals' },
    { to: '/help', icon: HelpCircle, label: 'Help Center', description: 'Support & FAQs' },
    { to: '/business-inquiry', icon: Briefcase, label: 'Business with Us', description: 'Partnership opportunities' },
    { to: '/wishlist', icon: Heart, label: 'Wishlist', description: 'Saved items' },
  ];

  const authItems = isLoggedIn
    ? [{ to: '/account/dashboard', icon: User, label: 'My Account', description: 'Dashboard, orders, settings' }]
    : [
        { to: '/login', icon: LogIn, label: 'Sign In', description: 'Access your account' },
        { to: '/signup', icon: UserPlus, label: 'Sign Up', description: 'Create new account' },
      ];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[92vw] max-w-80 bg-gradient-to-br from-white to-[#F5F9FC] dark:from-gray-900 dark:to-gray-800 border-r-2 border-[#5BA3D0] overflow-y-auto overflow-x-hidden">
        <SheetHeader className="border-b border-[#E4F0F9] dark:border-gray-700 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold bg-gradient-to-r from-[#5BA3D0] to-[#7BB8DC] bg-clip-text text-transparent">
              Menu
            </SheetTitle>
            <SheetClose asChild>
              <button type="button" className="text-gray-500 dark:text-gray-400 hover:text-[#5BA3D0] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </SheetClose>
          </div>
        </SheetHeader>

        <nav className="mt-4 space-y-1 pb-36">
          {/* Categories section */}
          <div className="px-1 mb-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 mb-2 flex items-center gap-2">
              <LayoutGrid className="w-3.5 h-3.5" />
              All categories
            </p>
            <Link
              to="/products"
              onClick={close}
              className="block px-4 py-3 rounded-lg font-semibold text-[#5BA3D0] bg-[#F5F9FC] dark:bg-gray-800 hover:bg-[#E4F0F9] dark:hover:bg-gray-700"
            >
              Browse all products
            </Link>
            <Link
              to="/products?featuredSale=true"
              onClick={close}
              className="block px-4 py-2.5 mt-1 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-[#E4F0F9] dark:hover:bg-gray-700"
            >
              Featured sales only
            </Link>

            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 mt-4 mb-2">
              Shop by category
            </p>
            <div className="rounded-lg border border-[#E4F0F9] dark:border-gray-700 overflow-hidden">
              {cats.map((cat) => {
                const CatIcon = getCategoryIcon(cat.icon);
                const hasChildren = cat.children && cat.children.length > 0;
                const isExpanded = expandedCat === cat.name;

                return (
                  <div key={cat.id || cat.name} className="border-b border-[#E4F0F9] dark:border-gray-700 last:border-b-0">
                    <div className="flex items-center">
                      <Link
                        to={`/products?category=${encodeURIComponent(cat.name)}`}
                        onClick={close}
                        className="flex-1 flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-[#F5F9FC] dark:hover:bg-gray-700 hover:text-[#5BA3D0] transition-colors duration-150"
                      >
                        <CatIcon className="w-4 h-4 shrink-0 text-[#5BA3D0]" />
                        <span className="truncate">{cat.name}</span>
                        {typeof cat.count === 'number' && (
                          <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{cat.count}</span>
                        )}
                      </Link>
                      {hasChildren && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(cat.name)}
                          className="px-3 py-2.5 text-gray-400 hover:text-[#5BA3D0] transition-colors duration-150"
                          aria-label={`Expand ${cat.name}`}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      )}
                    </div>

                    {/* Accordion children */}
                    {hasChildren && (
                      <div
                        className="overflow-hidden transition-all duration-300 ease-in-out"
                        style={{
                          maxHeight: isExpanded ? `${cat.children.length * 44}px` : '0px',
                          opacity: isExpanded ? 1 : 0,
                        }}
                      >
                        <div className="bg-[#F5F9FC]/60 dark:bg-gray-800/40">
                          {cat.children.map((child) => {
                            const ChildIcon = getCategoryIcon(child.icon);
                            return (
                              <Link
                                key={child.id || child.name}
                                to={`/products?category=${encodeURIComponent(child.name)}`}
                                onClick={close}
                                className="flex items-center gap-2.5 pl-10 pr-4 py-2.5 text-[13px] text-gray-600 dark:text-gray-400 hover:bg-[#E4F0F9] dark:hover:bg-gray-700 hover:text-[#5BA3D0] transition-colors duration-150"
                              >
                                <ChildIcon className="w-3.5 h-3.5 shrink-0 text-[#5BA3D0]/60" />
                                <span className="truncate">{child.name}</span>
                                {typeof child.count === 'number' && (
                                  <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{child.count}</span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Menu items */}
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={close}
                className="flex items-start gap-3 p-4 rounded-xl hover:bg-[#E4F0F9] dark:hover:bg-gray-700 transition-all group active:scale-[0.99] min-h-[64px]"
              >
                <div className="mt-0.5 p-2.5 rounded-lg bg-gradient-to-br from-[#5BA3D0] to-[#7BB8DC] text-white group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800 dark:text-gray-100 group-hover:text-[#5BA3D0] transition-colors">
                    {item.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                </div>
              </Link>
            );
          })}

          {/* Auth section */}
          {authItems.length > 0 && (
            <>
              <div className="my-4 border-t border-[#E4F0F9] dark:border-gray-700 pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3 mb-2">
                  Account
                </p>
              </div>
              {authItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={close}
                    className="flex items-start gap-3 p-4 rounded-xl hover:bg-[#E4F0F9] dark:hover:bg-gray-700 transition-all group active:scale-[0.99] min-h-[64px]"
                  >
                    <div className="mt-0.5 p-2.5 rounded-lg bg-gradient-to-br from-[#5BA3D0] to-[#7BB8DC] text-white group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 dark:text-gray-100 group-hover:text-[#5BA3D0] transition-colors">
                        {item.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Wave animation */}
        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none overflow-hidden" aria-hidden="true">
          <style>{`
            @keyframes sideMenuWave1 {
              0%   { d: path("M0,20 C40,8 80,32 120,20 C160,8 200,32 240,20 C280,8 320,32 320,20 L320,80 L0,80 Z"); }
              50%  { d: path("M0,20 C40,32 80,8 120,20 C160,32 200,8 240,20 C280,32 320,8 320,20 L320,80 L0,80 Z"); }
              100% { d: path("M0,20 C40,8 80,32 120,20 C160,8 200,32 240,20 C280,8 320,32 320,20 L320,80 L0,80 Z"); }
            }
            @keyframes sideMenuWave2 {
              0%   { d: path("M0,28 C50,38 100,18 150,28 C200,38 250,18 320,28 L320,80 L0,80 Z"); }
              50%  { d: path("M0,28 C50,18 100,38 150,28 C200,18 250,38 320,28 L320,80 L0,80 Z"); }
              100% { d: path("M0,28 C50,38 100,18 150,28 C200,38 250,18 320,28 L320,80 L0,80 Z"); }
            }
            @keyframes sideMenuWave3 {
              0%   { d: path("M0,36 C60,46 130,26 200,36 C270,46 300,26 320,36 L320,80 L0,80 Z"); }
              50%  { d: path("M0,36 C60,26 130,46 200,36 C270,26 300,46 320,36 L320,80 L0,80 Z"); }
              100% { d: path("M0,36 C60,46 130,26 200,36 C270,46 300,26 320,36 L320,80 L0,80 Z"); }
            }
          `}</style>

          <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 320 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="smWaveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#5BA3D0" />
                <stop offset="100%" stopColor="#7BB8DC" />
              </linearGradient>
              <linearGradient id="smWaveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7BB8DC" />
                <stop offset="100%" stopColor="#5BA3D0" />
              </linearGradient>
            </defs>
            <path d="M0,20 C40,8 80,32 120,20 C160,8 200,32 240,20 C280,8 320,32 320,20 L320,80 L0,80 Z" fill="url(#smWaveGrad1)" opacity="0.07" style={{ animation: 'sideMenuWave1 6s ease-in-out infinite' }} />
            <path d="M0,28 C50,38 100,18 150,28 C200,38 250,18 320,28 L320,80 L0,80 Z" fill="url(#smWaveGrad2)" opacity="0.10" style={{ animation: 'sideMenuWave2 5s ease-in-out infinite' }} />
            <path d="M0,36 C60,46 130,26 200,36 C270,46 300,26 320,36 L320,80 L0,80 Z" fill="url(#smWaveGrad1)" opacity="0.14" style={{ animation: 'sideMenuWave3 4s ease-in-out infinite' }} />
          </svg>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SideMenu;
