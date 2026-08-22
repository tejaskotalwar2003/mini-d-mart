import React from 'react';
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
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="bg-emerald-700 text-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/products" className="flex items-center gap-2.5 group">
          <div className="bg-white text-emerald-700 p-2 rounded-xl group-hover:scale-105 transition-transform shadow-sm">
            <ShoppingBasket className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight">Mini D-Mart</span>
            <span className="block text-[10px] text-emerald-200 font-medium uppercase tracking-wider -mt-1">
              Fresh Groceries
            </span>
          </div>
        </Link>

        {/* Right Section: Navigation Links & User Menu */}
        <div className="flex items-center gap-3">
          {/* Admin Portal Link (if ADMIN) */}
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

          {/* Staff Portal Link (if STAFF or ADMIN) */}
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

          {/* My Orders Link (if logged in) */}
          {user && (
            <Link
              to="/orders"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-100 hover:text-white hover:bg-emerald-600/50 px-3 py-1.5 rounded-lg transition-colors"
              title="My Orders"
            >
              <PackageCheck className="w-4 h-4" />
              <span className="hidden sm:inline">My Orders</span>
            </Link>
          )}

          {/* Cart Icon Link with Reactive Badge */}
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
              <div className="hidden sm:block text-right">
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
                <span className="hidden sm:inline">Logout</span>
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
      </div>
    </header>
  );
};

export default Navbar;
