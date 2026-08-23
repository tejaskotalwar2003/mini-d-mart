import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../api/client';
import type { Category, Product, ProductListResponse } from '../../types';
import HeroSlider from '../../components/HeroSlider';
import CategorySlider, { categoryImageMeta } from '../../components/CategorySlider';
import CategorySection from '../../components/CategorySection';
import ProductCard from '../../components/ProductCard';
import {
  Filter,
  ArrowUpDown,
  RotateCcw,
  AlertTriangle,
  X,
  Sparkles,
  ArrowLeft,
  Tag,
  SearchX,
  Check,
} from 'lucide-react';

export const ProductList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract query filter params from URL
  const querySearch = searchParams.get('search') || '';
  const queryCategory = searchParams.get('category') || '';
  const queryMinPrice = searchParams.get('min_price') || '';
  const queryMaxPrice = searchParams.get('max_price') || '';
  const querySortBy = searchParams.get('sort_by') || 'newest';
  const queryInStock = searchParams.get('in_stock') === 'true';

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredTotal, setFilteredTotal] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Local filter inputs (synced with URL)
  const [localSearch, setLocalSearch] = useState<string>(querySearch);
  const [localMinPrice, setLocalMinPrice] = useState<string>(queryMinPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState<string>(queryMaxPrice);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  // Synchronize local input state when URL query params change
  useEffect(() => {
    setLocalSearch(querySearch);
    setLocalMinPrice(queryMinPrice);
    setLocalMaxPrice(queryMaxPrice);
  }, [querySearch, queryMinPrice, queryMaxPrice]);

  // Debounced search sync to URL (~350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== querySearch) {
        updateFilterParam('search', localSearch);
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [localSearch, querySearch]);

  // Fetch Categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiClient.get<Category[]>('/api/v1/categories');
        setCategories(res.data);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Helper to update a single search param in URL
  const updateFilterParam = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value.trim()) {
      newParams.set(key, value.trim());
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Helper to clear all filters & search (returns directly to clean home page)
  const handleClearFilters = () => {
    setLocalSearch('');
    setLocalMinPrice('');
    setLocalMaxPrice('');
    setSearchParams(new URLSearchParams(), { replace: true });
    setMobileFilterOpen(false);
  };

  // Check whether user is in search or filtered mode
  const isFilteringActive =
    Boolean(querySearch.trim()) ||
    Boolean(queryCategory) ||
    Boolean(queryMinPrice) ||
    Boolean(queryMaxPrice) ||
    querySortBy !== 'newest' ||
    queryInStock;

  // 1. Fetch Overview Products for Home Page (all categories, 4 per category displayed)
  const fetchOverviewProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ProductListResponse>('/api/v1/products', {
        params: { page: 1, page_size: 100, sort_by: 'newest' },
      });
      setAllProducts(res.data.items);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Fetch Filtered Products when Search / Category / Price Range is applied
  const fetchFilteredProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page: 1,
        page_size: 60,
        sort_by: querySortBy,
      };

      if (querySearch.trim()) params.search = querySearch.trim();
      if (queryCategory) params.category_id = queryCategory;
      if (queryMinPrice && !isNaN(Number(queryMinPrice))) params.min_price = Number(queryMinPrice);
      if (queryMaxPrice && !isNaN(Number(queryMaxPrice))) params.max_price = Number(queryMaxPrice);

      const res = await apiClient.get<ProductListResponse>('/api/v1/products', { params });
      let items = res.data.items;
      if (queryInStock) {
        items = items.filter((p) => p.quantity_available > 0);
      }
      setFilteredProducts(items);
      setFilteredTotal(queryInStock ? items.length : res.data.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isFilteringActive) {
      fetchFilteredProducts();
    } else {
      fetchOverviewProducts();
    }
  }, [querySearch, queryCategory, queryMinPrice, queryMaxPrice, querySortBy, queryInStock, isFilteringActive]);

  // Group products by category for default Home view
  const groupedByCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    allProducts.forEach((prod) => {
      if (!map[prod.category_id]) {
        map[prod.category_id] = [];
      }
      map[prod.category_id].push(prod);
    });
    return map;
  }, [allProducts]);

  const activeCategoryObj = categories.find((c) => c.id === queryCategory);

  const handleSelectCategory = (categoryId: string) => {
    updateFilterParam('category', categoryId || null);
    setTimeout(() => {
      document.getElementById('catalog-content-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSelectCategorySlug = (slug: string) => {
    const matched = categories.find((c) => c.slug === slug);
    if (matched) {
      handleSelectCategory(matched.id);
    }
  };

  // Quick budget filter tags
  const handleQuickBudgetFilter = (maxPrice: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('min_price');
    if (queryMaxPrice === maxPrice) {
      newParams.delete('max_price');
    } else {
      newParams.set('max_price', maxPrice);
    }
    setSearchParams(newParams, { replace: true });
  };

  const activeFilterCount =
    (querySearch ? 1 : 0) +
    (queryCategory ? 1 : 0) +
    (queryMinPrice || queryMaxPrice ? 1 : 0) +
    (querySortBy !== 'newest' ? 1 : 0) +
    (queryInStock ? 1 : 0);

  const popularSearches = ['Milk', 'Butter', 'Bread', 'Paneer', 'Apple', 'Chips', 'Tea', 'Kaju Katli'];

  // Left Filter Sidebar Component (Shared between Desktop and Mobile Drawer)
  const FilterSidebarContent = (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h2 className="text-sm sm:text-base font-black text-gray-900 flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-600" />
          Filter &amp; Explore
        </h2>
        {isFilteringActive && (
          <button
            onClick={handleClearFilters}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Clear All
          </button>
        )}
      </div>

      {/* 1. Category Directory Selector */}
      <div>
        <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Categories</span>
          <span className="text-[10px] font-bold text-gray-400">({categories.length})</span>
        </label>
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1 scrollbar-none">
          {/* All Categories Option */}
          <button
            onClick={() => handleSelectCategory('')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
              !queryCategory
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>🛒</span>
              <span>All Categories</span>
            </div>
            {!queryCategory && <Check className="w-3.5 h-3.5 text-amber-300" />}
          </button>

          {/* Each Category */}
          {categories.map((cat) => {
            const isSelected = queryCategory === cat.id;
            const meta = categoryImageMeta[cat.slug] || { emoji: '📦' };
            const catCount = groupedByCategory[cat.id]?.length || 0;

            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(isSelected ? '' : cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-1">
                  <span>{meta.emoji}</span>
                  <span className="truncate">{cat.name}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {catCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                        isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {catCount}
                    </span>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-amber-300 ml-0.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Price Range Filter */}
      <div className="pt-2 border-t border-gray-100">
        <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-2">
          Price Range (₹)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-gray-400 font-semibold block mb-0.5">Min (₹)</span>
            <input
              type="number"
              min="0"
              value={localMinPrice}
              onChange={(e) => {
                setLocalMinPrice(e.target.value);
                updateFilterParam('min_price', e.target.value);
              }}
              placeholder="0"
              className="w-full py-2 px-3 border border-gray-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-semibold block mb-0.5">Max (₹)</span>
            <input
              type="number"
              min="0"
              value={localMaxPrice}
              onChange={(e) => {
                setLocalMaxPrice(e.target.value);
                updateFilterParam('max_price', e.target.value);
              }}
              placeholder="500+"
              className="w-full py-2 px-3 border border-gray-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
        </div>

        {/* Quick Budget Chips */}
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {['50', '100', '250'].map((price) => (
            <button
              key={price}
              onClick={() => handleQuickBudgetFilter(price)}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-black border transition-all text-center ${
                queryMaxPrice === price
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              ≤ ₹{price}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Availability Toggle */}
      <div className="pt-2 border-t border-gray-100">
        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-gray-700 select-none py-1 hover:text-emerald-700 transition-colors">
          <input
            type="checkbox"
            checked={queryInStock}
            onChange={(e) => updateFilterParam('in_stock', e.target.checked ? 'true' : null)}
            className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500 border-gray-300 cursor-pointer"
          />
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Show In-Stock Only</span>
          </div>
        </label>
      </div>

      {/* 4. Sort Options */}
      <div className="pt-2 border-t border-gray-100">
        <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider mb-1.5">
          Sort Products
        </label>
        <select
          value={querySortBy}
          onChange={(e) => updateFilterParam('sort_by', e.target.value)}
          className="w-full py-2 px-3 border border-gray-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500 text-gray-800"
        >
          <option value="newest">Newest Arrivals</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="name">Name: A to Z</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6">
      {/* ========================================================================= */}
      {/* TOP ROW: FESTIVE TICKER & QUICK COMMERCE PROMO */}
      {/* ========================================================================= */}
      {!querySearch && (
        <div className="bg-gradient-to-r from-rose-900 via-amber-700 to-rose-900 text-amber-100 rounded-2xl p-2.5 sm:p-3 shadow-md border border-amber-500/40 flex items-center justify-between gap-2 overflow-hidden relative animate-shimmer">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-black z-10 truncate">
            <span className="text-base sm:text-lg animate-bounce">🪢</span>
            <span className="bg-amber-400 text-rose-950 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-xs">
              Mega Savings Fest
            </span>
            <span className="hidden md:inline text-white">Celebrate with instant grocery delivery!</span>
            <span className="text-amber-200 font-semibold truncate">
              Designer Rakhis, Kaju Katli & Cadbury Gift Packs delivered in 10 mins 🎁
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-black text-amber-300 bg-black/30 px-3 py-1 rounded-xl whitespace-nowrap z-10 border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Use Code: <span className="text-white underline">RAKHI50</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN LAYOUT: (Left: Sticky Sidebar Filters | Right: Catalog/Search) */}
      {/* ========================================================================= */}
      <div id="catalog-content-section" className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* 🌟 LEFT SIDEBAR FILTERS (Always Visible on Desktop / Tablet) */}
        <aside className="hidden lg:block bg-white p-5 rounded-3xl border border-gray-200/90 shadow-sm sticky top-20">
          {FilterSidebarContent}
        </aside>

        {/* 🛍️ RIGHT MAIN CONTENT COLUMN */}
        <main className="lg:col-span-3 space-y-4 sm:space-y-6">
          {/* Quick Filters Pill Bar (Mobile & Desktop) */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-2.5 sm:p-3 shadow-xs flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider flex items-center gap-1 flex-shrink-0 pl-1">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              Quick:
            </span>

            <button
              onClick={() => handleQuickBudgetFilter('50')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 ${
                queryMaxPrice === '50'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              ⚡ ≤ ₹50
            </button>

            <button
              onClick={() => handleQuickBudgetFilter('100')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 ${
                queryMaxPrice === '100'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              🔥 ≤ ₹100
            </button>

            <button
              onClick={() => handleQuickBudgetFilter('250')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 ${
                queryMaxPrice === '250'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              ✨ ≤ ₹250
            </button>

            <button
              onClick={() => updateFilterParam('in_stock', queryInStock ? null : 'true')}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${
                queryInStock
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${queryInStock ? 'bg-amber-300' : 'bg-emerald-500'}`} />
              In Stock
            </button>

            {/* Mobile Filter Sheet Trigger Button */}
            <button
              onClick={() => setMobileFilterOpen(true)}
              className={`lg:hidden text-xs font-bold px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap flex-shrink-0 ml-auto flex items-center gap-1.5 ${
                activeFilterCount > 0
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
            </button>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* VIEW MODE A: SEARCH RESULTS / ACTIVE CATEGORY FILTER VIEW     */}
          {/* ------------------------------------------------------------- */}
          {isFilteringActive ? (
            <div className="space-y-4 sm:space-y-6 animate-fade-in">
              {/* Header Bar */}
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1 text-xs font-extrabold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl transition-colors shadow-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Home</span>
                  </button>

                  <div className="text-xs sm:text-sm font-bold text-gray-700">
                    {querySearch ? (
                      <>
                        <span>Results for</span>{' '}
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-black">
                          "{querySearch}"
                        </span>
                      </>
                    ) : activeCategoryObj ? (
                      <span>{activeCategoryObj.name}</span>
                    ) : (
                      <span>Filtered Catalog</span>
                    )}
                    :{' '}
                    <span className="text-emerald-700 font-extrabold">{filteredProducts.length}</span> of{' '}
                    <span className="text-gray-900 font-extrabold">{filteredTotal}</span> products
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Sort:
                  </span>
                  <select
                    value={querySortBy}
                    onChange={(e) => updateFilterParam('sort_by', e.target.value)}
                    className="py-1.5 px-3 border border-gray-300 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="newest">Newest Arrivals</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="name">Name: A to Z</option>
                  </select>
                </div>
              </div>

              {/* Grid or States */}
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-2xl p-3 sm:p-4 border border-gray-200 shadow-sm animate-pulse space-y-3"
                    >
                      <div className="bg-gray-200 h-32 sm:h-44 rounded-xl w-full" />
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                      <div className="h-8 bg-gray-200 rounded-xl w-full mt-2" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-3xl p-6 sm:p-8 text-center space-y-4">
                  <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">{error}</h3>
                  <button
                    onClick={fetchFilteredProducts}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                  >
                    Retry Search
                  </button>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-3xl p-8 sm:p-12 text-center space-y-4 shadow-sm">
                  <SearchX className="w-16 h-16 text-gray-300 mx-auto" />
                  <h2 className="text-lg sm:text-xl font-black text-gray-900">
                    No products found matching "{querySearch || 'selected filters'}"
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                    Try checking for spelling errors, clearing your price filters, or trying popular searches below.
                  </p>

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
                    {popularSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => updateFilterParam('search', term)}
                        className="text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleClearFilters}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Clear Filters &amp; Return Home
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5 animate-fade-in">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ------------------------------------------------------------- */
            /* VIEW MODE B: HOMEPAGE (Hero Slider + Category Sections)      */
            /* ------------------------------------------------------------- */
            <div className="space-y-4 sm:space-y-6">
              {/* 🌟 Interactive Hero Banner Slider with Images */}
              <HeroSlider onSelectCategorySlug={handleSelectCategorySlug} />

              {/* 📦 Interactive Horizontal Category Slider */}
              <CategorySlider
                categories={categories}
                selectedCategoryId={queryCategory}
                onSelectCategory={handleSelectCategory}
              />

              {/* Categorized Product Sections (4 products per category with Show More) */}
              <div className="space-y-6 sm:space-y-8">
                {isLoading ? (
                  <div className="space-y-6">
                    {Array.from({ length: 3 }).map((_, sectionIdx) => (
                      <div
                        key={sectionIdx}
                        className="bg-white rounded-3xl border border-gray-200 p-4 sm:p-6 space-y-4 animate-pulse"
                      >
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-2xl" />
                            <div className="space-y-1.5">
                              <div className="w-36 h-4 bg-gray-200 rounded" />
                              <div className="w-24 h-3 bg-gray-200 rounded" />
                            </div>
                          </div>
                          <div className="w-28 h-7 bg-gray-200 rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                              <div className="bg-gray-200 h-32 sm:h-44 rounded-xl w-full" />
                              <div className="h-3 bg-gray-200 rounded w-3/4" />
                              <div className="h-3 bg-gray-200 rounded w-1/2" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="bg-red-50 border border-red-200 rounded-3xl p-6 sm:p-8 text-center space-y-4">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">{error}</h3>
                    <button
                      onClick={fetchOverviewProducts}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                    >
                      Retry Request
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 sm:space-y-8 animate-fade-in">
                    {categories.map((category) => {
                      const categoryProducts = groupedByCategory[category.id] || [];
                      if (categoryProducts.length === 0) return null;

                      return (
                        <CategorySection
                          key={category.id}
                          category={category}
                          products={categoryProducts}
                          onSelectCategory={handleSelectCategory}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filter Drawer / Bottom Sheet */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-600" />
                Filter &amp; Explore
              </h3>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {FilterSidebarContent}

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleClearFilters}
                className="flex-1 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl"
              >
                Reset All
              </button>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
