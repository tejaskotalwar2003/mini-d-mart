import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Zap,
  Gift,
  Apple,
  Milk,
  Cookie,
  ShieldCheck,
} from 'lucide-react';

export interface BannerSlide {
  id: string;
  categorySlug?: string;
  tag: string;
  badgeEmoji: string;
  discountText: string;
  title: string;
  subtitle: string;
  highlight: string;
  code?: string;
  gradient: string;
  borderColor: string;
  iconBg: string;
  Icon: React.ElementType;
  imageUrl: string;
  floatingBadge: string;
}

const BANNER_SLIDES: BannerSlide[] = [
  {
    id: 'rakhi-special',
    categorySlug: 'raksha-bandhan',
    tag: 'Festive Dhamaka',
    badgeEmoji: '🪢',
    discountText: 'Flat 40% OFF',
    title: 'Celebrate Raksha Bandhan',
    subtitle: 'Designer Rakhis, Pure Ghee Kaju Katli & Cadbury Gift Packs',
    highlight: '⚡ Starting @ ₹29 · Delivered in 10 mins',
    code: 'RAKHI50',
    gradient: 'from-rose-900 via-pink-800 to-amber-800',
    borderColor: 'border-rose-400/40',
    iconBg: 'bg-rose-500/30',
    Icon: Gift,
    imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=600&q=80',
    floatingBadge: '🎁 Festive Gift Boxes',
  },
  {
    id: 'fresh-fruits-veggies',
    categorySlug: 'fruits-vegetables',
    tag: 'Farm Fresh Organic',
    badgeEmoji: '🍎',
    discountText: 'Up to 35% OFF',
    title: 'Crisp Vegetables & Fresh Fruits',
    subtitle: 'Directly sourced from trusted local farmers every morning',
    highlight: '🌱 100% Organic & Chemical-Free Guarantee',
    gradient: 'from-emerald-900 via-teal-800 to-green-800',
    borderColor: 'border-emerald-400/40',
    iconBg: 'bg-emerald-500/30',
    Icon: Apple,
    imageUrl: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?auto=format&fit=crop&w=600&q=80',
    floatingBadge: '🥦 Farm Harvested Daily',
  },
  {
    id: 'dairy-bakery',
    categorySlug: 'dairy-bakery',
    tag: 'Morning Essentials',
    badgeEmoji: '🥛',
    discountText: 'Fresh Daily',
    title: 'Pure Milk, Artisan Bread & Butter',
    subtitle: 'Amul, Mother Dairy & Freshly Baked Sourdough Loaves',
    highlight: '🧀 Lowest Price & Cold-Chain Delivery',
    code: 'DAIRY20',
    gradient: 'from-amber-800 via-orange-700 to-yellow-800',
    borderColor: 'border-amber-400/40',
    iconBg: 'bg-amber-500/30',
    Icon: Milk,
    imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
    floatingBadge: '🍞 Freshly Baked & Chilled',
  },
  {
    id: 'snacks-beverages',
    categorySlug: 'snacks-beverages',
    tag: 'Party Munchies',
    badgeEmoji: '🍿',
    discountText: 'Buy 2 Get 1 FREE',
    title: 'Craving Chips, Sodas & Chocolates?',
    subtitle: 'Lays, Doritos, Ferrero Rocher & Real Fruit Juices in minutes',
    highlight: '⚡ Midnight Snack Craving Sorted!',
    gradient: 'from-indigo-950 via-purple-900 to-pink-900',
    borderColor: 'border-indigo-400/40',
    iconBg: 'bg-indigo-500/30',
    Icon: Cookie,
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
    floatingBadge: '🍫 Premium Chocolates & Drinks',
  },
  {
    id: 'household-care',
    categorySlug: 'household-essentials',
    tag: 'Super Saver Mega Pack',
    badgeEmoji: '🧼',
    discountText: 'Mega Cashback',
    title: 'Clean Home & Hygiene Essentials',
    subtitle: 'Surf Excel, Dettol, Vim & Floor Cleaners at wholesale rates',
    highlight: '🛡️ Extra ₹100 Off on orders above ₹799',
    code: 'CLEAN100',
    gradient: 'from-cyan-950 via-sky-900 to-blue-900',
    borderColor: 'border-cyan-400/40',
    iconBg: 'bg-cyan-500/30',
    Icon: ShieldCheck,
    imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80',
    floatingBadge: '✨ Spotless & Disinfected',
  },
];

interface HeroSliderProps {
  onSelectCategorySlug?: (slug: string) => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ onSelectCategorySlug }) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % BANNER_SLIDES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + BANNER_SLIDES.length) % BANNER_SLIDES.length);
  }, []);

  // Autoplay interval with pause on hover
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  // Touch gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 45) {
      nextSlide();
    } else if (diff < -45) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentSlide = BANNER_SLIDES[currentIndex];

  const handleSlideClick = () => {
    if (currentSlide.categorySlug && onSelectCategorySlug) {
      onSelectCategorySlug(currentSlide.categorySlug);
    }
  };

  return (
    <div
      className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg select-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Active Banner Slide Container */}
      <div
        onClick={handleSlideClick}
        className={`w-full min-h-[200px] sm:min-h-[240px] md:min-h-[260px] bg-gradient-to-r ${currentSlide.gradient} border ${currentSlide.borderColor} p-4 sm:p-7 text-white flex items-center justify-between gap-4 relative overflow-hidden transition-all duration-500 cursor-pointer`}
      >
        {/* Background Subtle Shimmer Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 animate-shimmer pointer-events-none" />

        {/* Floating Background Glow Orbs */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-black/25 blur-3xl pointer-events-none" />

        {/* Left-Hand Text Content */}
        <div className="relative z-10 flex flex-col justify-between h-full max-w-xl flex-1 py-1">
          {/* Top Header Tag Row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="bg-white/20 backdrop-blur-md text-white text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 border border-white/20 shadow-xs">
              <span>{currentSlide.badgeEmoji}</span>
              <span>{currentSlide.tag}</span>
            </span>
            <span className="bg-amber-400 text-rose-950 text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md animate-pulse">
              {currentSlide.discountText}
            </span>

            {currentSlide.code && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-black text-amber-200 bg-black/30 backdrop-blur-md px-2.5 py-0.5 rounded-lg border border-amber-400/30">
                <Sparkles className="w-3 h-3 text-yellow-300" />
                Code: <span className="text-white underline">{currentSlide.code}</span>
              </span>
            )}
          </div>

          {/* Title & Subtitle */}
          <div className="my-1 sm:my-2">
            <h2 className="text-base sm:text-2xl md:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-md animate-fade-in">
              {currentSlide.title}
            </h2>
            <p className="text-white/85 text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium line-clamp-2 max-w-lg">
              {currentSlide.subtitle}
            </p>
          </div>

          {/* Bottom Action & Highlight Row */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 mt-1">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-amber-200 truncate">
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300 flex-shrink-0" />
              <span className="truncate">{currentSlide.highlight}</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSlideClick();
              }}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-black bg-white text-gray-900 hover:bg-amber-300 hover:text-emerald-950 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl transition-all duration-200 shadow-md active:scale-95 group-hover:scale-105 flex-shrink-0"
            >
              <span>Shop Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 🖼️ Right-Hand Featured Banner Image Showcase */}
        <div className="relative z-10 flex-shrink-0 w-28 sm:w-48 md:w-60 aspect-square sm:aspect-4/3 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl group-hover:scale-105 transition-transform duration-500 bg-white/10 backdrop-blur-xs">
          <img
            src={currentSlide.imageUrl}
            alt={currentSlide.title}
            className="w-full h-full object-cover"
          />
          {/* Subtle Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

          {/* Floating Tag over Image */}
          <div className="absolute bottom-2 left-2 right-2 hidden sm:block">
            <span className="inline-block w-full text-center bg-black/60 backdrop-blur-md text-amber-200 text-[10px] font-black py-1 px-2 rounded-lg border border-white/20 truncate">
              {currentSlide.floatingBadge}
            </span>
          </div>
        </div>
      </div>

      {/* Left Navigation Arrow */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          prevSlide();
        }}
        aria-label="Previous Slide"
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/30 hover:bg-black/60 text-white backdrop-blur-md flex items-center justify-center transition-all duration-200 opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-110 shadow-lg border border-white/20 z-20"
      >
        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Right Navigation Arrow */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          nextSlide();
        }}
        aria-label="Next Slide"
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/30 hover:bg-black/60 text-white backdrop-blur-md flex items-center justify-center transition-all duration-200 opacity-80 sm:opacity-0 group-hover:opacity-100 hover:scale-110 shadow-lg border border-white/20 z-20"
      >
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Interactive Bottom Indicator Pills */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20">
        {BANNER_SLIDES.map((slide, idx) => (
          <button
            key={slide.id}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? 'w-7 sm:w-9 bg-amber-400 shadow-sm'
                : 'w-2 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroSlider;
