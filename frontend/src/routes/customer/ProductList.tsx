import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import type { Category, Product, ProductListResponse, ProductVariantInfo } from '../../types';
import {
  Search,
  Filter,
  ArrowUpDown,
  ShoppingBag,
  RotateCcw,
  AlertTriangle,
  Package,
  Plus,
  SlidersHorizontal,
  X,
  ShoppingCart,
  ArrowRight,
  Gift,
  Sparkles,
  Loader2,
} from 'lucide-react';

type SelectedVariants = Record<string, ProductVariantInfo>;

export const ProductList: React.FC = () => {
  const { user } = useAuth();
  const { addToCart, cart, itemCount } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariants>({});

  // Mobile Filter Sheet open state
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  // Filter states
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [page, setPage] = useState<number>(1);
  const pageSize = 16;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Debounce search (~400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

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

  // Fetch Products (Initial & Infinite Append)
  const fetchProducts = async (pageNum: number, isInitial: boolean = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);
    try {
      const params: Record<string, any> = {
        page: pageNum,
        page_size: pageSize,
        sort_by: sortBy,
      };

      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedCategory) params.category_id = selectedCategory;
      if (minPrice && !isNaN(Number(minPrice))) params.min_price = Number(minPrice);
      if (maxPrice && !isNaN(Number(maxPrice))) params.max_price = Number(maxPrice);

      const res = await apiClient.get<ProductListResponse>('/api/v1/products', { params });
      if (pageNum === 1) {
        setProducts(res.data.items);
      } else {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newItems = res.data.items.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
      }
      setTotal(res.data.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch products. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Reset & load page 1 on filter changes
  useEffect(() => {
    setPage(1);
    fetchProducts(1, true);
  }, [debouncedSearch, selectedCategory, minPrice, maxPrice, sortBy]);

  // Load next page when page increments (> 1)
  useEffect(() => {
    if (page > 1) {
      fetchProducts(page, false);
    }
  }, [page]);

  // Infinite Scroll Intersection Observer (Blinkit style)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore && products.length < total) {
          setPage((prevPage) => prevPage + 1);
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [isLoading, isLoadingMore, products.length, total]);

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedCategory('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    setPage(1);
    setMobileFilterOpen(false);
  };

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    const err = await addToCart(product.id, 1);
    if (err) {
      showToast(err, { type: 'error' });
    } else {
      showToast(product.name, {
        type: 'success',
        subMessage: `₹${Number(product.price).toFixed(0)} · ${product.unit}`,
        imageUrl: product.image_url || undefined,
      });
    }
  };

  const categoryImageMeta: Record<string, { img: string; gradient: string; emoji: string }> = {
    'fruits-vegetables': {
      img: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=300&q=80',
      gradient: 'from-green-50 to-emerald-100',
      emoji: '🍎',
    },
    'dairy-bakery': {
      img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=300&q=80',
      gradient: 'from-yellow-50 to-amber-100',
      emoji: '🥛',
    },
    'snacks-beverages': {
      img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80',
      gradient: 'from-orange-50 to-red-100',
      emoji: '🧃',
    },
    'instant-frozen-food': {
      img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=300&q=80',
      gradient: 'from-blue-50 to-indigo-100',
      emoji: '🍜',
    },
    'munchies-chips': {
      img: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=300&q=80',
      gradient: 'from-amber-50 to-orange-100',
      emoji: '🍟',
    },
    'personal-care': {
      img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=300&q=80',
      gradient: 'from-pink-50 to-rose-100',
      emoji: '🧴',
    },
    'household-essentials': {
      img: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=300&q=80',
      gradient: 'from-cyan-50 to-sky-100',
      emoji: '🧼',
    },
    'raksha-bandhan': {
      img: 'https://images.unsplash.com/photo-1513201099705-a9746072f579?auto=format&fit=crop&w=300&q=80',
      gradient: 'from-rose-50 to-amber-100',
      emoji: '🪢',
    },
  };

  // Helper: get the Raksha Bandhan category ID from the fetched categories list
  const rakhiCategory = categories.find((c) => c.slug === 'raksha-bandhan');
  const handleBannerClick = () => {
    if (rakhiCategory) {
      setSelectedCategory(rakhiCategory.id);
      setPage(1);
      // Scroll to product grid
      setTimeout(() => {
        document.getElementById('product-grid-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 space-y-4 sm:space-y-6">
      {/* 🪢 Raksha Bandhan Festive Top Announcement Ticker */}
      <div className="bg-gradient-to-r from-rose-900 via-amber-700 to-rose-900 text-amber-100 rounded-2xl p-2.5 sm:p-3 shadow-md border border-amber-500/40 flex items-center justify-between gap-2 overflow-hidden relative animate-shimmer">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-black z-10 truncate">
          <span className="text-base sm:text-lg animate-bounce">🪢</span>
          <span className="bg-amber-400 text-rose-950 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-xs">
            Rakhi Dhamaka
          </span>
          <span className="hidden md:inline text-white">Celebrate the bond of love!</span>
          <span className="text-amber-200 font-semibold truncate">
            Designer Rakhis, Kaju Katli & Cadbury Gift Packs delivered in 10 mins 🎁
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px] font-black text-amber-300 bg-black/30 px-3 py-1 rounded-xl whitespace-nowrap z-10 border border-amber-400/30">
          <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Use Code: <span className="text-white underline">RAKHI50</span>
        </div>
      </div>

      {/* Promotional Festive Banners (Raksha Bandhan Theme, Swipeable on Mobile) */}
      <div className="flex md:grid md:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-none snap-x snap-mandatory">
        {/* Banner 1: Rakhi Special */}
        <button
          onClick={handleBannerClick}
          className="min-w-[85%] sm:min-w-[70%] md:min-w-0 snap-center bg-gradient-to-r from-rose-700 via-pink-700 to-amber-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between h-36 sm:h-40 flex-shrink-0 border border-rose-400/30 cursor-pointer hover:opacity-95 active:scale-[0.98] transition-all text-left focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                🪢 Rakhi Special
              </span>
              <span className="bg-amber-400 text-rose-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Flat 30% OFF
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black mt-1.5 leading-snug drop-shadow-sm">
              Designer Rakhis &amp; Thalis
            </h2>
            <p className="text-rose-100 text-[11px] sm:text-xs mt-0.5">
              Silver, thread, zardosi &amp; cartoon sets with Roli-Chawal
            </p>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-black text-amber-300">⚡ Starting from ₹29 · 10m Delivery</span>
            <span className="flex items-center gap-1 text-[11px] font-black bg-white/20 px-2.5 py-1 rounded-full">
              Shop Now <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <Gift className="absolute right-2 -bottom-2 w-28 h-28 text-white/10 pointer-events-none" />
        </button>

        {/* Banner 2: Festive Sweets & Mithai */}
        <button
          onClick={handleBannerClick}
          className="min-w-[85%] sm:min-w-[70%] md:min-w-0 snap-center bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between h-36 sm:h-40 flex-shrink-0 border border-amber-400/30 cursor-pointer hover:opacity-95 active:scale-[0.98] transition-all text-left focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                🍬 Festive Mithai
              </span>
              <span className="bg-white text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Up to 40% OFF
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black mt-1.5 leading-snug drop-shadow-sm">
              Fresh Kaju Katli &amp; Ladoos
            </h2>
            <p className="text-amber-100 text-[11px] sm:text-xs mt-0.5">
              Haldiram's, Bikaji &amp; freshly packed pure ghee sweets
            </p>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-black text-yellow-100">🎉 Pure Ghee Assortments</span>
            <span className="flex items-center gap-1 text-[11px] font-black bg-white/20 px-2.5 py-1 rounded-full">
              Shop Now <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <Package className="absolute right-2 -bottom-2 w-28 h-28 text-white/10 pointer-events-none" />
        </button>

        {/* Banner 3: Cadbury Celebrations & Hampers */}
        <button
          onClick={handleBannerClick}
          className="min-w-[85%] sm:min-w-[70%] md:min-w-0 snap-center bg-gradient-to-r from-purple-800 via-indigo-800 to-rose-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between h-36 sm:h-40 flex-shrink-0 border border-purple-400/30 cursor-pointer hover:opacity-95 active:scale-[0.98] transition-all text-left focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                🍫 Gift Hampers
              </span>
              <span className="bg-amber-400 text-indigo-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Combo Deals
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-black mt-1.5 leading-snug drop-shadow-sm">
              Cadbury Celebrations Box
            </h2>
            <p className="text-purple-100 text-[11px] sm:text-xs mt-0.5">
              Ferrero Rocher, dry fruits &amp; premium chocolate gift packs
            </p>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-black text-emerald-300">🎁 Free Festive Gift Wrap</span>
            <span className="flex items-center gap-1 text-[11px] font-black bg-white/20 px-2.5 py-1 rounded-full">
              Shop Now <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          <ShoppingBag className="absolute right-2 -bottom-2 w-28 h-28 text-white/10 pointer-events-none" />
        </button>
      </div>

      {/* Category Grid (Compact & Clean Blinkit/BigBasket Style) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
            Shop by Category
          </h2>
          {selectedCategory && (
            <button
              onClick={() => { setSelectedCategory(''); setPage(1); }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
            >
              Show All
            </button>
          )}
        </div>

        {/* Responsive 4-col on mobile, 8-col on tablet/desktop for compact neat tiles */}
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3">
          {/* "All" card */}
          <button
            onClick={() => { setSelectedCategory(''); setPage(1); }}
            className="flex flex-col items-center gap-1.5 group focus:outline-none"
          >
            <div className={`w-full max-w-[84px] aspect-square rounded-xl sm:rounded-2xl overflow-hidden relative transition-all duration-200 bg-gradient-to-br from-emerald-50 to-teal-100 border-2 ${
              selectedCategory === '' ? 'border-emerald-500 shadow-sm ring-2 ring-emerald-400 ring-offset-1 scale-105' : 'border-gray-100 hover:border-emerald-300 hover:scale-105'
            }`}>
              <img
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80"
                alt="All Products"
                className="w-full h-full object-cover"
              />
              {selectedCategory === '' && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow">
                  <span className="text-white text-[8px] font-black">✓</span>
                </div>
              )}
            </div>
            <span className={`text-[11px] sm:text-xs font-bold text-center leading-tight truncate max-w-[80px] ${
              selectedCategory === '' ? 'text-emerald-700' : 'text-gray-700'
            }`}>All</span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const meta = categoryImageMeta[cat.slug] || {
              img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80',
              gradient: 'from-gray-50 to-gray-100',
              emoji: '📦',
            };
            return (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                className="flex flex-col items-center gap-1.5 group focus:outline-none"
              >
                <div className={`w-full max-w-[84px] aspect-square rounded-xl sm:rounded-2xl overflow-hidden relative transition-all duration-200 bg-gradient-to-br ${meta.gradient} border-2 ${
                  isSelected ? 'border-emerald-500 shadow-sm ring-2 ring-emerald-400 ring-offset-1 scale-105' : 'border-gray-100 hover:border-emerald-300 hover:scale-105'
                }`}>
                  <img
                    src={meta.img}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow">
                      <span className="text-white text-[8px] font-black">✓</span>
                    </div>
                  )}
                </div>
                <span className={`text-[11px] sm:text-xs font-bold text-center leading-tight line-clamp-2 max-w-[80px] ${
                  isSelected ? 'text-emerald-700' : 'text-gray-700'
                }`}>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Search & Filter Action Bar (< 1024px) */}
      <div className="lg:hidden flex items-center gap-2">
        <div className="relative flex-grow">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mangoes, milk, tea..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors shadow-sm"
          />
        </div>
        <button
          onClick={() => setMobileFilterOpen(true)}
          className={`relative p-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors ${
            activeFilterCount > 0
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
          title="Open Filters"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-1.5 right-1.5"></span>
          )}
        </button>
      </div>

      {/* Main Content Layout (Sidebar on Desktop + Product Grid) */}
      <div id="product-grid-section" className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 items-start">
        {/* Desktop Sidebar Filters (Hidden on Mobile) */}
        <div className="hidden lg:block space-y-6 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm sticky top-20">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-600" />
              Filters
            </h2>
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearFilters}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Search Products
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mangoes, milk, tea..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Price Range Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Price Range (₹)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
                placeholder="Min ₹"
                className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              />
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
                placeholder="Max ₹"
                className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Product Catalog Grid Column */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6">
          {/* Top Bar: Results Count & Sort Dropdown */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div className="text-xs sm:text-sm font-semibold text-gray-700">
              Showing <span className="text-emerald-700 font-extrabold">{products.length}</span> of{' '}
              <span className="text-gray-900 font-extrabold">{total}</span> products
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="py-1.5 px-3 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors w-full sm:w-auto font-medium"
              >
                <option value="newest">Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </div>
          </div>

          {/* Product Grid / States */}
          {isLoading ? (
            // Skeleton Loader Grid
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm animate-pulse space-y-2 sm:space-y-3"
                >
                  <div className="bg-gray-200 h-28 sm:h-40 rounded-lg w-full"></div>
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-7 sm:h-8 bg-gray-200 rounded w-full mt-2"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            // Error State
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
              <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto" />
              <h3 className="text-base sm:text-lg font-bold text-gray-900">{error}</h3>
              <button
                onClick={() => fetchProducts(1, true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm"
              >
                Retry Request
              </button>
            </div>
          ) : products.length === 0 ? (
            // Empty State
            <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-12 text-center space-y-4">
              <Package className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">No Products Found</h3>
              <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
                We couldn't find any products matching your filters. Try clearing your search or price range.
              </p>
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Clear Filters
              </button>
            </div>
          ) : (
            // 2-Column Mobile / 4-Column Desktop Product Grid
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {products.map((product) => {
                const activeVariant: ProductVariantInfo =
                  selectedVariants[product.id] ??
                  (product.variants && product.variants.length > 0
                    ? product.variants[0]
                    : { id: product.id, sku: product.sku, price: product.price, unit: product.unit, quantity_available: product.quantity_available });

                const isOutOfStock = activeVariant.quantity_available === 0;
                const isLowStock = activeVariant.quantity_available > 0 && activeVariant.quantity_available < 10;
                const hasVariants = product.variants && product.variants.length > 1;

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group card-hover-effect relative"
                  >
                    <Link to={`/products/${activeVariant.id}`} className="block relative p-2.5 sm:p-4">
                      {/* Top Badges: Stock Status & Delivery time */}
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 flex flex-col gap-1">
                        {isOutOfStock ? (
                          <span className="bg-red-500 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                            Sold Out
                          </span>
                        ) : isLowStock ? (
                          <span className="bg-amber-500 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                            Only {activeVariant.quantity_available} left
                          </span>
                        ) : (
                          <span className="bg-emerald-600/90 backdrop-blur text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            In Stock
                          </span>
                        )}
                      </div>

                      {/* Superfast 10-Min Tag */}
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
                        <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                          ⚡ 10m
                        </span>
                      </div>

                      {/* Product Image */}
                      <div className="w-full h-32 sm:h-44 bg-gradient-to-b from-gray-50/80 to-gray-100/50 rounded-xl flex items-center justify-center overflow-hidden mb-2 sm:mb-3 group-hover:scale-105 transition-transform duration-300">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-contain p-2 sm:p-3 drop-shadow-sm"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package className="w-10 h-10 sm:w-16 sm:h-16 text-gray-300" />
                        )}
                      </div>

                      {/* Category Badge */}
                      <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider line-clamp-1 bg-emerald-50 w-fit px-1.5 py-0.5 rounded-md">
                        {product.category_name}
                      </span>

                      {/* Product Name */}
                      <h3 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2 mt-1 min-h-[2rem] sm:min-h-[2.5rem] group-hover:text-emerald-700 transition-colors leading-snug">
                        {product.name}
                      </h3>

                      {/* Price & Unit */}
                      <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5">
                        <span className="text-base sm:text-xl font-black text-gray-900">
                          ₹{Number(activeVariant.price).toFixed(0)}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">
                          / {activeVariant.unit}
                        </span>
                      </div>
                    </Link>

                    {/* Variant Chips (Blinkit-style) */}
                    {hasVariants && (
                      <div className="px-2.5 sm:px-4 pb-2 flex flex-wrap gap-1">
                        {product.variants!.map((variant) => {
                          const isActive = activeVariant.id === variant.id;
                          return (
                            <button
                              key={variant.id}
                              onClick={() =>
                                setSelectedVariants((prev) => ({ ...prev, [product.id]: variant }))
                              }
                              title={`₹${Number(variant.price).toFixed(0)} / ${variant.unit}`}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                                isActive
                                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs scale-105'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-700'
                              }`}
                            >
                              {variant.unit}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Add to Cart Button */}
                    <div className="p-2.5 sm:p-4 pt-1 sm:pt-2">
                      <button
                        onClick={(e) => {
                          const variantProduct = {
                            ...product,
                            id: activeVariant.id,
                            price: activeVariant.price,
                            unit: activeVariant.unit,
                            quantity_available: activeVariant.quantity_available,
                          };
                          handleAddToCart(variantProduct, e);
                        }}
                        disabled={isOutOfStock}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all duration-200 shadow-sm hover:shadow-md ${
                          isOutOfStock
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 hover:scale-[1.02]'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isOutOfStock ? 'Sold Out' : 'ADD'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite Scroll Sentinel & Loading Indicators (Blinkit Style) */}
          <div ref={loadMoreRef} className="py-6 flex flex-col items-center justify-center">
            {isLoadingMore && (
              <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-gray-200 shadow-sm animate-pulse">
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                <span className="text-xs font-bold text-gray-700">
                  Loading more fresh products ({products.length} of {total})...
                </span>
              </div>
            )}

            {!isLoading && !isLoadingMore && products.length >= total && products.length > 0 && (
              <div className="text-center py-4 space-y-1">
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-2xl text-xs font-black shadow-xs">
                  <span>🎉</span>
                  <span>You've explored all {total} fresh products!</span>
                </div>
                <p className="text-[11px] text-gray-400 font-medium">Delivered to your door in 10 minutes ⚡</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Slide-Up Filter Drawer Modal */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-5 space-y-5 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-600" />
                Filter & Sort
              </h2>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Price Range (₹)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Min ₹"
                  className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Max ₹"
                  className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Sort Filter */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Sort Products
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="w-full py-2.5 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
              >
                <option value="newest">Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
              <button
                onClick={handleClearFilters}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reset All
              </button>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-md transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom View-Cart Bar (Mobile Only, Blinkit/Zepto Style) */}
      {itemCount > 0 && (
        <div className="sm:hidden fixed bottom-16 left-3 right-3 z-30 animate-in slide-in-from-bottom-4 duration-300">
          <Link
            to="/cart"
            className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between border border-emerald-400/40 ring-2 ring-emerald-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-black leading-tight uppercase tracking-wider text-white">
                  {itemCount} {itemCount === 1 ? 'ITEM' : 'ITEMS'}
                </p>
                <p className="text-[11px] text-emerald-200 font-bold">
                  ₹{cart ? Number(cart.subtotal).toFixed(0) : '0'} plus taxes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wide bg-amber-400 text-emerald-950 px-3.5 py-2 rounded-xl shadow-md">
              <span>View Cart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      )}
    </div>
  );
};

export default ProductList;
