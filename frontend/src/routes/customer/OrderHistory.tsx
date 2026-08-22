import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import type { OrderResponse, OrderStatus } from '../../types';
import {
  PackageCheck,
  ChevronRight,
  Store,
  Truck,
  Calendar,
  ShoppingBag,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const OrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<OrderResponse[]>('/api/v1/orders');
        setOrders(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load order history.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const getStatusBadgeClass = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CONFIRMED':
      case 'PREPARING':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'READY_FOR_PICKUP':
      case 'OUT_FOR_DELIVERY':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'COMPLETED':
      case 'DELIVERED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'RETURN_REQUESTED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'RETURN_APPROVED':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'RETURN_REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading your orders...</p>
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

  if (orders.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="bg-emerald-50 p-6 rounded-full inline-block text-emerald-600 mb-2">
          <PackageCheck className="w-16 h-16" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900">No Orders Placed Yet</h2>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          You haven't placed any grocery orders with Mini D-Mart yet. Start shopping now!
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95"
        >
          <ShoppingBag className="w-4 h-4" />
          Browse Grocery Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
          <PackageCheck className="w-7 h-7 text-emerald-600" />
          My Orders ({orders.length})
        </h1>
        <Link
          to="/products"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />
          Shop More
        </Link>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            onClick={() => navigate(`/orders/${order.id}`)}
            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group"
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-extrabold text-gray-900 text-base group-hover:text-emerald-600 transition-colors">
                  {order.order_number}
                </span>

                <span
                  className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${getStatusBadgeClass(
                    order.status
                  )}`}
                >
                  {order.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {new Date(order.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>

                <span className="flex items-center gap-1 uppercase font-bold text-gray-700">
                  {order.fulfillment_type === 'PICKUP' ? (
                    <Store className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  {order.fulfillment_type}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100">
              <div className="text-left sm:text-right">
                <span className="text-xs text-gray-500 block font-medium">
                  {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                </span>
                <span className="text-lg font-black text-gray-900">
                  ₹{Number(order.total).toFixed(2)}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderHistory;
