import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ShoppingBag } from 'lucide-react';

export const Unauthorized: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="bg-red-50 p-4 rounded-full mb-4">
        <ShieldAlert className="w-16 h-16 text-red-500" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">403 - Access Denied</h1>
      <p className="text-gray-600 max-w-md mb-6">
        You don't have permission to view this page. Please contact an administrator if you believe this is an error.
      </p>
      <Link
        to="/products"
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors shadow-sm"
      >
        <ShoppingBag className="w-5 h-5" />
        Return to Catalog
      </Link>
    </div>
  );
};

export default Unauthorized;
