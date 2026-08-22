import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import type { Product, ProductVariantInfo } from '../../types';
import {
  ArrowLeft,
  Package,
  Plus,
  Minus,
  ShoppingBag,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  useEffect(() => {
    const fetchProductDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<Product>(`/api/v1/products/${id}`);
        setProduct(res.data);
        if (res.data.variants && res.data.variants.length > 0) {
          setSelectedVariantId(res.data.variants[0].id);
        } else {
          setSelectedVariantId(res.data.id);
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Product not found.');
        } else {
          setError(err.response?.data?.detail || 'Failed to load product details.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchProductDetail();
    }
  }, [id]);

  const activeVariant: ProductVariantInfo | null = (() => {
    if (!product) return null;
    if (product.variants && product.variants.length > 0) {
      return product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
    }
    return {
      id: product.id,
      sku: product.sku,
      price: product.price,
      unit: product.unit,
      quantity_available: product.quantity_available,
    };
  })();

  const handleAddToCart = async () => {
    if (!product || !activeVariant) return;

    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    setIsAdding(true);
    const err = await addToCart(activeVariant.id, quantity);
    setIsAdding(false);
    if (err) {
      alert(err);
    } else {
      navigate('/cart');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium text-sm">Loading product details...</p>
      </div>
    );
  }

  if (error || !product || !activeVariant) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-red-50 p-4 rounded-full inline-block text-red-500">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{error || 'Product not found.'}</h2>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </Link>
      </div>
    );
  }

  const isOutOfStock = activeVariant.quantity_available === 0;
  const isLowStock = activeVariant.quantity_available > 0 && activeVariant.quantity_available < 10;
  const hasVariants = product.variants && product.variants.length > 1;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6 pb-24 sm:pb-8">
      {/* Back Link */}
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Products
      </Link>

      {/* Main Detail Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 items-start">
        {/* Left Column: Image Display */}
        <div className="bg-gray-50 rounded-2xl p-6 flex items-center justify-center h-64 sm:h-96 relative border border-gray-100 overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <Package className="w-20 h-20 sm:w-28 sm:h-28 text-gray-300" />
          )}

          {/* Return Policy Badge */}
          <div className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur px-3 py-2 rounded-xl border border-gray-200 text-[11px] sm:text-xs flex items-center gap-2 shadow-sm">
            {product.is_returnable ? (
              <>
                <RotateCcw className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-gray-700 font-medium">Eligible for 7-day return / exchange</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 font-medium">Non-returnable item</span>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Details & Actions */}
        <div className="space-y-4 sm:space-y-5">
          <div>
            {/* Category & Stock Badges */}
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                {product.category_name}
              </span>

              {isOutOfStock ? (
                <span className="bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Out of Stock
                </span>
              ) : isLowStock ? (
                <span className="bg-amber-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Low Stock ({activeVariant.quantity_available} left)
                </span>
              ) : (
                <span className="bg-emerald-600 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  In Stock ({activeVariant.quantity_available})
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
              {product.name}
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1">SKU: {activeVariant.sku}</p>
          </div>

          {/* Price Header */}
          <div className="border-y border-gray-100 py-3 sm:py-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-gray-900">
              ₹{Number(activeVariant.price).toFixed(2)}
            </span>
            <span className="text-xs sm:text-sm font-medium text-gray-500">per {activeVariant.unit}</span>
          </div>

          {/* Pack Size Variant Selector */}
          {hasVariants && (
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Pack Size Option
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.variants!.map((variant) => {
                  const isActive = activeVariant.id === variant.id;
                  return (
                    <button
                      key={variant.id}
                      onClick={() => {
                        setSelectedVariantId(variant.id);
                        setQuantity(1);
                      }}
                      className={`flex flex-col items-start px-3 py-2 rounded-xl border-2 text-left transition-all ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <span className={`text-xs sm:text-sm font-bold ${isActive ? 'text-emerald-700' : 'text-gray-800'}`}>
                        {variant.unit}
                      </span>
                      <span className={`text-[11px] sm:text-xs font-semibold ${isActive ? 'text-emerald-600' : 'text-gray-500'}`}>
                        ₹{Number(variant.price).toFixed(0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product Description */}
          {product.description && (
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Description
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                {product.description}
              </p>
            </div>
          )}

          {/* Desktop Quantity & Add to Cart Section */}
          <div className="hidden sm:block pt-4 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isOutOfStock}
                  className="p-2.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-4 h-4 text-gray-700" />
                </button>
                <span className="px-4 font-bold text-sm text-gray-900 min-w-[2.5rem] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(activeVariant.quantity_available, q + 1))}
                  disabled={quantity >= activeVariant.quantity_available || isOutOfStock}
                  className="p-2.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4 text-gray-700" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAdding}
                className={`flex-grow py-3 px-6 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                  isOutOfStock
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
              >
                {isAdding ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" />
                    <span>{isOutOfStock ? 'Sold Out' : `Add to Cart • ₹${(Number(activeVariant.price) * quantity).toFixed(0)}`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Add-to-Cart Action Bar (< 640px) */}
      <div className="sm:hidden fixed bottom-14 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 p-3 flex items-center gap-3 shadow-2xl">
        <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || isOutOfStock}
            className="p-2 text-gray-700 disabled:opacity-30"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="px-2.5 font-bold text-xs text-gray-900">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => Math.min(activeVariant.quantity_available, q + 1))}
            disabled={quantity >= activeVariant.quantity_available || isOutOfStock}
            className="p-2 text-gray-700 disabled:opacity-30"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock || isAdding}
          className={`flex-grow py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
            isOutOfStock
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" />
              <span>{isOutOfStock ? 'Sold Out' : `Add • ₹${(Number(activeVariant.price) * quantity).toFixed(0)}`}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProductDetail;
