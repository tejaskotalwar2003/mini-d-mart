import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './routes/auth/Login';
import Register from './routes/auth/Register';
import ProductList from './routes/customer/ProductList';
import ProductDetail from './routes/customer/ProductDetail';
import Cart from './routes/customer/Cart';
import Checkout from './routes/customer/Checkout';
import OrderHistory from './routes/customer/OrderHistory';
import OrderDetail from './routes/customer/OrderDetail';
import Profile from './routes/customer/Profile';
import StaffDashboard from './routes/staff/StaffDashboard';
import OrderQueue from './routes/staff/OrderQueue';
import UpcomingPickups from './routes/staff/UpcomingPickups';
import UpcomingDeliveries from './routes/staff/UpcomingDeliveries';
import ReturnsQueue from './routes/staff/ReturnsQueue';
import AdminDashboard from './routes/admin/AdminDashboard';
import ProductManagement from './routes/admin/ProductManagement';
import InventoryManagement from './routes/admin/InventoryManagement';
import AuditLogViewer from './routes/admin/AuditLogViewer';
import Unauthorized from './routes/Unauthorized';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <Routes>
            <Route element={<Layout />}>
              {/* Public Catalog Routes */}
              <Route path="/" element={<Navigate to="/products" replace />} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/products/:id" element={<ProductDetail />} />

              {/* Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* Customer Protected Routes */}
              <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'STAFF', 'ADMIN']} />}>
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/orders" element={<OrderHistory />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/profile" element={<Profile />} />
              </Route>

              {/* Staff / Admin Protected Routes */}
              <Route element={<ProtectedRoute allowedRoles={['STAFF', 'ADMIN']} />}>
                <Route path="/staff/dashboard" element={<StaffDashboard />} />
                <Route path="/staff/orders" element={<OrderQueue />} />
                <Route path="/staff/pickups" element={<UpcomingPickups />} />
                <Route path="/staff/deliveries" element={<UpcomingDeliveries />} />
                <Route path="/staff/returns" element={<ReturnsQueue />} />
              </Route>

              {/* Admin-Only Protected Routes */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/products" element={<ProductManagement />} />
                <Route path="/admin/inventory" element={<InventoryManagement />} />
                <Route path="/admin/audit-logs" element={<AuditLogViewer />} />
              </Route>

              {/* Fallback Catch-all Route */}
              <Route path="*" element={<Navigate to="/products" replace />} />
            </Route>
          </Routes>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
