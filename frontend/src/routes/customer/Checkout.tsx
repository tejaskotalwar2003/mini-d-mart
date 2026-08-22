import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useCart } from '../../context/CartContext';
import type { FulfillmentType, OrderResponse, PickupSlot } from '../../types';
import {
  Store,
  Truck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  ShoppingBag,
} from 'lucide-react';

// FULFILLMENT SIMPLIFICATION DECISION:
// Full user address book management (Address model CRUD) is simplified here in the checkout UI.
// Delivery orders accept a free-text delivery address note field to capture destination instructions.

export const Checkout: React.FC = () => {
  const { cart, fetchCart } = useCart();
  const navigate = useNavigate();

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('PICKUP');
  const [pickupSlots, setPickupSlots] = useState<PickupSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string>('');

  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available pickup slots if Pickup is selected
  useEffect(() => {
    if (fulfillmentType === 'PICKUP') {
      const fetchSlots = async () => {
        setIsLoadingSlots(true);
        try {
          const res = await apiClient.get<PickupSlot[]>('/api/v1/pickup-slots');
          setPickupSlots(res.data);
          // Pre-select first available slot if available
          const firstAvailable = res.data.find((s) => s.slots_remaining > 0);
          if (firstAvailable) {
            setSelectedSlotId(firstAvailable.id);
          }
        } catch (err) {
          console.error('Failed to load pickup slots:', err);
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchSlots();
    }
  }, [fulfillmentType]);

  const items = cart?.items || [];
  const subtotal = Number(cart?.subtotal || 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-4">
        <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto" />
        <h2 className="text-2xl font-bold text-gray-800">Your Cart is Empty</h2>
        <p className="text-sm text-gray-500">Please add products to your cart before proceeding to checkout.</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Browse Products
        </Link>
      </div>
    );
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fulfillmentType === 'PICKUP' && !selectedSlotId) {
      setError('Please select a valid store pickup slot.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create order via POST /api/v1/checkout
      const checkoutPayload: { fulfillment_type: FulfillmentType; note?: string } = {
        fulfillment_type: fulfillmentType,
      };
      if (deliveryNote.trim()) {
        checkoutPayload.note = deliveryNote.trim();
      }

      const orderRes = await apiClient.post<OrderResponse>('/api/v1/checkout', checkoutPayload);
      const order = orderRes.data;

      // 2. If Pickup & slot selected, link slot via POST /api/v1/orders/{id}/pickup-slot
      if (fulfillmentType === 'PICKUP' && selectedSlotId) {
        await apiClient.post(`/api/v1/orders/${order.id}/pickup-slot`, {
          slot_id: selectedSlotId,
        });
      }

      // 3. Refresh cart state & redirect to order detail page
      await fetchCart();
      navigate(`/orders/${order.id}`, {
        state: { message: 'Order placed successfully! Thank you for shopping with Mini D-Mart.' },
      });
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError(
          err.response?.data?.detail ||
            'Stock conflict detected! One or more items in your cart exceed available store inventory.'
        );
      } else {
        setError(err.response?.data?.detail || 'Checkout failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group pickup slots by date
  const slotsByDate: Record<string, PickupSlot[]> = {};
  pickupSlots.forEach((slot) => {
    if (!slotsByDate[slot.date]) {
      slotsByDate[slot.date] = [];
    }
    slotsByDate[slot.date].push(slot);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Checkout</h1>
        <Link
          to="/cart"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cart
        </Link>
      </div>

      {/* Stock Conflict 409 Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-red-900">Checkout Failed</h4>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-red-200/60 flex justify-end">
            <Link
              to="/cart"
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors"
            >
              Return to Cart & Adjust Quantities
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Fulfillment Method & Pickup Slots / Delivery Note */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fulfillment Type Selection Tabs */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-900">1. Select Fulfillment Method</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFulfillmentType('PICKUP')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                  fulfillmentType === 'PICKUP'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 font-bold'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Store className="w-6 h-6 text-emerald-600" />
                <span className="text-sm">Store Pickup</span>
              </button>

              <button
                type="button"
                onClick={() => setFulfillmentType('DELIVERY')}
                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                  fulfillmentType === 'DELIVERY'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 font-bold'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Truck className="w-6 h-6 text-emerald-600" />
                <span className="text-sm">Home Delivery</span>
              </button>
            </div>
          </div>

          {/* Pickup Slot Selection */}
          {fulfillmentType === 'PICKUP' && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                2. Choose Store Pickup Slot
              </h2>

              {isLoadingSlots ? (
                <div className="py-8 text-center text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                  Loading available pickup slots...
                </div>
              ) : Object.keys(slotsByDate).length === 0 ? (
                <p className="text-sm text-gray-500 italic">No pickup slots available.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(slotsByDate).map(([dateStr, slots]) => (
                    <div key={dateStr} className="space-y-2">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        {new Date(dateStr).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {slots.map((slot) => {
                          const isFull = slot.slots_remaining <= 0;
                          const isSelected = selectedSlotId === slot.id;

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={isFull}
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                                isFull
                                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                  : 'bg-white border-gray-200 hover:border-emerald-400 text-gray-800'
                              }`}
                            >
                              <div className="flex items-center gap-1 text-xs font-bold">
                                <Clock className="w-3.5 h-3.5" />
                                {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                              </div>
                              <span className="text-[11px] font-medium opacity-90">
                                {isFull ? 'Full (0 left)' : `${slot.slots_remaining} slots left`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Delivery Note Input */}
          {fulfillmentType === 'DELIVERY' && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                2. Delivery Address & Instructions
              </h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Delivery Address / Special Instructions
                </label>
                <textarea
                  rows={3}
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Enter house/flat number, landmark, or gate code..."
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Order Summary & Action */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5 sticky top-20">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
            Order Breakdown
          </h2>

          <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-xs text-gray-700">
                <span className="truncate max-w-[12rem] font-medium">
                  {item.quantity} x {item.product_name}
                </span>
                <span className="font-bold">₹{Number(item.line_total).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax (5%)</span>
              <span className="font-semibold text-gray-900">₹{tax.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between text-base font-extrabold text-gray-900">
              <span>Total Payable</span>
              <span className="text-emerald-700 text-xl">₹{total.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing Order...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Place Order (₹{total.toFixed(2)})
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Checkout;
