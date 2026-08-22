import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import type { OrderResponse, OrderStatus } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import {
  Store,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
  ArrowRight,
  Eye,
} from 'lucide-react';

const PICKUP_TRANSITIONS: Record<string, OrderStatus[]> = {
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED'],
};

export const UpcomingPickups: React.FC = () => {
  const [pickups, setPickups] = useState<OrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Transition Modal State
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);
  const [targetStatus, setTargetStatus] = useState<OrderStatus | ''>('');
  const [transitionNote, setTransitionNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchPickups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<OrderResponse[]>('/api/v1/staff/orders/upcoming-pickups');
      setPickups(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load upcoming pickups.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPickups();
  }, []);

  const handleOpenModal = (order: OrderResponse) => {
    setSelectedOrder(order);
    const validNext = PICKUP_TRANSITIONS[order.status] || [];
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
      await fetchPickups();
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Failed to update pickup status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group pickup orders by date
  const groupedPickups: Record<string, OrderResponse[]> = {};
  pickups.forEach((order) => {
    const dateKey = order.pickup_slot?.date || 'Unscheduled';
    if (!groupedPickups[dateKey]) {
      groupedPickups[dateKey] = [];
    }
    groupedPickups[dateKey].push(order);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <Store className="w-7 h-7 text-emerald-600" />
            Upcoming Store Pickups
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Store pickup schedule sorted by date and time slot
          </p>
        </div>
        <Link
          to="/staff/dashboard"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-600 mb-2" />
          Loading pickup schedule...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center text-red-800 space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-bold">{error}</p>
          <button
            onClick={fetchPickups}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : pickups.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center space-y-3">
          <Store className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-bold text-gray-800">No Upcoming Pickups</h3>
          <p className="text-xs text-gray-500">
            There are currently no active store pickup orders waiting in queue.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedPickups).map(([dateStr, dateOrders]) => (
            <div key={dateStr} className="space-y-3">
              <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2 bg-gray-100/70 p-2.5 rounded-lg border border-gray-200/60">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Pickup Date: {dateStr} ({dateOrders.length}{' '}
                {dateOrders.length === 1 ? 'order' : 'orders'})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateOrders.map((order) => {
                  const validNext = PICKUP_TRANSITIONS[order.status] || [];

                  return (
                    <div
                      key={order.id}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-gray-900 text-base">
                            {order.order_number}
                          </span>
                          <StatusBadge status={order.status} />
                        </div>

                        {order.pickup_slot && (
                          <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-emerald-600" />
                            Slot: {order.pickup_slot.start_time.slice(0, 5)} -{' '}
                            {order.pickup_slot.end_time.slice(0, 5)}
                          </div>
                        )}

                        <div className="flex justify-between text-xs text-gray-500 font-medium">
                          <span>{order.items.length} items</span>
                          <span className="font-extrabold text-gray-900">
                            ₹{Number(order.total).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                        <Link
                          to={`/orders/${order.id}`}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>

                        {validNext.length > 0 && (
                          <button
                            onClick={() => handleOpenModal(order)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1"
                          >
                            Advance
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Advance Transition Modal */}
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
                Advance Pickup Status
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
                  {(PICKUP_TRANSITIONS[selectedOrder.status] || []).map((st) => (
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
                  placeholder="e.g. Verified customer ID & handed over grocery bag..."
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

export default UpcomingPickups;
