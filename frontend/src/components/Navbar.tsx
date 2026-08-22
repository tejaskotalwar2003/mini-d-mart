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
    <header className="bg-emerald-700 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/products" className="flex items-center gap-2 group flex-shrink-0">
          <div className="bg-white text-emerald-700 p-1.5 sm:p-2 rounded-xl group-hover:scale-105 transition-transform shadow-sm">
            <ShoppingBasket className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight">Mini D-Mart</span>
            <span className="hidden sm:block text-[10px] text-emerald-200 font-medium uppercase tracking-wider -mt-1">
              Fresh Groceries
            </span>
          </div>
        </Link>

        {/* Right Section: Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-3">
          {/* Admin Portal Link */}
          {isAdmin && (
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors shadow-sm"
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
              className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-emerald-950 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
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
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-100 hover:text-white hover:bg-emerald-600/50 px-3 py-1.5 rounded-lg transition-colors"
              title="My Orders"
            >
              <PackageCheck className="w-4 h-4" />
              <span>My Orders</span>
            </Link>
          )}

          {/* Cart Icon Link */}
          <Link
            to="/cart"
            className="relative p-2 text-emerald-100 hover:text-white hover:bg-emerald-600/50 rounded-lg transition-colors"
            title="Shopping Cart"
          >
            <ShoppingCart className="w-6 h-6" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-emerald-950 font-black text-xs w-5 h-5 rounded-full flex items-center justify-center border-2 border-emerald-700 shadow-sm animate-pulse">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>

          {user ? (
            <div className="flex items-center gap-3 pl-3 border-l border-emerald-600">
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight">{user.name}</p>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-emerald-800 text-emerald-200 rounded border border-emerald-500/30">
                    {user.role}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-emerald-100 hover:text-white text-xs font-semibold rounded-lg transition-colors border border-emerald-600/50 shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-3 border-l border-emerald-600">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600/60 rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm"
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
            className="relative p-2 text-emerald-100 hover:text-white rounded-lg transition-colors"
            title="Shopping Cart"
          >
            <ShoppingCart className="w-6 h-6" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-400 text-emerald-950 font-black text-xs w-5 h-5 rounded-full flex items-center justify-center border-2 border-emerald-700 shadow-sm animate-pulse">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-white hover:bg-emerald-600/60 rounded-lg transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-emerald-800 border-t border-emerald-600 px-4 py-4 space-y-3 shadow-xl animate-in slide-in-from-top duration-200">
          {user && (
            <div className="pb-3 border-b border-emerald-700 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{user.name}</p>
                <p className="text-xs text-emerald-200">{user.email}</p>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-900 text-emerald-200 rounded border border-emerald-600">
                {user.role}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Link
              to="/products"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <ShoppingBasket className="w-4 h-4" />
              <span>Browse Catalog</span>
            </Link>

            {user && (
              <Link
                to="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <PackageCheck className="w-4 h-4" />
                <span>My Orders</span>
              </Link>
            )}

            {isStaffOrAdmin && (
              <Link
                to="/staff/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm font-bold bg-amber-400 text-emerald-950 rounded-lg hover:bg-amber-300 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Staff Control Center</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Portal</span>
              </Link>
            )}
          </div>

          <div className="pt-3 border-t border-emerald-700">
            {user ? (
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-900 hover:bg-emerald-950 text-red-300 text-sm font-bold rounded-lg transition-colors border border-emerald-700"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-emerald-900 hover:bg-emerald-950 text-white rounded-lg border border-emerald-600"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-emerald-950 rounded-lg"
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
