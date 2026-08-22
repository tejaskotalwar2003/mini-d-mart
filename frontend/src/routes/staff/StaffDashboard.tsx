import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import type { OrderResponse, ReturnRequestResponse } from '../../types';
import {
  LayoutDashboard,
  Package,
  Clock,
  CheckCircle2,
  RotateCcw,
  Store,
  ArrowRight,
  Loader2,
  AlertCircle,
  Truck,
} from 'lucide-react';

export const StaffDashboard: React.FC = () => {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [returns, setReturns] = useState<ReturnRequestResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [ordersRes, returnsRes] = await Promise.all([
          apiClient.get<OrderResponse[]>('/api/v1/staff/orders'),
          apiClient.get<ReturnRequestResponse[]>('/api/v1/staff/returns'),
        ]);

        setOrders(ordersRes.data);
        setReturns(returnsRes.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load staff dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Compute summary stat metrics
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;
  const inProgressOrders = orders.filter((o) =>
    ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(o.status)
  ).length;
  const completedOrders = orders.filter((o) =>
    ['COMPLETED', 'DELIVERED'].includes(o.status)
  ).length;
  const pendingReturns = returns.filter((r) => r.status === 'REQUESTED').length;
  const upcomingDeliveriesCount = orders.filter(
    (o) => o.fulfillment_type === 'DELIVERY' && ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(o.status)
  ).length;

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-16 px-4 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading staff dashboard...</p>
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
            <LayoutDashboard className="w-7 h-7 text-emerald-600" />
            Staff Control Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Store fulfillment overview, order processing queue, and return request approvals
          </p>
        </div>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Pending Action
            </span>
            <h3 className="text-3xl font-black text-amber-600 mt-1">{pendingOrders}</h3>
            <span className="text-[11px] text-gray-400 font-medium">Requires confirmation</span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              In Progress
            </span>
            <h3 className="text-3xl font-black text-blue-600 mt-1">{inProgressOrders}</h3>
            <span className="text-[11px] text-gray-400 font-medium">Preparing or ready</span>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <Package className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Pending Returns
            </span>
            <h3 className="text-3xl font-black text-purple-600 mt-1">{pendingReturns}</h3>
            <span className="text-[11px] text-gray-400 font-medium">Awaiting approval</span>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <RotateCcw className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Completed Orders
            </span>
            <h3 className="text-3xl font-black text-emerald-600 mt-1">{completedOrders}</h3>
            <span className="text-[11px] text-gray-400 font-medium">Picked up or delivered</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Quick Navigation Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          to="/staff/orders"
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-400 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl w-fit">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
              Order Fulfillment Queue
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Process customer orders through status transitions (Confirm, Prepare, Ready for Pickup, Complete).
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-xs font-extrabold text-emerald-600">
            Manage Orders ({orders.length})
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/staff/pickups"
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-400 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl w-fit">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
              Upcoming Store Pickups
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              View orders scheduled for store pickup grouped by date & slot, and advance pickup statuses.
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-xs font-extrabold text-blue-600">
            View Pickups Schedule
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/staff/deliveries"
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-400 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl w-fit">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
              Home Deliveries Dispatch
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              View and manage active home deliveries, dispatch drivers, and record delivery completions.
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-xs font-extrabold text-emerald-600">
            Dispatch Queue ({upcomingDeliveriesCount} Active)
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          to="/staff/returns"
          className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md hover:border-emerald-400 transition-all group flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl w-fit">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
              Returns & Exchanges Queue
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Review customer return requests, approve returns (restoring stock), or handle product exchanges.
            </p>
          </div>
          <div className="pt-6 flex items-center gap-2 text-xs font-extrabold text-purple-600">
            Review Requests ({pendingReturns} pending)
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
};

export default StaffDashboard;
