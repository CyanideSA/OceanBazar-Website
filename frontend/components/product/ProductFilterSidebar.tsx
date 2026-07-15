'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { ChevronDown, ChevronRight, Star, X } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FilterCategory {
  id: string;
  name: string;
  nameEn: string;
  nameBn: string;
  slug: string;
  icon: string | null;
  children?: FilterCategory[];
  parentId?: string | null;
}

export interface FilterBrand {
  id: string;
  name: string;
  nameEn: string;
  nameBn: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
}

export interface RatingBucket {
  minRating: number;
  count: number;
}

export interface FilterCollection {
  key: string;
  labelEn: string;
  labelBn: string;
}

export interface FiltersData {
  categories: FilterCategory[];
  brands: FilterBrand[];
  priceRange: { min: number; max: number };
  ratingBuckets: RatingBucket[];
  collections: FilterCollection[];
}

export interface ActiveFilters {
  category: string;
  brands: string[];
  minPrice: number | null;
  maxPrice: number | null;
  rating: number | null;
  collection: string;
}

interface Props {
  filters: FiltersData | null;
  active: ActiveFilters;
  onChange: (next: Partial<ActiveFilters>) => void;
}

// ─── Stars renderer ─────────────────────────────────────────────────────────

function Stars({ count, size = 14 }: { count: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={i < count ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
          size={size}
        />
      ))}
    </span>
  );
}

// ─── Department (Categories) Section ────────────────────────────────────────

function DepartmentSection({
  categories,
  activeCategory,
  onSelect,
}: {
  categories: FilterCategory[];
  activeCategory: string;
  onSelect: (id: string) => void;
}) {
  const locale = useLocale();
  const getName = (c: FilterCategory) => (locale === 'bn' ? c.nameBn : c.nameEn);

  // Find if activeCategory is a parent or a child
  let activeParent: FilterCategory | null = null;
  let activeChild: FilterCategory | null = null;

  if (activeCategory) {
    for (const parent of categories) {
      if (parent.id === activeCategory) {
        activeParent = parent;
        break;
      }
      const child = parent.children?.find((c) => c.id === activeCategory);
      if (child) {
        activeParent = parent;
        activeChild = child;
        break;
      }
    }
  }

  // ── Drill-down view: a parent (or child) is selected ──────────────────────
  if (activeParent) {
    return (
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">Categories</h3>

        {/* Back to all categories */}
        <button
          onClick={() => onSelect('')}
          className="flex items-center gap-1 text-sm text-primary hover:underline mb-2"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          Any Category
        </button>

        {/* Active parent name */}
        <p className="text-sm font-bold text-foreground mb-1 ml-1">
          {getName(activeParent)}
        </p>

        {/* Subcategories flat list */}
        {activeParent.children && activeParent.children.length > 0 && (
          <ul className="ml-4 space-y-0.5">
            {activeParent.children.map((child) => (
              <li key={child.id}>
                <button
                  onClick={() => onSelect(child.id)}
                  className={`text-sm py-0.5 text-left transition-colors ${
                    activeChild?.id === child.id
                      ? 'font-bold text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:underline'
                  }`}
                >
                  {getName(child)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Default view: no category selected — show all parents ─────────────────
  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-2">Categories</h3>
      <ul className="space-y-0.5">
        {categories.map((parent) => (
          <li key={parent.id}>
            <button
              onClick={() => onSelect(parent.id)}
              className="text-sm py-0.5 text-left text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              {getName(parent)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Customer Review Section ────────────────────────────────────────────────

function RatingSection({
  buckets,
  activeRating,
  onSelect,
}: {
  buckets: RatingBucket[];
  activeRating: number | null;
  onSelect: (rating: number | null) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-2">Customer Review</h3>
      <div className="space-y-1.5">
        {buckets.map((b) => (
          <button
            key={b.minRating}
            onClick={() => onSelect(activeRating === b.minRating ? null : b.minRating)}
            className={`flex items-center gap-2 w-full text-left py-0.5 transition-colors ${
              activeRating === b.minRating
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Stars count={b.minRating} />
            <span className="text-sm">& Up</span>
            {activeRating === b.minRating && (
              <X className="h-3 w-3 ml-auto text-muted-foreground" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Brands Section ─────────────────────────────────────────────────────────

function BrandsSection({
  brands,
  selectedBrands,
  onToggle,
}: {
  brands: FilterBrand[];
  selectedBrands: string[];
  onToggle: (brandId: string) => void;
}) {
  const locale = useLocale();
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 7;
  const displayed = showAll ? brands : brands.slice(0, INITIAL_SHOW);

  const getName = (b: FilterBrand) => (locale === 'bn' ? b.nameBn : b.nameEn);

  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-2">Brands</h3>
      <div className="space-y-1.5">
        {displayed.map((b) => {
          const checked = selectedBrands.includes(b.id);
          return (
            <label
              key={b.id}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(b.id)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
              />
              <span
                className={`text-sm transition-colors ${
                  checked ? 'font-medium text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                }`}
              >
                {getName(b)}
              </span>
            </label>
          );
        })}
      </div>
      {brands.length > INITIAL_SHOW && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? 'See less' : `See more (${brands.length - INITIAL_SHOW})`}
        </button>
      )}
    </div>
  );
}

// ─── Price Section ──────────────────────────────────────────────────────────

function PriceSection({
  range,
  activeMin,
  activeMax,
  onChange,
}: {
  range: { min: number; max: number };
  activeMin: number | null;
  activeMax: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  // Fixed 0–10,000 BDT range for the slider
  const sliderMin = 0;
  const sliderMax = 10000;

  const [localMin, setLocalMin] = useState(activeMin ?? sliderMin);
  const [localMax, setLocalMax] = useState(activeMax ?? sliderMax);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalMin(activeMin ?? sliderMin);
    setLocalMax(activeMax ?? sliderMax);
  }, [activeMin, activeMax]);

  const handleMinChange = (val: number) => {
    const clamped = Math.max(sliderMin, Math.min(val, localMax));
    setLocalMin(clamped);
    debouncedApply(clamped, localMax);
  };

  const handleMaxChange = (val: number) => {
    const clamped = Math.min(sliderMax, Math.max(val, localMin));
    setLocalMax(clamped);
    debouncedApply(localMin, clamped);
  };

  const debouncedApply = useCallback(
    (min: number, max: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const newMin = min <= sliderMin ? null : min;
        const newMax = max >= sliderMax ? null : max;
        onChange(newMin, newMax);
      }, 500);
    },
    [onChange],
  );

  const quickRanges = [
    { label: 'Under ৳1,000', min: null, max: 1000 },
    { label: '৳1,000 to ৳3,000', min: 1000, max: 3000 },
    { label: '৳3,000 to ৳5,000', min: 3000, max: 5000 },
    { label: '৳5,000 to ৳8,000', min: 5000, max: 8000 },
    { label: '৳8,000 & above', min: 8000, max: null },
  ];

  const isActive = activeMin !== null || activeMax !== null;

  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-2">Price</h3>

      {/* Range display */}
      <p className="text-xs text-muted-foreground mb-2">
        ৳{sliderMin.toLocaleString()} – ৳{sliderMax.toLocaleString()}+
      </p>

      {/* Dual range slider */}
      <div className="relative h-8 mb-3">
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          value={localMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-auto z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          value={localMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-auto z-20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer"
        />
        {/* Track background */}
        <div className="absolute top-1/2 -translate-y-1/2 h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full"
          style={{
            left: `${((localMin - sliderMin) / (sliderMax - sliderMin)) * 100}%`,
            right: `${100 - ((localMax - sliderMin) / (sliderMax - sliderMin)) * 100}%`,
          }}
        />
      </div>

      {/* Editable price inputs */}
      <div className="flex items-center gap-2 text-xs mb-3">
        <div className="flex items-center rounded bg-accent px-2 py-1">
          <span className="text-muted-foreground mr-0.5">৳</span>
          <input
            type="number"
            min={sliderMin}
            max={localMax}
            value={localMin}
            onChange={(e) => handleMinChange(Number(e.target.value))}
            onBlur={() => debouncedApply(localMin, localMax)}
            className="w-14 bg-transparent text-foreground text-xs font-medium outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <span className="text-muted-foreground">–</span>
        <div className="flex items-center rounded bg-accent px-2 py-1">
          <span className="text-muted-foreground mr-0.5">৳</span>
          <input
            type="number"
            min={localMin}
            max={sliderMax}
            value={localMax}
            onChange={(e) => handleMaxChange(Number(e.target.value))}
            onBlur={() => debouncedApply(localMin, localMax)}
            className="w-14 bg-transparent text-foreground text-xs font-medium outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <button
          onClick={() => debouncedApply(localMin, localMax)}
          className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go
        </button>
      </div>

      {/* Quick range links */}
      <div className="space-y-1">
        {quickRanges.map((qr, i) => {
          const isSelected =
            activeMin === qr.min && activeMax === qr.max;
          return (
            <button
              key={i}
              onClick={() => {
                if (isSelected) {
                  onChange(null, null);
                } else {
                  onChange(qr.min, qr.max);
                }
              }}
              className={`block text-sm transition-colors ${
                isSelected
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {qr.label}
            </button>
          );
        })}
      </div>

      {/* Clear price filter */}
      {isActive && (
        <button
          onClick={() => onChange(null, null)}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Clear price filter
        </button>
      )}
    </div>
  );
}

// ─── Deals & Discounts Section ──────────────────────────────────────────────

function DealsSection({
  collections,
  activeCollection,
  onSelect,
}: {
  collections: FilterCollection[];
  activeCollection: string;
  onSelect: (key: string) => void;
}) {
  const locale = useLocale();

  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-2">Deals & Discounts</h3>
      <div className="space-y-1">
        {collections.map((col) => {
          const label = locale === 'bn' ? col.labelBn : col.labelEn;
          const isActive = activeCollection === col.key;
          return (
            <button
              key={col.key}
              onClick={() => onSelect(isActive ? '' : col.key)}
              className={`block text-sm transition-colors ${
                isActive
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Sidebar Component ─────────────────────────────────────────────────

export default function ProductFilterSidebar({ filters, active, onChange }: Props) {
  if (!filters) return null;

  return (
    <nav className="space-y-5 divide-y divide-border">
      {/* Department */}
      {filters.categories.length > 0 && (
        <DepartmentSection
          categories={filters.categories}
          activeCategory={active.category}
          onSelect={(id) => onChange({ category: id })}
        />
      )}

      {/* Customer Review */}
      {filters.ratingBuckets.length > 0 && (
        <div className="pt-5">
          <RatingSection
            buckets={filters.ratingBuckets}
            activeRating={active.rating}
            onSelect={(r) => onChange({ rating: r })}
          />
        </div>
      )}

      {/* Brands */}
      {filters.brands.length > 0 && (
        <div className="pt-5">
          <BrandsSection
            brands={filters.brands}
            selectedBrands={active.brands}
            onToggle={(brandId) => {
              const next = active.brands.includes(brandId)
                ? active.brands.filter((b) => b !== brandId)
                : [...active.brands, brandId];
              onChange({ brands: next });
            }}
          />
        </div>
      )}

      {/* Price */}
      <div className="pt-5">
        <PriceSection
          range={filters.priceRange}
          activeMin={active.minPrice}
          activeMax={active.maxPrice}
          onChange={(min, max) => onChange({ minPrice: min, maxPrice: max })}
        />
      </div>

      {/* Deals & Discounts */}
      {filters.collections.length > 0 && (
        <div className="pt-5">
          <DealsSection
            collections={filters.collections}
            activeCollection={active.collection}
            onSelect={(key) => onChange({ collection: key })}
          />
        </div>
      )}
    </nav>
  );
}
