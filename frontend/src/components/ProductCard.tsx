import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Check, Package, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import type { Product, ProductVariantInfo } from '../types';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { user } = useAuth();
  const { addToCart } = useCart();
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

  const [isAddedAnim, setIsAddedAnim] = useState<boolean>(false);

  const isOutOfStock = selectedVariant.quantity_available === 0;
  const isLowStock = selectedVariant.quantity_available > 0 && selectedVariant.quantity_available < 10;
  const hasVariants = product.variants && product.variants.length > 1;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    const err = await addToCart(selectedVariant.id, 1);
    if (err) {
      showToast(err, { type: 'error' });
    } else {
      setIsAddedAnim(true);
      setTimeout(() => setIsAddedAnim(false), 1400);

      showToast(product.name, {
        type: 'success',
        subMessage: `₹${Number(selectedVariant.price).toFixed(0)} · ${selectedVariant.unit}`,
        imageUrl: product.image_url || undefined,
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group card-hover-effect relative">
      <Link to={`/products/${selectedVariant.id}`} className="block relative p-2.5 sm:p-4">
        {/* Top Badges: Stock Status & Fast 10m Tag */}
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 flex flex-col gap-1">
          {isOutOfStock ? (
            <span className="bg-red-500 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              Sold Out
            </span>
          ) : isLowStock ? (
            <span className="bg-amber-500 text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              Only {selectedVariant.quantity_available} left
            </span>
          ) : (
            <span className="bg-emerald-600/90 backdrop-blur text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              In Stock
            </span>
          )}
        </div>

        {/* 10-Min Fast Delivery Badge */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
          <span className="bg-amber-50 border border-amber-200/80 text-amber-800 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
            ⚡ 10m
          </span>
        </div>

        {/* Product Image */}
        <div className="w-full h-32 sm:h-44 bg-gradient-to-b from-gray-50/80 to-gray-100/50 rounded-xl flex items-center justify-center overflow-hidden mb-2 sm:mb-3 group-hover:scale-105 transition-transform duration-300">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain p-2 sm:p-3 drop-shadow-xs"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <Package className="w-10 h-10 sm:w-16 sm:h-16 text-gray-300" />
          )}
        </div>

        {/* Category Badge & Returnable Flag */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider line-clamp-1 bg-emerald-50 w-fit px-1.5 py-0.5 rounded-md">
            {product.category_name}
          </span>
          {product.is_returnable && (
            <span className="text-[9px] text-gray-500 font-semibold flex items-center gap-0.5">
              <RotateCcw className="w-2.5 h-2.5 text-emerald-600" /> 7d return
            </span>
          )}
        </div>

        {/* Product Name */}
        <h3 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-2 mt-1 min-h-[2rem] sm:min-h-[2.5rem] group-hover:text-emerald-700 transition-colors leading-snug">
          {product.name}
        </h3>

        {/* Price & Unit */}
        <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5">
          <span className="text-base sm:text-xl font-black text-gray-900">
            ₹{Number(selectedVariant.price).toFixed(0)}
          </span>
          <span className="text-[10px] sm:text-xs text-gray-400 font-semibold truncate">
            / {selectedVariant.unit}
          </span>
        </div>
      </Link>

      {/* Variant Chips */}
      {hasVariants && (
        <div className="px-2.5 sm:px-4 pb-2 flex flex-wrap gap-1">
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
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className={`w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition-all duration-200 shadow-sm hover:shadow-md btn-bounce ${
            isOutOfStock
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              : isAddedAnim
              ? 'bg-emerald-700 text-white scale-95 shadow-inner'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 hover:scale-[1.02]'
          }`}
        >
          {isAddedAnim ? (
            <>
              <Check className="w-4 h-4 text-amber-300 animate-scale-in" />
              <span>ADDED</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>{isOutOfStock ? 'Sold Out' : 'ADD'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
