import { Link } from "react-router";

export function meta() {
  return [{ title: "404 — ShopMart" }];
}

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="text-6xl font-extrabold text-gray-200">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-gray-500">The page you’re looking for doesn’t exist or has moved.</p>
      <Link to="/" className="btn mt-6">Back to the store</Link>
    </div>
  );
}
