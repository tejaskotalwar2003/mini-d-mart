import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from './AuthContext';
import type { CartResponse } from '../types';

interface CartContextType {
  cart: CartResponse | null;
  itemCount: number;
  isLoading: boolean;
  error: string | null;
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<string | null>;
  updateCartItem: (itemId: string, quantity: number) => Promise<string | null>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCartState: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = async (): Promise<void> => {
    if (!user) {
      setCart(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<CartResponse>('/api/v1/cart');
      setCart(res.data);
    } catch (err: any) {
      console.error('Failed to fetch cart:', err);
      setError(err.response?.data?.detail || 'Failed to load shopping cart.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setCart(null);
    }
  }, [user]);

  const addToCart = async (productId: string, quantity: number = 1): Promise<string | null> => {
    try {
      const res = await apiClient.post<CartResponse>('/api/v1/cart/items', {
        product_id: productId,
        quantity,
      });
      setCart(res.data);
      return null;
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to add item to cart.';
      return msg;
    }
  };

  const updateCartItem = async (itemId: string, quantity: number): Promise<string | null> => {
    try {
      const res = await apiClient.patch<CartResponse>(`/api/v1/cart/items/${itemId}`, {
        quantity,
      });
      setCart(res.data);
      return null;
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update item quantity.';
      return msg;
    }
  };

  const removeFromCart = async (itemId: string): Promise<void> => {
    try {
      const res = await apiClient.delete<CartResponse>(`/api/v1/cart/items/${itemId}`);
      setCart(res.data);
    } catch (err: any) {
      console.error('Failed to remove cart item:', err);
    }
  };

  const clearCartState = (): void => {
    setCart(null);
    setError(null);
  };

  const itemCount = cart ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        isLoading,
        error,
        fetchCart,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCartState,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
