import React, { useEffect, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Package,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';

type SelectedVariants = Record<string, ProductVariantInfo>;

export const ProductList: React.FC = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
  const pageSize = 12;

  // Debounce search (~400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
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

  // Fetch Products
  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
        sort_by: sortBy,
      };

      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedCategory) params.category_id = selectedCategory;
      if (minPrice && !isNaN(Number(minPrice))) params.min_price = Number(minPrice);
      if (maxPrice && !isNaN(Number(maxPrice))) params.max_price = Number(maxPrice);

      const res = await apiClient.get<ProductListResponse>('/api/v1/products', { params });
      setProducts(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [debouncedSearch, selectedCategory, minPrice, maxPrice, sortBy, page]);

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

  const totalPages = Math.ceil(total / pageSize) || 1;

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
  };

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Promotional Offer Banners (Swipeable Carousel on Mobile, Grid on Desktop) */}
      <div className="flex md:grid md:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-none snap-x snap-mandatory">
        {/* Banner 1 */}
        <div className="min-w-[85%] sm:min-w-[70%] md:min-w-0 snap-center bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between h-32 sm:h-36 flex-shrink-0">
          <div className="relative z-10">
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              10-Min Delivery
            </span>
            <h2 className="text-base sm:text-lg font-black mt-1 leading-snug">Superfast Grocery Delivery</h2>
            <p className="text-emerald-100 text-[11px] sm:text-xs mt-0.5">Fresh produce at wholesale rates</p>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-yellow-300">⚡ Free Delivery on ₹199+</span>
          </div>
          <ShoppingBag className="absolute right-2 -bottom-2 w-24 h-24 sm:w-28 sm:h-28 text-white/10 pointer-events-none" />
        </div>

        {/* Banner 2 */}
        <div className="min-w-[85%] sm:min-w-[70%] md:min-w-0 snap-center bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between h-32 sm:h-36 flex-shrink-0">
          <div className="relative z-10">
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Festive Deals
            </span>
            <h2 className="text-base sm:text-lg font-black mt-1 leading-snug">Up to 40% OFF Munchies</h2>
            <p className="text-amber-100 text-[11px] sm:text-xs mt-0.5">Chips, drinks & confectionery</p>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-yellow-100">🎉 Grab Big Pack Combos</span>
          </div>
          <Package className="absolute right-2 -bottom-2 w-24 h-24 sm:w-28 sm:h-28 text-white/10 pointer-events-none" />
        </div>

        {/* Banner 3 */}
        <div className="min-w-[85%] sm:min-w-[70%] md:min-w-0 snap-center bg-gradient-to-r from-cyan-600 to-blue-700 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between h-32 sm:h-36 flex-shrink-0">
          <div className="relative z-10">
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Fresh Farm Harvest
            </span>
            <h2 className="text-base sm:text-lg font-black mt-1 leading-snug">Organic Fruits & Veggies</h2>
            <p className="text-cyan-100 text-[11px] sm:text-xs mt-0.5">Handpicked farm produce</p>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-200">🌿 100% Quality Guaranteed</span>
          </div>
          <ShoppingBag className="absolute right-2 -bottom-2 w-24 h-24 sm:w-28 sm:h-28 text-white/10 pointer-events-none" />
        </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 items-start">
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
                onClick={fetchProducts}
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
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                  >
                    <Link to={`/products/${activeVariant.id}`} className="block relative p-2.5 sm:p-4">
                      {/* Stock Badge */}
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10">
                        {isOutOfStock ? (
                          <span className="bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="bg-amber-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Low ({activeVariant.quantity_available})
                          </span>
                        ) : (
                          <span className="bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wider">
                            In Stock
                          </span>
                        )}
                      </div>

                      {/* Product Image */}
                      <div className="w-full h-28 sm:h-44 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden mb-2 sm:mb-3 group-hover:scale-105 transition-transform duration-300">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-contain p-1.5 sm:p-2"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package className="w-10 h-10 sm:w-16 sm:h-16 text-gray-300" />
                        )}
                      </div>

                      {/* Category Badge */}
                      <span className="text-[10px] sm:text-[11px] font-bold text-emerald-600 uppercase tracking-wider line-clamp-1">
                        {product.category_name}
                      </span>

                      {/* Product Name */}
                      <h3 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2 mt-0.5 min-h-[2rem] sm:min-h-[2.5rem] group-hover:text-emerald-600 transition-colors">
                        {product.name}
                      </h3>

                      {/* Price & Unit */}
                      <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
                        <span className="text-base sm:text-lg font-extrabold text-gray-900">
                          ₹{Number(activeVariant.price).toFixed(0)}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-400 font-medium truncate">
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
                              className={`text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded border transition-all ${
                                isActive
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
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
                        className={`w-full py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all shadow-sm ${
                          isOutOfStock
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>{isOutOfStock ? 'Sold Out' : 'ADD'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 sm:pt-6">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-2 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <span className="text-xs sm:text-sm font-bold text-gray-700 px-3">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-2 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                aria-label="Next Page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
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
    </div>
  );
};

export default ProductList;
