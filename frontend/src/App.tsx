import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <header className="bg-emerald-700 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/products" className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <span className="bg-white text-emerald-700 px-2 py-0.5 rounded font-extrabold text-xl">D</span>
            Mini D-Mart
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link to="/products" className="hover:text-emerald-200 transition">Products</Link>
            <Link to="/cart" className="hover:text-emerald-200 transition">Cart</Link>
            <Link to="/checkout" className="hover:text-emerald-200 transition">Checkout</Link>
            <Link to="/orders" className="hover:text-emerald-200 transition">Orders</Link>
            <Link to="/staff/dashboard" className="hover:text-emerald-200 transition">Staff Portal</Link>
            <Link to="/admin/dashboard" className="hover:text-emerald-200 transition">Admin</Link>
            <div className="pl-4 border-l border-emerald-600 flex gap-3">
              <Link to="/login" className="px-3 py-1 bg-emerald-800 hover:bg-emerald-900 rounded transition text-xs">Login</Link>
              <Link to="/register" className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 rounded transition text-xs font-semibold">Register</Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {children}
      </main>

      <footer className="bg-slate-800 text-slate-400 py-6 text-center text-sm border-t border-slate-700">
        <p>© 2026 Mini D-Mart Grocery Store Application</p>
      </footer>
    </div>
  );
};

const PlaceholderCard: React.FC<{ title: string; subtitle: string; path: string }> = ({ title, subtitle, path }) => (
  <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-2xl mx-auto my-8 text-center">
    <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 font-mono text-xs font-bold rounded-full mb-4">
      ROUTE: {path}
    </div>
    <h1 className="text-3xl font-bold text-slate-800 mb-2">{title}</h1>
    <p className="text-slate-600 text-base">{subtitle}</p>
  </div>
);

const LoginPage = () => <PlaceholderCard title="Login" subtitle="Customer & Staff Login Portal" path="/login" />;
const RegisterPage = () => <PlaceholderCard title="Register" subtitle="Create a new customer account" path="/register" />;
const ProductsPage = () => <PlaceholderCard title="Products Catalog" subtitle="Browse fresh groceries, vegetables, and essentials" path="/products" />;
const CartPage = () => <PlaceholderCard title="Shopping Cart" subtitle="View and manage your selected grocery items" path="/cart" />;
const CheckoutPage = () => <PlaceholderCard title="Checkout" subtitle="Select pickup time slot or delivery address and place order" path="/checkout" />;
const OrdersPage = () => <PlaceholderCard title="My Orders" subtitle="Track order status and view purchase history" path="/orders" />;
const StaffDashboardPage = () => <PlaceholderCard title="Staff Dashboard" subtitle="Order processing, pickup verification, and status updates" path="/staff/dashboard" />;
const AdminDashboardPage = () => <PlaceholderCard title="Admin Dashboard" subtitle="Inventory management, pickup slot capacity, and audit logs" path="/admin/dashboard" />;

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/staff/dashboard" element={<StaffDashboardPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="*" element={<Navigate to="/products" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
