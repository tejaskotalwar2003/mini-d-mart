import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  ShoppingBasket,
  LogOut,
  LogIn,
  UserPlus,
  ShoppingCart,
  PackageCheck,
  LayoutDashboard,
  ShieldCheck,
  Menu,
  X,
  MapPin,
  Sparkles,
  Zap,
  User,
  Search,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [navSearch, setNavSearch] = useState<string>('');

  // Sync navSearch input with URL query param if on /products
  useEffect(() => {
    const query = searchParams.get('search') || '';
    setNavSearch(query);
  }, [searchParams]);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = navSearch.trim();
    if (query) {
      navigate(`/products?search=${encodeURIComponent(query)}`);
    } else if (location.pathname === '/products') {
      navigate('/products');
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNavSearch(val);
    // Real-time search if already on /products or when typing
    if (location.pathname === '/products') {
      const currentCategory = searchParams.get('category');
      const params = new URLSearchParams();
      if (val.trim()) params.set('search', val.trim());
      if (currentCategory) params.set('category', currentCategory);
      navigate(`/products${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
    }
  };

  const handleClearSearch = () => {
    setNavSearch('');
    if (location.pathname === '/products') {
      const currentCategory = searchParams.get('category');
      const params = new URLSearchParams();
      if (currentCategory) params.set('category', currentCategory);
      navigate(`/products${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
    }
  };

  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-lg sticky top-0 z-50 backdrop-blur-md bg-opacity-95 border-b border-emerald-600/40">
      {/* Main Top Header Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Section: Brand Logo & 10-Min Delivery Pill */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Link to="/products" className="flex items-center gap-1.5 sm:gap-2 group">
            <div className="bg-gradient-to-tr from-yellow-300 via-amber-400 to-yellow-200 text-emerald-950 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl group-hover:scale-105 group-hover:rotate-3 transition-all duration-300 shadow-md ring-2 ring-white/20">
              <ShoppingBasket className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-base sm:text-xl font-black tracking-tight text-white drop-shadow-sm whitespace-nowrap">
                  Mini <span className="text-amber-300">D-Mart</span>
                </span>
                <span className="inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.2 bg-white/20 text-[9px] sm:text-[10px] font-black rounded-full text-emerald-100 uppercase tracking-widest border border-white/10 hidden sm:inline-flex">
                  <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-amber-300" /> Express
                </span>
              </div>
              <span className="hidden lg:block text-[10px] text-emerald-200 font-semibold uppercase tracking-wider -mt-0.5">
                Fresh Farm Groceries
              </span>
            </div>
          </Link>

          {/* Quick 10-Min Delivery Badge */}
          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-900/80 border border-emerald-500/40 px-2.5 py-1 rounded-full shadow-inner">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
              <span className="font-black text-amber-300 whitespace-nowrap">10 MINS</span>
              <span className="text-emerald-300 font-medium hidden md:inline">·</span>
              <MapPin className="w-3 h-3 text-emerald-300 hidden md:inline" />
              <span className="text-emerald-100 font-medium truncate max-w-[90px] hidden md:inline">
                Home - 411048
              </span>
            </div>
          </div>
        </div>

        {/* 🔍 Center Section: Prominent Quick Commerce Search Bar (Desktop / Tablet) */}
        <div className="flex-1 max-w-xl mx-2 hidden sm:block">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-700 pointer-events-none" />
            <input
              type="text"
              value={navSearch}
              onChange={handleSearchChange}
              placeholder='Search "milk", "lays", "paneer", "mango", "dry fruits"...'
              className="w-full pl-10 pr-9 py-2 bg-white text-gray-900 placeholder-gray-400 rounded-xl text-xs sm:text-sm font-medium border border-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white shadow-inner transition-all"
            />
            {navSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>

        {/* Right Section: Navigation Links & User Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Admin Portal Link */}
          {isAdmin && (
            <Link
              to="/admin/dashboard"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 border border-blue-400/30"
              title="Admin Portal"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </Link>
          )}

          {/* Staff Portal Link */}
          {isStaffOrAdmin && (
            <Link
              to="/staff/dashboard"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-black bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-emerald-950 px-3 py-1.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105"
              title="Staff Control Center"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Staff</span>
            </Link>
          )}

          {/* My Orders Link */}
          {user && (
            <Link
              to="/orders"
              className="hidden lg:inline-flex items-center gap-1.5 text-xs font-bold text-emerald-100 hover:text-white hover:bg-white/10 px-2.5 py-1.5 rounded-xl transition-all"
              title="My Orders"
            >
              <PackageCheck className="w-4 h-4 text-emerald-300" />
              <span>Orders</span>
            </Link>
          )}

          {/* Vibrant Cart Button with Counter */}
          <Link
            to="/cart"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-extrabold text-xs shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border border-emerald-400/30 flex-shrink-0"
            title="Shopping Cart"
          >
            <div className="relative">
              <ShoppingCart className="w-4 h-4" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2.5 bg-amber-400 text-emerald-950 font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline">Cart</span>
            {itemCount > 0 && (
              <span className="bg-emerald-900/60 text-emerald-100 text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                {itemCount}
              </span>
            )}
          </Link>

          {/* User Profile / Auth Buttons */}
          {user ? (
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-emerald-600/60">
              <Link
                to="/profile"
                className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-white/10 transition-all text-right group"
                title="Edit Profile & Saved Addresses"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-emerald-950 flex items-center justify-center font-black text-xs shadow-sm group-hover:scale-105 transition-transform">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold leading-tight text-white group-hover:text-amber-200 transition-colors truncate max-w-[100px]">
                    {user.name}
                  </p>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-emerald-900 text-emerald-200 rounded-md border border-emerald-500/40">
                    {user.role}
                  </span>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1 p-2 bg-emerald-900/80 hover:bg-red-600 text-emerald-200 hover:text-white text-xs font-bold rounded-xl transition-all border border-emerald-600/40 shadow-sm"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-emerald-600/60">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-emerald-950 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 rounded-xl transition-all shadow-md hover:scale-105"
              >
                <UserPlus className="w-4 h-4" />
                Register
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-white hover:bg-white/10 rounded-xl transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar Row (< 640px) */}
      <div className="sm:hidden px-3 pb-2.5 pt-0.5">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700 pointer-events-none" />
          <input
            type="text"
            value={navSearch}
            onChange={handleSearchChange}
            placeholder='Search "milk", "lays", "paneer", "mango"...'
            className="w-full pl-9 pr-8 py-2 bg-white text-gray-900 placeholder-gray-400 rounded-xl text-xs font-medium border border-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
          />
          {navSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-emerald-900/95 backdrop-blur-xl border-t border-emerald-600/50 px-4 py-4 space-y-3 shadow-2xl animate-fade-in">
          {user && (
            <Link
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="pb-3 border-b border-emerald-700/60 flex items-center justify-between hover:bg-emerald-800/40 p-2 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-emerald-950 flex items-center justify-center font-black text-base shadow">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-black text-white">{user.name}</p>
                  <p className="text-xs text-emerald-300">{user.email}</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-950 text-emerald-200 rounded-lg border border-emerald-700">
                {user.role}
              </span>
            </Link>
          )}

          <div className="space-y-2">
            <Link
              to="/products"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors"
            >
              <ShoppingBasket className="w-4 h-4 text-emerald-300" />
              <span>Browse Catalog</span>
            </Link>

            {user && (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors"
                >
                  <User className="w-4 h-4 text-amber-300" />
                  <span>My Profile & Address</span>
                </Link>

                <Link
                  to="/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors"
                >
                  <PackageCheck className="w-4 h-4 text-emerald-300" />
                  <span>My Orders</span>
                </Link>
              </>
            )}

            {isStaffOrAdmin && (
              <Link
                to="/staff/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-black bg-gradient-to-r from-amber-400 to-yellow-400 text-emerald-950 rounded-xl shadow-md"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Staff Control Center</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-black bg-blue-600 text-white rounded-xl shadow-md"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Portal</span>
              </Link>
            )}
          </div>

          <div className="pt-3 border-t border-emerald-700/60">
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-950 hover:bg-red-700 text-red-300 hover:text-white text-sm font-bold rounded-xl transition-all border border-emerald-800 shadow"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold bg-emerald-950 hover:bg-emerald-800 text-white rounded-xl border border-emerald-700 shadow"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-black bg-gradient-to-r from-amber-400 to-yellow-300 text-emerald-950 rounded-xl shadow-md"
                >
                  <UserPlus className="w-4 h-4" />
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
