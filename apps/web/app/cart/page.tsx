"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { api, Cart, formatPrice } from "@/lib/api";

export default function CartPage() {
  const qc = useQueryClient();
  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get<Cart>("/cart"),
  });

  const updateQty = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.put(`/cart/items/${id}`, { quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
  const removeItem = useMutation({
    mutationFn: (id: string) => api.del(`/cart/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });

  if (isLoading) return <p className="py-16 text-center text-gray-500">Loading…</p>;
  const items = cart?.items ?? [];

  return (
    <div className="py-6">
      <h1 className="text-2xl font-bold">Your cart</h1>
      {items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">Your cart is empty.</p>
          <Link href="/products" className="btn mt-4">Browse products</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="card flex gap-4 p-3">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  {item.product.images[0] && (
                    <Image src={item.product.images[0]} alt={item.product.title} fill className="object-cover" unoptimized />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <Link href={`/products/${item.product.slug}`} className="font-semibold hover:underline">{item.product.title}</Link>
                  <p className="text-sm text-gray-500">{formatPrice(item.product.priceCents)} each</p>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center rounded-md border border-gray-300">
                      <button className="px-2 py-1" onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity - 1 })}>−</button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button className="px-2 py-1" onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity + 1 })}>+</button>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold">{formatPrice(item.lineTotalCents)}</span>
                      <button className="text-sm text-red-600 hover:underline" onClick={() => removeItem.mutate(item.id)}>Remove</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="card h-fit space-y-3 p-5">
            <h2 className="text-lg font-bold">Order summary</h2>
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatPrice(cart!.subtotalCents)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Shipping</span><span>{cart!.subtotalCents >= 5000 ? "Free" : "Calculated at checkout"}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Tax</span><span>Calculated at checkout</span></div>
            <div className="border-t pt-3 flex justify-between font-bold"><span>Total</span><span>{formatPrice(cart!.subtotalCents)}</span></div>
            <Link href="/checkout" className="btn w-full">Checkout</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
