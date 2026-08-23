import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import type { Category } from '../types';

export const categoryImageMeta: Record<string, { img: string; gradient: string; emoji: string }> = {
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
    img: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-rose-50 to-amber-100',
    emoji: '🪢',
  },
  'cooking-essentials': {
    img: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-yellow-50 to-orange-100',
    emoji: '🍳',
  },
  'dry-fruits-nuts': {
    img: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-amber-50 to-yellow-100',
    emoji: '🥜',
  },
  'pulses-grains': {
    img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-lime-50 to-green-100',
    emoji: '🌾',
  },
  'breakfast-cereals': {
    img: 'https://images.unsplash.com/photo-1521483451569-e33803c0330c?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-orange-50 to-amber-100',
    emoji: '🥣',
  },
  'baby-care': {
    img: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-blue-50 to-sky-100',
    emoji: '👶',
  },
  'health-wellness': {
    img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-teal-50 to-emerald-100',
    emoji: '💊',
  },
  'pet-care': {
    img: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-violet-50 to-purple-100',
    emoji: '🐾',
  },
};

interface CategorySliderProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}

export const CategorySlider: React.FC<CategorySliderProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScrollArrows = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScrollArrows();
    const current = scrollContainerRef.current;
    if (current) {
      current.addEventListener('scroll', checkScrollArrows);
      window.addEventListener('resize', checkScrollArrows);
    }
    return () => {
      if (current) current.removeEventListener('scroll', checkScrollArrows);
      window.removeEventListener('resize', checkScrollArrows);
    };
  }, [categories]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const offset = direction === 'left' ? -280 : 280;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 p-3 sm:p-4 shadow-sm relative">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
            Explore by Category
          </h2>
        </div>
        {selectedCategoryId && (
          <button
            onClick={() => onSelectCategory('')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline flex items-center gap-1 transition-colors"
          >
            Show All
          </button>
        )}
      </div>

      {/* Slider Wrapper with Navigation Arrows */}
      <div className="relative group/slider">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll Categories Left"
            className="absolute -left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white text-gray-800 shadow-md border border-gray-200 flex items-center justify-center z-10 hover:bg-gray-50 hover:scale-110 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex items-start gap-2.5 sm:gap-3.5 overflow-x-auto py-1 px-0.5 scrollbar-none scroll-smooth"
        >
          {/* "All" Item */}
          <button
            onClick={() => onSelectCategory('')}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group focus:outline-none"
          >
            <div
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl overflow-hidden relative transition-all duration-200 bg-gradient-to-br from-emerald-50 to-teal-100 border-2 ${
                selectedCategoryId === ''
                  ? 'border-emerald-600 shadow-md ring-2 ring-emerald-400 ring-offset-1 scale-105'
                  : 'border-gray-100 hover:border-emerald-300 hover:scale-105'
              }`}
            >
              <img
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80"
                alt="All Products"
                className="w-full h-full object-cover"
              />
              {selectedCategoryId === '' && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-600 rounded-full flex items-center justify-center shadow">
                  <span className="text-white text-[8px] font-black">✓</span>
                </div>
              )}
            </div>
            <span
              className={`text-[11px] sm:text-xs font-bold text-center leading-tight truncate max-w-[70px] sm:max-w-[80px] ${
                selectedCategoryId === '' ? 'text-emerald-700' : 'text-gray-700'
              }`}
            >
              All Items
            </span>
          </button>

          {/* Categories List */}
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            const meta = categoryImageMeta[cat.slug] || {
              img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80',
              gradient: 'from-gray-50 to-gray-100',
              emoji: '📦',
            };
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group focus:outline-none"
              >
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl overflow-hidden relative transition-all duration-200 bg-gradient-to-br ${meta.gradient} border-2 ${
                    isSelected
                      ? 'border-emerald-600 shadow-md ring-2 ring-emerald-400 ring-offset-1 scale-105'
                      : 'border-gray-100 hover:border-emerald-300 hover:scale-105'
                  }`}
                >
                  <img
                    src={meta.img}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-600 rounded-full flex items-center justify-center shadow">
                      <span className="text-white text-[8px] font-black">✓</span>
                    </div>
                  )}
                </div>
                <span
                  className={`text-[11px] sm:text-xs font-bold text-center leading-tight line-clamp-2 max-w-[70px] sm:max-w-[80px] ${
                    isSelected ? 'text-emerald-700' : 'text-gray-700'
                  }`}
                >
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll Categories Right"
            className="absolute -right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white text-gray-800 shadow-md border border-gray-200 flex items-center justify-center z-10 hover:bg-gray-50 hover:scale-110 active:scale-95 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CategorySlider;
