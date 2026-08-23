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
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Lock,
  Zap,
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

type PaymentMethodType = 'UPI' | 'RAZORPAY' | 'CARD' | 'COD' | 'NETBANKING';

export const Checkout: React.FC = () => {
  const { user } = useAuth();
  const { cart, fetchCart, clearCartState } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('DELIVERY');
  const [pickupSlots, setPickupSlots] = useState<PickupSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string>('');

  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('UPI');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('gpay');
  const [upiId, setUpiId] = useState<string>('tejas@okaxis');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');
  const [cardName, setCardName] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('HDFC Bank');

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
      // Create detailed order note with payment method and applied coupon metadata
      let note = deliveryNote.trim();
      const paymentInfo =
        paymentMethod === 'UPI'
          ? `UPI (${selectedUpiApp.toUpperCase()})`
          : paymentMethod === 'RAZORPAY'
          ? 'Razorpay Gateway'
          : paymentMethod === 'CARD'
          ? 'Credit/Debit Card'
          : paymentMethod === 'COD'
          ? 'Cash on Delivery (COD)'
          : `Net Banking (${selectedBank})`;

      note = note
        ? `${note} | [Payment: ${paymentInfo}]`
        : `[Payment: ${paymentInfo}]`;

      if (appliedCoupon) {
        note = `${note} | [Coupon: ${appliedCoupon.code}]`;
      }

      const checkoutPayload: { fulfillment_type: FulfillmentType; note?: string } = {
        fulfillment_type: fulfillmentType,
        note: note || undefined,
      };

      const orderRes = await apiClient.post<OrderResponse>('/api/v1/checkout', checkoutPayload);
      const order = orderRes.data;

      // Link slot if Pickup
      if (fulfillmentType === 'PICKUP' && selectedSlotId) {
        try {
          await apiClient.post(`/api/v1/pickup-slots/${selectedSlotId}/book`, {
            order_id: order.id,
          });
        } catch (slotErr) {
          console.warn('Slot booking warning:', slotErr);
        }
      }

      clearCartState();
      await fetchCart();
      showToast('Order Placed Successfully!', {
        type: 'success',
        subMessage: `Order #${order.order_number} · Paid via ${paymentInfo}`,
      });
      navigate(`/orders/${order.id}`);
    } catch (err: any) {
      console.error('Checkout failed:', err);
      setError(
        err.response?.data?.detail || 'Failed to place order. Please check inventory or try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group slots by date
  const slotsByDate: Record<string, PickupSlot[]> = {};
  pickupSlots.forEach((slot) => {
    if (!slotsByDate[slot.date]) {
      slotsByDate[slot.date] = [];
    }
    slotsByDate[slot.date].push(slot);
  });

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <Link
          to="/products"
          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
            <span>Secure Checkout</span>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Encrypted
            </span>
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Review your order, delivery method, and payment options.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center gap-3 text-red-800 text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Columns: Fulfillment, Coupons & Payment Options */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Fulfillment Mode Selector */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200/90 shadow-sm space-y-4">
            <h2 className="text-base sm:text-lg font-black text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              1. Choose Delivery Method
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Home Delivery Option */}
              <button
                type="button"
                onClick={() => setFulfillmentType('DELIVERY')}
                className={`p-4 rounded-2xl border-2 flex items-start gap-3 transition-all text-left ${
                  fulfillmentType === 'DELIVERY'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl ${
                    fulfillmentType === 'DELIVERY'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-gray-900">Home Delivery</span>
                    <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                      ⚡ 10 MINS
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Superfast delivery straight to your doorstep.</p>
                </div>
              </button>

              {/* Store Pickup Option */}
              <button
                type="button"
                onClick={() => setFulfillmentType('PICKUP')}
                className={`p-4 rounded-2xl border-2 flex items-start gap-3 transition-all text-left ${
                  fulfillmentType === 'PICKUP'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl ${
                    fulfillmentType === 'PICKUP'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-gray-900">Store Pickup</span>
                    <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                      FREE
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Pick up directly from nearest Mini D-Mart store.</p>
                </div>
              </button>
            </div>

            {/* Home Delivery Address Input */}
            {fulfillmentType === 'DELIVERY' && (
              <div className="pt-2 space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Delivery Address &amp; Instructions
                  </span>
                  <span className="text-red-500">*Required</span>
                </label>
                <textarea
                  rows={2}
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Flat / House No., Landmark, Area, City, PIN Code..."
                  className="w-full p-3 border border-gray-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50/50"
                  required
                />
              </div>
            )}

            {/* Store Pickup Slots */}
            {fulfillmentType === 'PICKUP' && (
              <div className="pt-2 space-y-3">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Select Store Pickup Time Slot
                </label>

                {isLoadingSlots ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Loading available pickup slots...</span>
                  </div>
                ) : pickupSlots.length === 0 ? (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-semibold">
                    No active pickup slots available today. Please choose Home Delivery or try again later.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(slotsByDate).map(([dateStr, slots]) => (
                      <div key={dateStr} className="space-y-1.5">
                        <span className="text-xs font-black text-gray-700 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-600" />
                          {new Date(dateStr).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {slots.map((slot) => {
                            const isSelected = selectedSlotId === slot.id;
                            const isFull = slot.slots_remaining <= 0;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                disabled={isFull}
                                onClick={() => setSelectedSlotId(slot.id)}
                                className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${
                                  isFull
                                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                    : 'bg-white border-gray-200 hover:border-emerald-400 text-gray-800'
                                }`}
                              >
                                <div className="flex items-center gap-1 text-xs font-bold">
                                  <Clock className="w-3 h-3" />
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
          </div>

          {/* 2. Coupons & Offers Section */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                2. Apply Promo Coupons &amp; Offers
              </h2>
              <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">
                {AVAILABLE_COUPONS.length} Offers Available
              </span>
            </div>

            {/* Applied Coupon State Banner */}
            {appliedCoupon ? (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black text-emerald-900 tracking-wider">
                        '{appliedCoupon.code}' APPLIED
                      </span>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full">
                        {appliedCoupon.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                      {appliedCoupon.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-bold text-xs flex items-center gap-1"
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
                      className="w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm uppercase tracking-wider font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleManualApply}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95"
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
            <div className="pt-2 space-y-2">
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
                      className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2 relative overflow-hidden ${
                        isCurrent
                          ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                          : 'border-gray-200 hover:border-emerald-300 bg-gray-50/40 hover:bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-black text-xs text-gray-900 tracking-wider bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-2xs">
                            {coupon.code}
                          </span>
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 uppercase">
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
                            className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg transition-all ${
                              isEligible
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isEligible ? 'Apply' : `Add ₹${(coupon.minOrder - subtotal).toFixed(0)}`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 🌟 3. PAYMENT OPTIONS & GATEWAY (UPI, Razorpay, Debit/Credit Cards, COD, Net Banking) */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                3. Select Payment Method
              </h2>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                <Lock className="w-3 h-3 text-emerald-600" /> 100% Safe &amp; Secure
              </span>
            </div>

            {/* Payment Method Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Option A: UPI */}
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                  paymentMethod === 'UPI'
                    ? 'border-emerald-600 bg-emerald-50/80 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div
                  className={`p-2 rounded-xl ${
                    paymentMethod === 'UPI' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-xs text-gray-900 block">UPI / QR</span>
                  <span className="text-[10px] text-emerald-700 font-bold block">GPay, PhonePe, Paytm</span>
                </div>
              </button>

              {/* Option B: Razorpay Gateway */}
              <button
                type="button"
                onClick={() => setPaymentMethod('RAZORPAY')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-center relative overflow-hidden ${
                  paymentMethod === 'RAZORPAY'
                    ? 'border-blue-600 bg-blue-50/80 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="absolute top-1 right-1">
                  <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase">
                    FAST
                  </span>
                </div>
                <div
                  className={`p-2 rounded-xl ${
                    paymentMethod === 'RAZORPAY' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
                </div>
                <div>
                  <span className="font-black text-xs text-gray-900 block">Razorpay Gateway</span>
                  <span className="text-[10px] text-blue-700 font-bold block">All-in-One Checkout</span>
                </div>
              </button>

              {/* Option C: Credit / Debit Card */}
              <button
                type="button"
                onClick={() => setPaymentMethod('CARD')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                  paymentMethod === 'CARD'
                    ? 'border-emerald-600 bg-emerald-50/80 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div
                  className={`p-2 rounded-xl ${
                    paymentMethod === 'CARD' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-xs text-gray-900 block">Cards</span>
                  <span className="text-[10px] text-gray-500 font-bold block">Visa, Master, RuPay</span>
                </div>
              </button>

              {/* Option D: Cash on Delivery (COD) */}
              <button
                type="button"
                onClick={() => setPaymentMethod('COD')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                  paymentMethod === 'COD'
                    ? 'border-emerald-600 bg-emerald-50/80 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div
                  className={`p-2 rounded-xl ${
                    paymentMethod === 'COD' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-xs text-gray-900 block">Cash on Delivery</span>
                  <span className="text-[10px] text-emerald-700 font-bold block">Pay at Doorstep</span>
                </div>
              </button>

              {/* Option E: Net Banking */}
              <button
                type="button"
                onClick={() => setPaymentMethod('NETBANKING')}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                  paymentMethod === 'NETBANKING'
                    ? 'border-emerald-600 bg-emerald-50/80 shadow-xs'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div
                  className={`p-2 rounded-xl ${
                    paymentMethod === 'NETBANKING'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-xs text-gray-900 block">Net Banking</span>
                  <span className="text-[10px] text-gray-500 font-bold block">All Indian Banks</span>
                </div>
              </button>
            </div>

            {/* Dynamic Payment Details Container */}
            <div className="pt-2 border-t border-gray-100">
              {/* DETAILS: UPI */}
              {paymentMethod === 'UPI' && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3 animate-fade-in">
                  <span className="text-xs font-extrabold text-gray-700 block">
                    Choose UPI App or Enter UPI ID:
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'gpay', name: 'Google Pay', icon: '🟢' },
                      { id: 'phonepe', name: 'PhonePe', icon: '🟣' },
                      { id: 'paytm', name: 'Paytm', icon: '🔵' },
                      { id: 'bhim', name: 'BHIM UPI', icon: '🇮🇳' },
                    ].map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => setSelectedUpiApp(app.id)}
                        className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                          selectedUpiApp === app.id
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-base">{app.icon}</span>
                        <span className="truncate">{app.name}</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">
                      UPI ID (Virtual Payment Address)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="yourname@okhdfcbank"
                        className="w-full py-2 px-3 border border-gray-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        VERIFIED ✓
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DETAILS: RAZORPAY */}
              {paymentMethod === 'RAZORPAY' && (
                <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 p-4 rounded-2xl border border-blue-200 space-y-2.5 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-600 text-white px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                      RAZORPAY
                    </div>
                    <span className="text-xs font-extrabold text-blue-950">
                      Official Payment Gateway Secured
                    </span>
                  </div>
                  <p className="text-xs text-blue-800 font-medium">
                    You will be securely redirected to the Razorpay checkout overlay to complete payment via UPI, Credit/Debit Card, NetBanking, or Digital Wallets with zero extra charge.
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-[11px] font-bold text-blue-900">
                    <span className="flex items-center gap-1">🛡️ PCI-DSS Certified</span>
                    <span className="flex items-center gap-1">⚡ Instant Refund Guarantee</span>
                  </div>
                </div>
              )}

              {/* DETAILS: CARD */}
              {paymentMethod === 'CARD' && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3 animate-fade-in">
                  <span className="text-xs font-extrabold text-gray-700 block">
                    Enter Credit or Debit Card Details:
                  </span>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                      Card Number
                    </label>
                    <input
                      type="text"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4532 •••• •••• 8912"
                      className="w-full py-2 px-3 border border-gray-300 rounded-xl text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                        Expiry (MM/YY)
                      </label>
                      <input
                        type="text"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="12/28"
                        className="w-full py-2 px-3 border border-gray-300 rounded-xl text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                        CVV / CVC
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="•••"
                        className="w-full py-2 px-3 border border-gray-300 rounded-xl text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                      Name on Card
                    </label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Cardholder Full Name"
                      className="w-full py-2 px-3 border border-gray-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* DETAILS: COD */}
              {paymentMethod === 'COD' && (
                <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 space-y-1.5 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💵</span>
                    <span className="text-xs font-black text-amber-950">
                      Cash / QR Scan on Delivery
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    You can pay in cash or scan the delivery executive's UPI QR code right at your doorstep when your groceries arrive. No advance payment required!
                  </p>
                </div>
              )}

              {/* DETAILS: NET BANKING */}
              {paymentMethod === 'NETBANKING' && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3 animate-fade-in">
                  <span className="text-xs font-extrabold text-gray-700 block">
                    Select Your Bank:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Bank', 'Punjab National Bank'].map((bank) => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => setSelectedBank(bank)}
                        className={`p-2 rounded-xl border text-[11px] font-bold transition-all text-center ${
                          selectedBank === bank
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {bank}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Payment Button */}
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-sm p-5 sm:p-6 space-y-5 sticky top-20">
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

            {/* Selected Payment Method Badge */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex items-center justify-between text-xs font-bold text-gray-700">
              <span className="text-gray-500">Selected Payment:</span>
              <span className="text-emerald-800 flex items-center gap-1 font-black">
                {paymentMethod === 'UPI' && '⚡ UPI / QR'}
                {paymentMethod === 'RAZORPAY' && '🚀 Razorpay Gateway'}
                {paymentMethod === 'CARD' && '💳 Credit / Debit Card'}
                {paymentMethod === 'COD' && '💵 Cash on Delivery'}
                {paymentMethod === 'NETBANKING' && `🏦 ${selectedBank}`}
              </span>
            </div>

            <div className="border-t border-gray-100 pt-3 flex justify-between items-baseline text-base font-extrabold text-gray-900">
              <span>Total Payable</span>
              <span className="text-emerald-700 text-2xl font-black">₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Place Order CTA Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 hover:scale-102 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing Order...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {paymentMethod === 'COD'
                    ? `Place Order (Cash on Delivery) • ₹${total.toFixed(2)}`
                    : paymentMethod === 'RAZORPAY'
                    ? `Pay with Razorpay • ₹${total.toFixed(2)}`
                    : paymentMethod === 'UPI'
                    ? `Pay via UPI • ₹${total.toFixed(2)}`
                    : `Pay & Place Order • ₹${total.toFixed(2)}`}
                </span>
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
