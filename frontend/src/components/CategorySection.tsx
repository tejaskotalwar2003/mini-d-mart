import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight, Sparkles } from 'lucide-react';
import type { Category, Product } from '../types';
import ProductCard from './ProductCard';
import { categoryImageMeta } from './CategorySlider';

interface CategorySectionProps {
  category: Category;
  products: Product[];
  onSelectCategory: (categoryId: string) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  category,
  products,
  onSelectCategory,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!products || products.length === 0) return null;

  const meta = categoryImageMeta[category.slug] || {
    img: '',
    gradient: 'from-emerald-50 to-teal-100',
    emoji: '🛒',
  };

  const initialLimit = 4;
  const hasMore = products.length > initialLimit;
  const displayedProducts = isExpanded ? products : products.slice(0, initialLimit);
  const remainingCount = products.length - initialLimit;

  return (
    <section className="bg-white rounded-3xl border border-gray-200/90 p-4 sm:p-6 shadow-sm space-y-4 transition-all duration-300 hover:border-emerald-200">
      {/* Category Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center text-xl shadow-xs border border-emerald-100 flex-shrink-0">
            <span>{meta.emoji}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                {category.name}
              </h2>
              <span className="text-[11px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60">
                {products.length} {products.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
              Fresh stock ready for 10-minute doorstep delivery
            </p>
          </div>
        </div>

        {/* View All Header Link */}
        <button
          onClick={() => onSelectCategory(category.id)}
          className="self-start sm:self-center inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-emerald-700 hover:text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all group focus:outline-none"
        >
          <span>View All in {category.name}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* 4 Products Grid (or All Products when expanded) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
        {displayedProducts.map((product, idx) => (
          <div
            key={product.id}
            className={`${
              idx >= initialLimit ? 'animate-slide-up' : 'animate-fade-in'
            }`}
            style={{ animationDelay: `${(idx % initialLimit) * 50}ms` }}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {/* Expand / Collapse & Show More Button */}
      {hasMore && (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 border-t border-gray-100">
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all duration-200 shadow-xs active:scale-95 ${
              isExpanded
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 hover:border-emerald-300'
            }`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 text-gray-600" />
                <span>Show Less (Collapse to 4)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 text-emerald-700 animate-bounce" />
                <span>
                  Show More (+{remainingCount} more in {category.name})
                </span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </>
            )}
          </button>

          <span className="text-[11px] text-gray-400 font-semibold hidden sm:inline">
            Showing {displayedProducts.length} of {products.length} products
          </span>
        </div>
      )}
    </section>
  );
};

export default CategorySection;
