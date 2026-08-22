import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
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
  Tag,
  Sparkles,
  X,
  MapPin,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface Coupon {
  code: string;
  title: string;
  description: string;
  minOrder: number;
  discountType: 'FLAT' | 'PERCENT' | 'FREE_DELIVERY';
  discountValue: number;
  maxDiscount?: number;
  badge: string;
}

const AVAILABLE_COUPONS: Coupon[] = [
  {
    code: 'RAKHI50',
    title: '🪢 Rakhi Festive Special',
    description: 'Flat ₹50 OFF on orders above ₹199',
    minOrder: 199,
    discountType: 'FLAT',
    discountValue: 50,
    badge: 'FESTIVE SPECIAL',
  },
  {
    code: 'FREESHIP',
    title: '⚡ Free Express Delivery',
    description: '100% Free delivery on orders above ₹149',
    minOrder: 149,
    discountType: 'FREE_DELIVERY',
    discountValue: 40,
    badge: 'POPULAR',
  },
  {
    code: 'WELCOME100',
    title: '🎉 Welcome Discount',
    description: 'Flat ₹100 OFF on orders above ₹499',
    minOrder: 499,
    discountType: 'FLAT',
    discountValue: 100,
    badge: 'MEGA SAVER',
  },
  {
    code: 'FESTIVE20',
    title: '🍬 20% Festive Treat',
    description: '20% OFF up to ₹150 on orders above ₹299',
    minOrder: 299,
    discountType: 'PERCENT',
    discountValue: 20,
    maxDiscount: 150,
    badge: '20% OFF',
  },
];

export const Checkout: React.FC = () => {
  const { user } = useAuth();
  const { cart, fetchCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('DELIVERY');
  const [pickupSlots, setPickupSlots] = useState<PickupSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string>('');

  // Coupon states
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Autofill delivery address from user profile
  useEffect(() => {
    if (user?.addresses && user.addresses.length > 0) {
      const defaultAddr = user.addresses[0];
      const formatted = [
        defaultAddr.line1,
        defaultAddr.line2,
        defaultAddr.city,
        defaultAddr.pincode,
      ]
        .filter(Boolean)
        .join(', ');
      setDeliveryNote(formatted);
    }
  }, [user]);

  // Fetch available pickup slots if Pickup is selected
  useEffect(() => {
    if (fulfillmentType === 'PICKUP') {
      const fetchSlots = async () => {
        setIsLoadingSlots(true);
        try {
          const res = await apiClient.get<PickupSlot[]>('/api/v1/pickup-slots');
          setPickupSlots(res.data);
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

  // Calculate discount
  let itemDiscount = 0;
  let isFreeDelivery = fulfillmentType === 'PICKUP';
  let deliveryFee = fulfillmentType === 'DELIVERY' ? 40 : 0;

  if (appliedCoupon) {
    if (appliedCoupon.discountType === 'FLAT') {
      itemDiscount = Math.min(appliedCoupon.discountValue, subtotal);
    } else if (appliedCoupon.discountType === 'PERCENT') {
      const calculated = (subtotal * appliedCoupon.discountValue) / 100;
      itemDiscount = Math.min(calculated, appliedCoupon.maxDiscount || 9999);
    } else if (appliedCoupon.discountType === 'FREE_DELIVERY') {
      isFreeDelivery = true;
      deliveryFee = 0;
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - itemDiscount);
  const tax = discountedSubtotal * 0.05;
  const total = discountedSubtotal + tax + deliveryFee;
  const totalSavings = itemDiscount + (isFreeDelivery && fulfillmentType === 'DELIVERY' ? 40 : 0);

  // Apply Coupon handler
  const handleApplyCoupon = (coupon: Coupon) => {
    setCouponError(null);
    if (subtotal < coupon.minOrder) {
      setCouponError(
        `Order subtotal must be at least ₹${coupon.minOrder} to use coupon "${coupon.code}". (Current: ₹${subtotal.toFixed(0)})`
      );
      showToast(`Min order ₹${coupon.minOrder} required for ${coupon.code}`, { type: 'error' });
      return;
    }

    setAppliedCoupon(coupon);
    setCouponInput(coupon.code);
    showToast(`Coupon ${coupon.code} applied!`, {
      type: 'success',
      subMessage: `Saved ₹${(coupon.discountType === 'FREE_DELIVERY' ? 40 : coupon.discountValue).toFixed(0)} on this order`,
    });
  };

  // Manual Coupon input apply
  const handleManualApply = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    const found = AVAILABLE_COUPONS.find((c) => c.code.toUpperCase() === code);
    if (!found) {
      setCouponError(`Invalid coupon code "${code}". Try RAKHI50 or FREESHIP.`);
      showToast(`Invalid coupon code "${code}"`, { type: 'error' });
      return;
    }

    handleApplyCoupon(found);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
    showToast('Coupon removed', { type: 'info' });
  };

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

    if (fulfillmentType === 'DELIVERY' && !deliveryNote.trim()) {
      setError('Please provide a delivery address or instructions.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create order note including applied coupon metadata
      let note = deliveryNote.trim();
      if (appliedCoupon) {
        note = note ? `${note} | [Coupon Applied: ${appliedCoupon.code}]` : `[Coupon Applied: ${appliedCoupon.code}]`;
      }

      const checkoutPayload: { fulfillment_type: FulfillmentType; note?: string } = {
        fulfillment_type: fulfillmentType,
        note: note || undefined,
      };

      const orderRes = await apiClient.post<OrderResponse>('/api/v1/checkout', checkoutPayload);
      const order = orderRes.data;

      // Link slot if Pickup
      if (fulfillmentType === 'PICKUP' && selectedSlotId) {
        await apiClient.post(`/api/v1/orders/${order.id}/pickup-slot`, {
          slot_id: selectedSlotId,
        });
      }

      // Refresh cart & redirect
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
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-2.5">
            <span>Checkout</span>
            <span className="text-xs font-black uppercase px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
              ⚡ 10-Min Delivery
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Review items, apply coupons & select delivery address</p>
        </div>
        <Link
          to="/cart"
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cart
        </Link>
      </div>

      {/* Stock Conflict / General Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl text-sm space-y-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-red-900">Checkout Notice</h4>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-red-200/60 flex justify-end">
            <Link
              to="/cart"
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors"
            >
              Return to Cart
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        {/* Left Column: Fulfillment & Address & Coupons */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Fulfillment Method */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black">
                1
              </span>
              Select Fulfillment Method
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setFulfillmentType('DELIVERY')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                  fulfillmentType === 'DELIVERY'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-black shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                }`}
              >
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className="text-xs sm:text-sm font-bold block">10-Min Home Delivery</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">⚡ Doorstep in 10 mins</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFulfillmentType('PICKUP')}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                  fulfillmentType === 'PICKUP'
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-black shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                }`}
              >
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <Store className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className="text-xs sm:text-sm font-bold block">Store Pickup</span>
                  <span className="text-[10px] text-amber-700 font-semibold">🛍️ Free scheduled pickup</span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Delivery Address / Pickup Slots */}
          {fulfillmentType === 'DELIVERY' ? (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black">
                    2
                  </span>
                  Delivery Address & Instructions
                </h2>
                {user && (
                  <Link
                    to="/profile"
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline"
                  >
                    Edit Profile Address
                  </Link>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  House / Flat Number, Street, Locality <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="e.g. Flat 402, Sunshine Heights, MG Road, Near City Mall, Pune - 411038"
                  className="w-full p-3.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-medium"
                />
                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  Our delivery partner will bring your groceries to this address.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black">
                  2
                </span>
                Choose Store Pickup Slot
              </h2>

              {isLoadingSlots ? (
                <div className="py-8 text-center text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                  Loading available pickup slots...
                </div>
              ) : Object.keys(slotsByDate).length === 0 ? (
                <p className="text-sm text-gray-500 italic">No pickup slots available at this time.</p>
              ) : (
                <div className="space-y-5">
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {slots.map((slot) => {
                          const isFull = slot.slots_remaining <= 0;
                          const isSelected = selectedSlotId === slot.id;

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={isFull}
                              onClick={() => setSelectedSlotId(slot.id)}
                              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
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
                              <span className="text-[10px] font-medium opacity-90">
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

          {/* 3. Coupons & Offers Section */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                Apply Coupon / Promo Code
              </h2>
              <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">
                {AVAILABLE_COUPONS.length} Offers Available
              </span>
            </div>

            {/* Applied Coupon State Banner */}
            {appliedCoupon ? (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Check className="w-5 h-5 stroke-[3]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-emerald-900 tracking-wider">
                        '{appliedCoupon.code}' APPLIED
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.2 bg-emerald-200 text-emerald-900 rounded-full">
                        {appliedCoupon.badge}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                      {appliedCoupon.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors font-bold text-xs flex items-center gap-1"
                  title="Remove coupon"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              </div>
            ) : (
              /* Coupon Input Form */
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <Tag className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Enter Promo Code (e.g. RAKHI50)"
                      className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-sm uppercase tracking-wider font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleManualApply}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all active:scale-95"
                  >
                    Apply
                  </button>
                </div>

                {couponError && (
                  <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {couponError}
                  </p>
                )}
              </div>
            )}

            {/* Quick Available Coupons List */}
            <div className="pt-2 space-y-2.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Available Coupons for You
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {AVAILABLE_COUPONS.map((coupon) => {
                  const isEligible = subtotal >= coupon.minOrder;
                  const isCurrent = appliedCoupon?.code === coupon.code;

                  return (
                    <div
                      key={coupon.code}
                      className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-2.5 relative overflow-hidden ${
                        isCurrent
                          ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-400'
                          : 'border-gray-200 hover:border-emerald-300 bg-gray-50/50 hover:bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-black text-xs text-gray-900 tracking-wider bg-white border border-gray-200 px-2 py-0.5 rounded-lg shadow-2xs">
                            {coupon.code}
                          </span>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 uppercase">
                            {coupon.badge}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-900">{coupon.title}</h4>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                          {coupon.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-gray-200/60">
                        <span className="text-[10px] text-gray-400 font-semibold">
                          Min. order: ₹{coupon.minOrder}
                        </span>
                        {isCurrent ? (
                          <span className="text-[11px] font-extrabold text-emerald-700 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Applied
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyCoupon(coupon)}
                            disabled={!isEligible}
                            className={`text-xs font-black px-3 py-1 rounded-lg transition-all ${
                              isEligible
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isEligible ? 'Apply' : `Add ₹${(coupon.minOrder - subtotal).toFixed(0)} more`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Payment Button */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5 sticky top-20">
          <h2 className="text-base sm:text-lg font-black text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
            <span>Bill Summary</span>
            <span className="text-xs font-bold text-gray-500">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </h2>

          {/* Itemized List */}
          <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-xs text-gray-700">
                <span className="truncate max-w-[11rem] font-semibold text-gray-800">
                  {item.quantity} × {item.product_name}
                </span>
                <span className="font-bold">₹{Number(item.line_total).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Pricing Breakdown */}
          <div className="border-t border-gray-100 pt-3 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Item Total (Subtotal)</span>
              <span className="font-semibold text-gray-900">₹{subtotal.toFixed(2)}</span>
            </div>

            {/* Coupon Discount Row */}
            {itemDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Coupon Discount ({appliedCoupon?.code})
                </span>
                <span>- ₹{itemDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* Delivery Charge */}
            <div className="flex justify-between text-gray-600">
              <span>Delivery Charge</span>
              {deliveryFee === 0 ? (
                <span className="font-bold text-emerald-700">FREE</span>
              ) : (
                <span className="font-semibold text-gray-900">₹{deliveryFee.toFixed(2)}</span>
              )}
            </div>

            <div className="flex justify-between text-gray-600">
              <span>GST / Taxes (5%)</span>
              <span className="font-semibold text-gray-900">₹{tax.toFixed(2)}</span>
            </div>

            {/* Total Savings Card */}
            {totalSavings > 0 && (
              <div className="bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-950 px-3 py-1.5 rounded-xl text-xs font-black flex items-center justify-between border border-amber-300">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" /> Total Savings
                </span>
                <span className="text-emerald-800">₹{totalSavings.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-gray-100 pt-3 flex justify-between items-baseline text-base font-extrabold text-gray-900">
              <span>Total Payable</span>
              <span className="text-emerald-700 text-2xl font-black">₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Place Order CTA Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 hover:scale-102"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing Order...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Pay & Place Order • ₹{total.toFixed(2)}</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Safe & Secure 256-Bit Encrypted Checkout</span>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Checkout;
