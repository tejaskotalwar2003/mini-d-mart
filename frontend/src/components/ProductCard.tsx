import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Minus, Package, RotateCcw, Star, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import type { Product, ProductVariantInfo } from '../types';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { user } = useAuth();
  const { cart, addToCart, updateCartItem, removeFromCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariantInfo>(() => {
    if (product.variants && product.variants.length > 0) {
      return product.variants[0];
    }
    return {
      id: product.id,
      sku: product.sku,
      price: product.price,
      unit: product.unit,
      quantity_available: product.quantity_available,
    };
  });

  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Find if this product variant is currently in the cart
  const cartItem = cart?.items.find((item) => item.product_id === selectedVariant.id);
  const currentQtyInCart = cartItem ? cartItem.quantity : 0;

  const isOutOfStock = selectedVariant.quantity_available === 0;
  const isLowStock = selectedVariant.quantity_available > 0 && selectedVariant.quantity_available < 10;
  const hasVariants = product.variants && product.variants.length > 1;

  // Calculate realistic original MRP and discount percentage for visual delight
  const currentPrice = Number(selectedVariant.price);
  const originalMrp = Math.round(currentPrice * 1.22);
  const discountPercent = Math.max(10, Math.round(((originalMrp - currentPrice) / originalMrp) * 100));

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    setIsUpdating(true);
    const err = await addToCart(selectedVariant.id, 1);
    setIsUpdating(false);

    if (err) {
      showToast(err, { type: 'error' });
    } else {
      showToast(product.name, {
        type: 'success',
        subMessage: `₹${currentPrice.toFixed(0)} · Added to bag`,
        imageUrl: product.image_url || undefined,
      });
    }
  };

  const handleIncrement = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cartItem) return;

    if (currentQtyInCart >= selectedVariant.quantity_available) {
      showToast(`Only ${selectedVariant.quantity_available} units available in stock`, { type: 'error' });
      return;
    }

    setIsUpdating(true);
    await updateCartItem(cartItem.id, currentQtyInCart + 1);
    setIsUpdating(false);
  };

  const handleDecrement = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cartItem) return;

    setIsUpdating(true);
    if (currentQtyInCart > 1) {
      await updateCartItem(cartItem.id, currentQtyInCart - 1);
    } else {
      await removeFromCart(cartItem.id);
    }
    setIsUpdating(false);
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300 flex flex-col justify-between overflow-hidden group card-hover-effect relative">
      <Link to={`/products/${selectedVariant.id}`} className="block relative p-3 sm:p-4">
        {/* Top Floating Badges */}
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 flex flex-col gap-1">
          {/* Discount Pill */}
          <span className="bg-gradient-to-r from-rose-600 to-red-500 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-sm flex items-center gap-0.5">
            {discountPercent}% OFF
          </span>

          {isOutOfStock ? (
            <span className="bg-gray-800 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-xs">
              Sold Out
            </span>
          ) : isLowStock ? (
            <span className="bg-amber-500 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shadow-xs animate-pulse">
              Only {selectedVariant.quantity_available} left
            </span>
          ) : null}
        </div>

        {/* 10-Min Fast Delivery Badge */}
        <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10">
          <span className="bg-amber-50/90 backdrop-blur border border-amber-200 text-amber-900 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
            10 MINS
          </span>
        </div>

        {/* Product Image Showcase */}
        <div className="w-full h-36 sm:h-44 bg-gradient-to-b from-gray-50/60 to-gray-100/40 rounded-2xl flex items-center justify-center overflow-hidden mb-2.5 group-hover:scale-105 transition-transform duration-300 relative">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain p-2 sm:p-3 drop-shadow-sm"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <Package className="w-12 h-12 text-gray-300" />
          )}

          {/* Micro Rating Star on Image Bottom */}
          <div className="absolute bottom-1.5 left-2 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-md border border-gray-200/80 shadow-xs flex items-center gap-1 text-[10px] font-black text-gray-800">
            <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-400" />
            <span>4.8</span>
          </div>
        </div>

        {/* Category Badge & 7-Day Return Flag */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider line-clamp-1 bg-emerald-50 px-2 py-0.5 rounded-md">
            {product.category_name}
          </span>
          {product.is_returnable && (
            <span className="text-[9px] text-gray-400 font-semibold flex items-center gap-0.5">
              <RotateCcw className="w-2.5 h-2.5 text-emerald-600" /> 7d return
            </span>
          )}
        </div>

        {/* Product Name */}
        <h3 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] group-hover:text-emerald-700 transition-colors leading-snug">
          {product.name}
        </h3>

        {/* Price & Unit & Savings Tag */}
        <div className="mt-1 flex items-baseline justify-between gap-1">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-base sm:text-xl font-black text-gray-900">
              ₹{currentPrice.toFixed(0)}
            </span>
            <span className="text-xs text-gray-400 line-through font-semibold">
              ₹{originalMrp}
            </span>
          </div>
          <span className="text-[10px] sm:text-xs text-gray-500 font-bold">
            {selectedVariant.unit}
          </span>
        </div>
      </Link>

      {/* Variant Selector Chips */}
      {hasVariants && (
        <div className="px-3 sm:px-4 pb-2 flex flex-wrap gap-1">
          {product.variants!.map((variant) => {
            const isActive = selectedVariant.id === variant.id;
            return (
              <button
                key={variant.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedVariant(variant);
                }}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                  isActive
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                {variant.unit}
              </button>
            );
          })}
        </div>
      )}

      {/* Dynamic Action Button / Quantity Stepper */}
      <div className="p-3 sm:p-4 pt-0">
        {isOutOfStock ? (
          <button
            disabled
            className="w-full py-2 sm:py-2.5 px-3 bg-gray-100 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed text-center uppercase tracking-wider"
          >
            Out of Stock
          </button>
        ) : currentQtyInCart > 0 ? (
          /* 🔥 Interactive In-Cart Stepper (- [ qty ] +) */
          <div className="w-full flex items-center justify-between bg-emerald-700 text-white rounded-xl shadow-md overflow-hidden border border-emerald-800">
            <button
              onClick={handleDecrement}
              disabled={isUpdating}
              className="p-2 sm:p-2.5 hover:bg-emerald-800 active:scale-90 transition-all text-white flex items-center justify-center flex-1"
              title="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs sm:text-sm font-black px-2 select-none">
              {currentQtyInCart}
            </span>
            <button
              onClick={handleIncrement}
              disabled={isUpdating}
              className="p-2 sm:p-2.5 hover:bg-emerald-800 active:scale-90 transition-all text-white flex items-center justify-center flex-1"
              title="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Standard Add to Cart Button */
          <button
            onClick={handleAddToCart}
            disabled={isUpdating}
            className="w-full py-2 sm:py-2.5 px-4 bg-emerald-50 hover:bg-emerald-700 text-emerald-800 hover:text-white border border-emerald-300 hover:border-emerald-700 text-xs sm:text-sm font-extrabold rounded-xl transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5 group/btn"
          >
            <Plus className="w-3.5 h-3.5 group-hover/btn:rotate-90 transition-transform" />
            <span>ADD TO CART</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
