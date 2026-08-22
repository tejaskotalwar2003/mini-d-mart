import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import {
  ShoppingBag,
  Package,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export const Cart: React.FC = () => {
  const { cart, isLoading, updateCartItem, removeFromCart } = useCart();
  const navigate = useNavigate();

  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    setUpdatingItemId(itemId);
    setItemErrors((prev) => ({ ...prev, [itemId]: '' }));

    const errorMsg = await updateCartItem(itemId, newQuantity);
    if (errorMsg) {
      setItemErrors((prev) => ({ ...prev, [itemId]: errorMsg }));
    }
    setUpdatingItemId(null);
  };

  const handleRemove = async (itemId: string) => {
    setUpdatingItemId(itemId);
    await removeFromCart(itemId);
    setUpdatingItemId(null);
  };

  if (isLoading && !cart) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading your cart...</p>
      </div>
    );
  }

  const items = cart?.items || [];
  const subtotal = Number(cart?.subtotal || 0);
  const tax = subtotal * 0.05; // 5% flat tax matching backend checkout logic
  const total = subtotal + tax;

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <div className="bg-emerald-50 p-6 rounded-full inline-block text-emerald-600 mb-4">
          <ShoppingBag className="w-16 h-16" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Your Cart is Empty</h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto text-sm">
          Looks like you haven't added any fresh groceries to your cart yet. Explore our catalog to get started!
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
          <ShoppingBag className="w-7 h-7 text-emerald-600" />
          Shopping Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
        </h1>
        <Link
          to="/products"
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Continue Shopping
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Cart Item List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden"
            >
              <div className="flex items-center gap-4 flex-1">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.product_name}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                <div className="space-y-1">
                  <h3 className="font-bold text-gray-900 text-base">{item.product_name}</h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Unit Price: ₹{Number(item.unit_price).toFixed(2)}
                  </p>

                  {/* Inline 409 Stock Error Alert */}
                  {itemErrors[item.id] && (
                    <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{itemErrors[item.id]}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between w-full sm:w-auto gap-6">
                {/* Quantity Stepper */}
                <div className="flex items-center border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                  <button
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    disabled={updatingItemId === item.id}
                    className="p-2 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                    title="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 font-bold text-gray-900 text-sm min-w-[2.5rem] text-center">
                    {updatingItemId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto text-emerald-600" />
                    ) : (
                      item.quantity
                    )}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    disabled={updatingItemId === item.id}
                    className="p-2 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                    title="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Line Total */}
                <div className="text-right min-w-[5rem]">
                  <span className="text-base font-extrabold text-gray-900">
                    ₹{Number(item.line_total).toFixed(2)}
                  </span>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemove(item.id)}
                  disabled={updatingItemId === item.id}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary Side Panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5 sticky top-20">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">
            Order Summary
          </h2>

          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Estimated Tax (5%)</span>
              <span className="font-semibold text-gray-900">₹{tax.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between text-base font-extrabold text-gray-900">
              <span>Estimated Total</span>
              <span className="text-emerald-700 text-xl">₹{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>Stock reserved during checkout via transactional locking.</span>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            Proceed to Checkout
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;
