import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-lg sticky top-0 z-50 backdrop-blur-md bg-opacity-95 border-b border-emerald-600/40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left Section: Brand Logo + Superfast Delivery Badge */}
        <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
          <Link to="/products" className="flex items-center gap-2.5 group">
            <div className="bg-gradient-to-tr from-yellow-300 via-amber-400 to-yellow-200 text-emerald-950 p-2 rounded-2xl group-hover:scale-105 group-hover:rotate-3 transition-all duration-300 shadow-md ring-2 ring-white/20">
              <ShoppingBasket className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-white drop-shadow-sm">
                  Mini <span className="text-amber-300">D-Mart</span>
                </span>
                <span className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white/15 text-[10px] font-black rounded-full text-emerald-100 uppercase tracking-widest border border-white/10">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" /> Express
                </span>
              </div>
              <span className="hidden sm:block text-[10px] text-emerald-200 font-semibold uppercase tracking-wider -mt-0.5">
                Fresh Farm Groceries
              </span>
            </div>
          </Link>

          {/* Quick Commerce 10-Min Delivery Pill */}
          <div className="hidden lg:flex items-center gap-2 bg-emerald-900/60 border border-emerald-500/30 px-3 py-1.5 rounded-full shadow-inner">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span className="font-extrabold text-amber-300">10 MINS</span>
              <span className="text-emerald-300 font-medium">·</span>
              <MapPin className="w-3 h-3 text-emerald-300" />
              <span className="text-emerald-100 font-medium truncate max-w-[120px]">Home - 411048</span>
            </div>
          </div>
        </div>

        {/* Right Section: Navigation Links & Cart */}
        <div className="hidden md:flex items-center gap-3">
          {/* Admin Portal Link */}
          {isAdmin && (
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 border border-blue-400/30"
              title="Admin Portal"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Portal</span>
            </Link>
          )}

          {/* Staff Portal Link */}
          {isStaffOrAdmin && (
            <Link
              to="/staff/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-black bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-emerald-950 px-3.5 py-2 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105"
              title="Staff Control Center"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Staff Portal</span>
            </Link>
          )}

          {/* My Orders Link */}
          {user && (
            <Link
              to="/orders"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-100 hover:text-white hover:bg-white/10 px-3 py-2 rounded-xl transition-all"
              title="My Orders"
            >
              <PackageCheck className="w-4 h-4 text-emerald-300" />
              <span>My Orders</span>
            </Link>
          )}

          {/* Vibrant Cart Button with Badge */}
          <Link
            to="/cart"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-4 py-2 rounded-xl font-extrabold text-xs shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border border-emerald-400/30"
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
            <span>Cart</span>
            {itemCount > 0 && (
              <span className="bg-emerald-900/60 text-emerald-100 text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </Link>

          {/* User Account / Auth Buttons */}
          {user ? (
            <div className="flex items-center gap-2.5 pl-3 border-l border-emerald-600/60">
              <Link
                to="/profile"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-all text-right group"
                title="Edit Profile & Saved Addresses"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-emerald-950 flex items-center justify-center font-black text-xs shadow-sm group-hover:scale-105 transition-transform">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight text-white group-hover:text-amber-200 transition-colors">
                    {user.name}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-emerald-900 text-emerald-200 rounded-md border border-emerald-500/40">
                      {user.role}
                    </span>
                  </div>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-900/80 hover:bg-red-600 text-emerald-200 hover:text-white text-xs font-bold rounded-xl transition-all border border-emerald-600/40 shadow-sm"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-3 border-l border-emerald-600/60">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-emerald-950 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 rounded-xl transition-all shadow-md hover:scale-105"
              >
                <UserPlus className="w-4 h-4" />
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Header Actions (< 768px) */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            to="/cart"
            className="relative p-2 text-white hover:bg-white/10 rounded-xl transition-colors"
            title="Shopping Cart"
          >
            <ShoppingCart className="w-6 h-6" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-amber-400 text-emerald-950 font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-emerald-900/95 backdrop-blur-xl border-t border-emerald-600/50 px-4 py-4 space-y-3 shadow-2xl animate-in slide-in-from-top-2 duration-200">
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
