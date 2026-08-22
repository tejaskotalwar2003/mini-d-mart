import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
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
} from 'lucide-react';

// Per-card selected variant state keyed by base product id
type SelectedVariants = Record<string, ProductVariantInfo>;


export const ProductList: React.FC = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Tracks the selected variant (unit/size) per product card
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariants>({});

  // Filter states
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  // Debounce search input (~400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search change
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

  // Fetch Products whenever filters/pagination change
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
      alert(err);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  const categoryIcons: Record<string, string> = {
    'fruits-vegetables': '🍎',
    'dairy-bakery': '🥛',
    'snacks-beverages': '🧃',
    'instant-frozen-food': '🍜',
    'munchies-chips': '🍟',
    'personal-care': '🧴',
    'household-essentials': '🧼',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Promotional Offer Banners Grid (Blinkit style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Banner 1 */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between h-36">
          <div className="relative z-10">
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              10-Min Delivery
            </span>
            <h2 className="text-lg font-black mt-1 leading-snug">Superfast Grocery Delivery</h2>
            <p className="text-emerald-100 text-xs mt-0.5">Fresh produce & daily essentials at wholesale rates</p>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-yellow-300">⚡ Zero Delivery Fee on ₹199+</span>
          </div>
          <ShoppingBag className="absolute right-2 -bottom-2 w-28 h-28 text-white/10 pointer-events-none" />
        </div>

        {/* Banner 2 */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between h-36">
          <div className="relative z-10">
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Festive Deals
            </span>
            <h2 className="text-lg font-black mt-1 leading-snug">Up to 40% OFF Munchies</h2>
            <p className="text-amber-100 text-xs mt-0.5">Chips, cold drinks, biscuits & confectionery</p>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-yellow-100">🎉 Grab Big Pack Combos</span>
          </div>
          <Package className="absolute right-2 -bottom-2 w-28 h-28 text-white/10 pointer-events-none" />
        </div>

        {/* Banner 3 */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-700 rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col justify-between h-36">
          <div className="relative z-10">
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Fresh Farm Harvest
            </span>
            <h2 className="text-lg font-black mt-1 leading-snug">Organic Fruits & Veggies</h2>
            <p className="text-cyan-100 text-xs mt-0.5">Handpicked farm produce washed & packed safely</p>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-200">🌿 100% Quality Guaranteed</span>
          </div>
          <ShoppingBag className="absolute right-2 -bottom-2 w-28 h-28 text-white/10 pointer-events-none" />
        </div>
      </div>

      {/* Blinkit Top Category Quick Navigation Strip */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
            <span>Explore Categories</span>
            <span className="text-xs text-gray-400 font-medium lowercase">({categories.length} departments)</span>
          </h2>
          {selectedCategory && (
            <button
              onClick={() => {
                setSelectedCategory('');
                setPage(1);
              }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
            >
              Show All
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => {
              setSelectedCategory('');
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === ''
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>🛍️</span>
            <span>All Products</span>
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const icon = categoryIcons[cat.slug] || '📦';
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300'
                }`}
              >
                <span>{icon}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters (Desktop & Mobile Dropdown) */}
        <div className="space-y-6 bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Filter className="w-5 h-5 text-emerald-600" />
              Filters
            </h2>
            {(search || selectedCategory || minPrice || maxPrice || sortBy !== 'newest') && (
              <button
                onClick={handleClearFilters}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>

          {/* Search Input */}
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

          {/* Category Filter */}
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
                className="w-full py-1.5 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                className="w-full py-1.5 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Product Grid & Controls Column */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top Control Bar: Total Count & Sort Dropdown */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600 font-medium">
              Showing <span className="font-bold text-gray-900">{products.length}</span> of{' '}
              <span className="font-bold text-gray-900">{total}</span> products
            </p>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                Sort By:
              </span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="py-1.5 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors w-full sm:w-auto"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm animate-pulse space-y-3"
                >
                  <div className="bg-gray-200 h-40 rounded-lg w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded w-full mt-4"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            // Error State
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
              <h3 className="text-lg font-bold text-gray-900">{error}</h3>
              <button
                onClick={fetchProducts}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                Retry Request
              </button>
            </div>
          ) : products.length === 0 ? (
            // Empty State
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center space-y-4">
              <Package className="w-16 h-16 text-gray-300 mx-auto" />
              <h3 className="text-xl font-bold text-gray-800">No Products Found</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">
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
            // Responsive Product Grid
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => {
                // Determine active variant for this card
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
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                  >
                    <Link to={`/products/${activeVariant.id}`} className="block relative p-4">
                      {/* Stock Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        {isOutOfStock ? (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Low Stock ({activeVariant.quantity_available})
                          </span>
                        ) : (
                          <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            In Stock
                          </span>
                        )}
                      </div>

                      {/* Product Image */}
                      <div className="w-full h-44 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden mb-3 group-hover:scale-105 transition-transform duration-300">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-contain p-2"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package className="w-16 h-16 text-gray-300" />
                        )}
                      </div>

                      {/* Category Badge */}
                      <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                        {product.category_name}
                      </span>

                      {/* Product Name */}
                      <h3 className="font-bold text-gray-900 text-sm line-clamp-2 mt-1 min-h-[2.5rem] group-hover:text-emerald-600 transition-colors">
                        {product.name}
                      </h3>

                      {/* Price & Unit */}
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-lg font-extrabold text-gray-900">
                          ₹{Number(activeVariant.price).toFixed(0)}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">/ {activeVariant.unit}</span>
                      </div>
                    </Link>

                    {/* Variant Chips (Blinkit-style) */}
                    {hasVariants && (
                      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                        {product.variants!.map((variant) => {
                          const isActive = activeVariant.id === variant.id;
                          return (
                            <button
                              key={variant.id}
                              onClick={() =>
                                setSelectedVariants((prev) => ({ ...prev, [product.id]: variant }))
                              }
                              title={`₹${Number(variant.price).toFixed(0)} / ${variant.unit}`}
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
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
                    <div className="p-4 pt-2">
                      <button
                        onClick={(e) => {
                          const variantProduct = { ...product, id: activeVariant.id, price: activeVariant.price, unit: activeVariant.unit, quantity_available: activeVariant.quantity_available };
                          handleAddToCart(variantProduct, e);
                        }}
                        disabled={isOutOfStock}
                        className={`w-full py-2.5 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                          isOutOfStock
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        {isOutOfStock ? 'Unavailable' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Bar */}
          {!isLoading && !error && products.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-600">
                Page <span className="font-bold text-gray-900">{page}</span> of{' '}
                <span className="font-bold text-gray-900">{totalPages}</span>
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductList;
