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
  Copy,
  Check,
  Clock,
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
    gradient: 'from-rose-950 via-pink-900 to-amber-900',
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
    gradient: 'from-emerald-950 via-teal-900 to-green-900',
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
    gradient: 'from-amber-950 via-orange-900 to-yellow-900',
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
    gradient: 'from-indigo-950 via-purple-950 to-pink-950',
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
    gradient: 'from-cyan-950 via-sky-950 to-blue-950',
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
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

  // Copy promo coupon code
  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Touch gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) nextSlide();
    if (distance < -50) prevSlide();
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleSlideClick = (slug?: string) => {
    if (slug && onSelectCategorySlug) {
      onSelectCategorySlug(slug);
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl shadow-xl transition-all select-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Banner Slides Carousel */}
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {BANNER_SLIDES.map((slide) => {
          const SlideIcon = slide.Icon;

          return (
            <div
              key={slide.id}
              className={`w-full flex-shrink-0 bg-gradient-to-r ${slide.gradient} p-5 sm:p-7 md:p-9 text-white relative overflow-hidden border ${slide.borderColor} min-h-[260px] sm:min-h-[300px] flex items-center`}
            >
              {/* Background ambient lighting */}
              <div className="absolute -right-16 -top-16 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-16 -bottom-16 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center w-full">
                {/* Left Text / CTAs Column */}
                <div className="md:col-span-7 space-y-3 sm:space-y-4">
                  {/* Top Badges & Tag */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/15 backdrop-blur-md border border-white/20 uppercase tracking-wider text-amber-200 shadow-xs">
                      <span>{slide.badgeEmoji}</span>
                      <span>{slide.tag}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-400 text-rose-950 uppercase tracking-wider shadow-sm animate-pulse">
                      <Zap className="w-3.5 h-3.5 fill-rose-950" />
                      {slide.discountText}
                    </span>

                    {/* Deal Timer */}
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/30 backdrop-blur-md text-amber-200 border border-amber-400/20">
                      <Clock className="w-3 h-3 text-amber-300" /> Ends today
                    </span>
                  </div>

                  {/* Main Title & Subtitle */}
                  <div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight drop-shadow-md">
                      {slide.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-200 font-medium mt-1 line-clamp-2 drop-shadow-xs max-w-xl">
                      {slide.subtitle}
                    </p>
                  </div>

                  {/* Highlights and Coupon Code */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <span className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                      {slide.highlight}
                    </span>

                    {slide.code && (
                      <button
                        onClick={(e) => handleCopyCode(slide.code!, e)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-amber-400/40 rounded-xl text-xs font-mono font-bold text-amber-200 transition-all shadow-xs cursor-pointer active:scale-95 group/code"
                        title="Click to copy coupon code"
                      >
                        {copiedCode === slide.code ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300 font-bold">COPIED!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-amber-300 group-hover/code:scale-110 transition-transform" />
                            <span>CODE: <strong className="text-white underline">{slide.code}</strong></span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => handleSlideClick(slide.categorySlug)}
                      className="px-5 py-2.5 sm:px-6 sm:py-3 bg-white text-gray-900 hover:bg-amber-300 font-black text-xs sm:text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 flex items-center gap-2 group/btn"
                    >
                      <span>Shop Collection</span>
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* Right Product Image Showcase Card */}
                <div className="hidden md:flex md:col-span-5 justify-end relative">
                  <div className="relative group/img">
                    {/* Glowing Backdrop */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-amber-400/30 to-pink-500/30 rounded-3xl blur-lg opacity-70 group-hover/img:opacity-100 transition-opacity" />

                    {/* Image Card Container */}
                    <div className="relative bg-white/10 backdrop-blur-md p-2 rounded-3xl border border-white/20 shadow-2xl overflow-hidden w-64 h-48 lg:w-72 lg:h-52">
                      <img
                        src={slide.imageUrl}
                        alt={slide.title}
                        className="w-full h-full object-cover rounded-2xl group-hover/img:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Floating Category Badge */}
                      <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-white text-xs font-bold flex items-center justify-between shadow-lg">
                        <span className="truncate">{slide.floatingBadge}</span>
                        <SlideIcon className="w-4 h-4 text-amber-300 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prev / Next Arrows */}
      <button
        onClick={prevSlide}
        aria-label="Previous Slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/30 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 active:scale-90 shadow-md z-20"
      >
        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      <button
        onClick={nextSlide}
        aria-label="Next Slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/30 text-white flex items-center justify-center transition-all opacity-80 hover:opacity-100 active:scale-90 shadow-md z-20"
      >
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Navigation Dot Indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
        {BANNER_SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`transition-all duration-300 rounded-full ${
              currentIndex === idx
                ? 'w-6 h-2 bg-amber-400 shadow-sm'
                : 'w-2 h-2 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroSlider;
