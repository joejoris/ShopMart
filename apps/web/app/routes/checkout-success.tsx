import { Link, useSearchParams } from "react-router";

export function meta() {
  return [{ title: "Order placed — ShopMart" }];
}

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
      <h1 className="mt-4 text-2xl font-bold">Order placed!</h1>
      <p className="mt-2 text-gray-600">Thank you for your purchase. You’ll receive a confirmation email shortly.</p>
      <div className="mt-6 flex justify-center gap-3">
        {orderId && <Link to={`/account/orders/${orderId}`} className="btn">View order</Link>}
        <Link to="/products" className="btn-outline">Continue shopping</Link>
      </div>
    </div>
  );
}
