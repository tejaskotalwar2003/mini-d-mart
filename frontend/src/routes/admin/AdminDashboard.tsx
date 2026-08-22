import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import type { ProductListResponse, LowStockItemResponse, AuditLogResponse, ReturnRequestResponse } from '../../types';
import {
  ShieldCheck,
  Package,
  AlertTriangle,
  RotateCcw,
  History,
  Store,
  ArrowRight,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [pendingReturnsCount, setPendingReturnsCount] = useState<number>(0);
  const [recentAuditCount, setRecentAuditCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdminDashboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [productsRes, lowStockRes, returnsRes, auditRes] = await Promise.all([
          apiClient.get<ProductListResponse>('/api/v1/admin/products?page_size=1'),
          apiClient.get<LowStockItemResponse[]>('/api/v1/admin/inventory/low-stock'),
          apiClient.get<ReturnRequestResponse[]>('/api/v1/staff/returns?status=REQUESTED'),
          apiClient.get<AuditLogResponse[]>('/api/v1/admin/audit-logs?page_size=50'),
        ]);

        setTotalProducts(productsRes.data.total);
        setLowStockCount(lowStockRes.data.length);
        setPendingReturnsCount(returnsRes.data.length);

        // Count audit logs within the last 24h
        const now = new Date().getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const recentLogs = auditRes.data.filter((log) => {
          const logTime = new Date(log.created_at).getTime();
          return now - logTime <= oneDayMs;
        });
        setRecentAuditCount(recentLogs.length);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load admin dashboard overview.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-16 px-4 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading admin overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-xl font-bold text-gray-900">{error}</h3>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
            Admin System Portal
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            System administration, catalog setup, inventory corrections, and audit logging
          </p>
        </div>
      </div>

      {/* Low-Stock Alert Banner */}
      {lowStockCount > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Critical Inventory Warning: {lowStockCount} {lowStockCount === 1 ? 'Item is' : 'Items are'} Low on Stock!
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Certain active products have quantities at or below their reorder threshold levels.
              </p>
            </div>
          </div>
          <Link
            to="/admin/inventory"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            Review Stock
          </Link>
        </div>
      )}

      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Total Products
            </span>
            <h3 className="text-3xl font-black text-gray-900 mt-1">{totalProducts}</h3>
            <span className="text-[11px] text-gray-400 font-medium">Active & inactive items</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Package className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Low-Stock Alerts
            </span>
            <h3 className="text-3xl font-black text-amber-600 mt-1">{lowStockCount}</h3>
            <span className="text-[11px] text-gray-400 font-medium">Below reorder threshold</span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <AlertTriangle className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Pending Returns
            </span>
            <h3 className="text-3xl font-black text-purple-600 mt-1">{pendingReturnsCount}</h3>
            <span className="text-[11px] text-gray-400 font-medium">Awaiting staff resolution</span>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <RotateCcw className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Audit Logs (24h)
            </span>
            <h3 className="text-3xl font-black text-blue-600 mt-1">{recentAuditCount}</h3>
            <span className="text-[11px] text-gray-400 font-medium">System audit entries</span>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <History className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Quick Access Action Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          to="/staff/orders"
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-400 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl w-fit flex items-center gap-2">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
              Customer Order Queue
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Track live customer orders, update order status (Confirm, Prepare, Dispatch, Deliver), and view pickup/delivery slots.
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-xs font-extrabold text-emerald-600">
            View Live Orders
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/admin/products"
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-400 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl w-fit flex items-center gap-2">
              <Package className="w-6 h-6" />
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
              Product & Category Setup
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Add new products, edit pricing & SKUs, deactivate obsolete items, and manage grocery categories.
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-xs font-extrabold text-emerald-600">
            Manage Catalog ({totalProducts} Products)
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/admin/inventory"
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-400 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl w-fit">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
              Inventory & Stock Alerts
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Inspect store-level stock levels, adjust available quantities with reason logs, and review low-stock items.
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-xs font-extrabold text-amber-600">
            View Inventory ({lowStockCount} Low Stock)
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/admin/audit-logs"
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-400 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl w-fit">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
              System Audit Logs
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Trace all administrative actions, product creations, order status changes, return approvals, and stock adjustments.
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-xs font-extrabold text-blue-600">
            Inspect Audit Logs
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
