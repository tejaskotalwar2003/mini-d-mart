import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  ShoppingBasket,
  Heart,
  Store,
  ShoppingCart,
  PackageCheck,
  User,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user } = useAuth();
  const { itemCount } = useCart();
  const location = useLocation();

  const isStaffOrAdmin = user?.role === 'STAFF' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans antialiased pb-16 sm:pb-0">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Modern Desktop Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 border-t border-gray-800 mt-12 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <ShoppingBasket className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-white">Mini D-Mart</span>
            <span className="text-xs text-gray-500">© 2026 Mini D-Mart Inc. All rights reserved.</span>
          </div>
          <p className="flex items-center gap-1 text-xs text-gray-500">
            Built with <Heart className="w-3.5 h-3.5 text-red-500 fill-current" /> for fresh daily groceries.
          </p>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Navigation Bar (Blinkit Style) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <Link
          to="/products"
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
            isActive('/products') ? 'text-emerald-700' : 'text-gray-500 hover:text-emerald-600'
          }`}
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span>Shop</span>
        </Link>

        <Link
          to="/cart"
          className={`relative flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
            isActive('/cart') ? 'text-emerald-700' : 'text-gray-500 hover:text-emerald-600'
          }`}
        >
          <div className="relative">
            <ShoppingCart className="w-5 h-5 mb-0.5" />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-amber-400 text-emerald-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-white">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </div>
          <span>Cart</span>
        </Link>

        {user && (
          <Link
            to="/orders"
            className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
              isActive('/orders') ? 'text-emerald-700' : 'text-gray-500 hover:text-emerald-600'
            }`}
          >
            <PackageCheck className="w-5 h-5 mb-0.5" />
            <span>Orders</span>
          </Link>
        )}

        {isAdmin ? (
          <Link
            to="/admin/dashboard"
            className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
              isActive('/admin/dashboard') ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'
            }`}
          >
            <ShieldCheck className="w-5 h-5 mb-0.5" />
            <span>Admin</span>
          </Link>
        ) : isStaffOrAdmin ? (
          <Link
            to="/staff/dashboard"
            className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
              isActive('/staff/dashboard') ? 'text-amber-600' : 'text-gray-500 hover:text-amber-600'
            }`}
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Staff</span>
          </Link>
        ) : user ? (
          <div className="flex flex-col items-center py-1 px-3 text-[10px] font-bold text-gray-500">
            <User className="w-5 h-5 mb-0.5" />
            <span className="truncate max-w-[50px]">{user.name.split(' ')[0]}</span>
          </div>
        ) : (
          <Link
            to="/login"
            className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors ${
              isActive('/login') ? 'text-emerald-700' : 'text-gray-500 hover:text-emerald-600'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span>Sign In</span>
          </Link>
        )}
      </nav>
    </div>
  );
};

export default Layout;
