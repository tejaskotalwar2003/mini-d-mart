import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import type { OrderResponse, OrderStatus } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import {
  Package,
  Clock,
  Store,
  Truck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  Eye,
  ArrowRight,
  Filter,
} from 'lucide-react';

const ALLOWED_TRANSITIONS: Record<string, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  COMPLETED: [],
  DELIVERED: [],
  CANCELLED: [],
  RETURN_REQUESTED: [],
  RETURN_APPROVED: [],
  RETURN_REJECTED: [],
};

export const OrderQueue: React.FC = () => {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Transition Modal State
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);
  const [targetStatus, setTargetStatus] = useState<OrderStatus | ''>('');
  const [transitionNote, setTransitionNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = statusFilter
        ? `/api/v1/staff/orders?status=${statusFilter}`
        : '/api/v1/staff/orders';
      const res = await apiClient.get<OrderResponse[]>(url);
      setOrders(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load order queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleOpenTransitionModal = (order: OrderResponse) => {
    setSelectedOrder(order);
    const validNext = ALLOWED_TRANSITIONS[order.status] || [];
    setTargetStatus(validNext.length > 0 ? validNext[0] : '');
    setTransitionNote('');
    setModalError(null);
  };

  const handleAdvanceStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !targetStatus) return;

    setIsSubmitting(true);
    setModalError(null);
    try {
      await apiClient.patch<OrderResponse>(`/api/v1/orders/${selectedOrder.id}/status`, {
        to_status: targetStatus,
        note: transitionNote.trim() || undefined,
      });

      setSelectedOrder(null);
      await fetchOrders();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setModalError(
          err.response?.data?.detail ||
            'Status transition conflict! The order status was updated by another user.'
        );
      } else {
        setModalError(err.response?.data?.detail || 'Failed to update order status.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusTabOptions = [
    { label: 'All Orders', value: '' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Confirmed', value: 'CONFIRMED' },
    { label: 'Preparing', value: 'PREPARING' },
    { label: 'Ready for Pickup', value: 'READY_FOR_PICKUP' },
    { label: 'Out for Delivery', value: 'OUT_FOR_DELIVERY' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <Package className="w-7 h-7 text-emerald-600" />
            Order Processing Queue
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Review incoming orders and advance fulfillment statuses
          </p>
        </div>
        <Link
          to="/staff/dashboard"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Status Filter Scrollable Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-100 no-scrollbar">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0 ml-1" />
        {statusTabOptions.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="py-16 text-center text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-600 mb-2" />
          Loading order queue...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center text-red-800 space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-bold">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center space-y-3">
          <Clock className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-bold text-gray-800">No Orders Found</h3>
          <p className="text-xs text-gray-500">No orders match the selected status filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Order #</th>
                  <th className="p-4">Placed Date</th>
                  <th className="p-4">Fulfillment</th>
                  <th className="p-4">Items</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const validNextStatuses = ALLOWED_TRANSITIONS[order.status] || [];
                  const canAdvance = validNextStatuses.length > 0;

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 font-extrabold text-gray-900">{order.order_number}</td>
                      <td className="p-4 text-gray-500 font-medium whitespace-nowrap">
                        {new Date(order.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 font-bold text-gray-800 uppercase">
                          {order.fulfillment_type === 'PICKUP' ? (
                            <Store className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Truck className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          {order.fulfillment_type}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-700">
                        <span className="font-bold text-gray-900">
                          {order.items && order.items.length > 0
                            ? `${order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)} items`
                            : '0 items'}
                        </span>
                        {order.items && order.items.length > 1 && (
                          <span className="block text-[10px] text-gray-500 font-normal">
                            ({order.items.length} unique products)
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-extrabold text-gray-900">
                        ₹{Number(order.total).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <Link
                          to={`/orders/${order.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>

                        {canAdvance && (
                          <button
                            onClick={() => handleOpenTransitionModal(order)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors"
                          >
                            Advance Status
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advance Status Transition Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl relative">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Advance Order Status
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Order: <span className="font-bold text-gray-900">{selectedOrder.order_number}</span>{' '}
                (Current: <StatusBadge status={selectedOrder.status} />)
              </p>
            </div>

            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAdvanceStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Target Next Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as OrderStatus)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white font-bold"
                >
                  {(ALLOWED_TRANSITIONS[selectedOrder.status] || []).map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Transition Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                  placeholder="e.g. Items packed in bag 3, verified fresh..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !targetStatus}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Confirm Status Update'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderQueue;
