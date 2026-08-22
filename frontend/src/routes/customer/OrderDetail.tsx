import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import apiClient from '../../api/client';
import type {
  OrderResponse,
  OrderItem,
  Product,
  ReturnType,
  ReturnRequestResponse,
} from '../../types';
import {
  ArrowLeft,
  Package,
  PackageCheck,
  Calendar,
  Clock,
  Store,
  Truck,
  RotateCcw,
  XCircle,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const successMsg = (location.state as { message?: string })?.message;

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cancellation state
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  // Return/Exchange Modal State
  const [selectedItem, setSelectedItem] = useState<OrderItem | null>(null);
  const [returnType, setReturnType] = useState<ReturnType>('RETURN');
  const [requestedQty, setRequestedQty] = useState<number>(1);
  const [returnReason, setReturnReason] = useState<string>('');
  const [exchangeProductId, setExchangeProductId] = useState<string>('');
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState<boolean>(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);

  const fetchOrderDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<OrderResponse>(`/api/v1/orders/${id}`);
      setOrder(res.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Order not found or access denied.');
      } else {
        setError(err.response?.data?.detail || 'Failed to load order details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchOrderDetail();
    }
  }, [id]);

  // Load products when exchange option is selected
  useEffect(() => {
    if (returnType === 'EXCHANGE' && availableProducts.length === 0) {
      const fetchProducts = async () => {
        try {
          const res = await apiClient.get<{ items: Product[] }>('/api/v1/products?page_size=50');
          setAvailableProducts(res.data.items);
          if (res.data.items.length > 0) {
            setExchangeProductId(res.data.items[0].id);
          }
        } catch (err) {
          console.error('Failed to load exchange products:', err);
        }
      };
      fetchProducts();
    }
  }, [returnType]);

  const handleCancelOrder = async () => {
    if (!order) return;
    setIsCancelling(true);
    setError(null);
    try {
      await apiClient.post(`/api/v1/orders/${order.id}/cancel`);
      setShowCancelModal(false);
      await fetchOrderDetail();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to cancel order.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenReturnModal = (item: OrderItem) => {
    setSelectedItem(item);
    setReturnType('RETURN');
    setRequestedQty(1);
    setReturnReason('');
    setReturnError(null);
    setReturnSuccess(null);
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedItem) return;

    if (!returnReason.trim()) {
      setReturnError('Please provide a reason for the return / exchange request.');
      return;
    }

    setIsSubmittingReturn(true);
    setReturnError(null);
    try {
      const payload: {
        order_item_id: string;
        type: ReturnType;
        requested_qty: number;
        reason: string;
        exchange_for_product_id?: string;
      } = {
        order_item_id: selectedItem.id,
        type: returnType,
        requested_qty: requestedQty,
        reason: returnReason.trim(),
      };

      if (returnType === 'EXCHANGE' && exchangeProductId) {
        payload.exchange_for_product_id = exchangeProductId;
      }

      await apiClient.post<ReturnRequestResponse>(`/api/v1/orders/${order.id}/returns`, payload);

      setReturnSuccess('Return request submitted successfully!');
      setTimeout(() => {
        setSelectedItem(null);
        fetchOrderDetail();
      }, 1500);
    } catch (err: any) {
      // Surface exact backend eligibility rejection reason
      setReturnError(
        err.response?.data?.detail || 'Failed to submit return request. Please try again.'
      );
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-2xl font-bold text-gray-900">{error || 'Order not found.'}</h2>
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Orders
        </Link>
      </div>
    );
  }

  const isCancellable = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const isReturnable = order.status === 'COMPLETED' || order.status === 'DELIVERED';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Success Toast / Banner */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <Link
          to="/orders"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </Link>
        <span className="text-xs text-gray-400 font-mono">ID: {order.id}</span>
      </div>

      {/* Header Info Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {order.order_number}
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Placed on {new Date(order.created_at).toLocaleString()}
          </p>
        </div>

        {/* Action Buttons */}
        {isCancellable && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
          >
            <XCircle className="w-4 h-4" />
            Cancel Order
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Items & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-600" />
              Purchased Items ({order.items.length})
            </h2>

            <div className="space-y-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50"
                >
                  <div className="flex items-center gap-3">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        className="w-14 h-14 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-gray-900 text-sm">{item.product_name}</h3>
                      <p className="text-xs text-gray-500 font-medium">
                        {item.quantity} x ₹{Number(item.unit_price ?? item.unit_price_at_order ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="font-extrabold text-gray-900 text-base">
                      ₹{Number(item.line_total).toFixed(2)}
                    </span>

                    {/* Return/Exchange Action (Only if COMPLETED or DELIVERED) */}
                    {isReturnable && (
                      <button
                        onClick={() => handleOpenReturnModal(item)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Request Return / Exchange
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Timeline */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              Status History Timeline
            </h2>

            {order.order_status_history && order.order_status_history.length > 0 ? (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-200">
                {order.order_status_history.map((log) => (
                  <div key={log.id} className="relative flex items-start gap-3">
                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white shadow-sm"></div>
                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 w-full space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-gray-900 uppercase">
                          {log.from_status ? `${log.from_status} ➔ ` : ''}
                          <span className="text-emerald-700 font-extrabold">{log.to_status}</span>
                        </span>
                        <span className="text-gray-400 font-medium">
                          {new Date(log.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {log.note && <p className="text-xs text-gray-600">{log.note}</p>}
                      {log.changed_by_name && (
                        <span className="text-[10px] text-gray-400 italic block">
                          Updated by: {log.changed_by_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No status updates logged yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Order Payment Breakdown & Fulfillment Info */}
        <div className="space-y-6">
          {/* Fulfillment Details Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2.5 flex items-center gap-2">
              {order.fulfillment_type === 'PICKUP' ? (
                <Store className="w-5 h-5 text-emerald-600" />
              ) : (
                <Truck className="w-5 h-5 text-emerald-600" />
              )}
              Fulfillment Method ({order.fulfillment_type})
            </h2>

            {order.fulfillment_type === 'PICKUP' ? (
              <div className="bg-emerald-50/60 border border-emerald-100 p-3.5 rounded-xl text-xs space-y-1">
                <span className="font-bold text-emerald-900 block">Store Pickup Order:</span>
                {order.pickup_slot ? (
                  <>
                    <p className="text-emerald-800 font-medium">
                      Date: {order.pickup_slot.date}
                    </p>
                    <p className="text-emerald-800 font-medium">
                      Time: {order.pickup_slot.start_time.slice(0, 5)} - {order.pickup_slot.end_time.slice(0, 5)}
                    </p>
                  </>
                ) : (
                  <p className="text-emerald-800 font-medium italic">
                    Store Pickup Slot Reserved {order.pickup_slot_id ? `(${order.pickup_slot_id.slice(0, 8)}...)` : ''}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl text-xs space-y-1">
                <span className="font-bold text-gray-800 block">Delivery Note:</span>
                <p className="text-gray-600 italic">
                  {order.delivery_note || 'Standard Home Delivery'}
                </p>
              </div>
            )}
          </div>

          {/* Payment Summary Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3 text-sm">
            <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2.5">
              Payment Summary
            </h2>
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">
                ₹{Number(order.subtotal).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax (5%)</span>
              <span className="font-semibold text-gray-900">
                ₹{Number(order.tax).toFixed(2)}
              </span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between text-base font-extrabold text-gray-900">
              <span>Total Amount Paid</span>
              <span className="text-emerald-700 text-xl">
                ₹{Number(order.total).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Order Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900">Cancel Order?</h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel order <span className="font-bold text-gray-900">{order.order_number}</span>? Inventory stock will be automatically released back to the store.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl shadow-sm flex items-center gap-2"
              >
                {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return / Exchange Request Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <RotateCcw className="w-6 h-6 text-emerald-600" />
                Request Return / Exchange
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Item: <span className="font-bold text-gray-800">{selectedItem.product_name}</span>
              </p>
            </div>

            {returnError && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{returnError}</span>
              </div>
            )}

            {returnSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{returnSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              {/* Type Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Request Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all text-xs font-bold ${
                      returnType === 'RETURN'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="returnType"
                      value="RETURN"
                      checked={returnType === 'RETURN'}
                      onChange={() => setReturnType('RETURN')}
                      className="hidden"
                    />
                    Return Item for Refund
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all text-xs font-bold ${
                      returnType === 'EXCHANGE'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="returnType"
                      value="EXCHANGE"
                      checked={returnType === 'EXCHANGE'}
                      onChange={() => setReturnType('EXCHANGE')}
                      className="hidden"
                    />
                    Exchange for Product
                  </label>
                </div>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Quantity (Purchased: {selectedItem.quantity})
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedItem.quantity}
                  value={requestedQty}
                  onChange={(e) => setRequestedQty(Math.min(selectedItem.quantity, Number(e.target.value)))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Exchange Product Selection */}
              {returnType === 'EXCHANGE' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Select Replacement Product
                  </label>
                  <select
                    value={exchangeProductId}
                    onChange={(e) => setExchangeProductId(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{Number(p.price).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Reason for Request *
                </label>
                <textarea
                  rows={3}
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Damaged packaging, wrong item, expired freshness..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  disabled={isSubmittingReturn}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm flex items-center gap-2"
                >
                  {isSubmittingReturn ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
