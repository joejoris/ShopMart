"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, Cart, getGuestId } from "@/lib/api";
import { useAuth } from "@/lib/store";

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  refresh: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

async function fetchCart(): Promise<Cart> {
  return api.get<Cart>("/cart");
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCart(await fetchCart());
    } catch {
      // keep previous cart on transient errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Load (or reload) whenever auth state flips so we merge the guest cart on login.
  useEffect(() => {
    getGuestId();
    let cancelled = false;
    fetchCart()
      .then((c) => { if (!cancelled) setCart(c); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const addItem: CartContextValue["addItem"] = async (productId, quantity = 1) => {
    const next = await api.post<Cart>("/cart/items", { productId, quantity });
    setCart(next);
  };

  const setQuantity: CartContextValue["setQuantity"] = async (itemId, quantity) => {
    const next = await api.put<Cart>(`/cart/items/${itemId}`, { quantity });
    setCart(next);
  };

  const removeItem: CartContextValue["removeItem"] = async (itemId) => {
    const next = await api.del<Cart>(`/cart/items/${itemId}`);
    setCart(next);
  };

  return (
    <CartContext.Provider value={{ cart, loading, refresh, addItem, setQuantity, removeItem }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
