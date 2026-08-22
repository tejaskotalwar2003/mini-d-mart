import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { ShoppingBasket, Heart } from 'lucide-react';

export const Layout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans antialiased">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
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
    </div>
  );
};

export default Layout;
