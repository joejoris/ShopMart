import { Link } from "react-router";

export function meta() {
  return [{ title: "Admin console moved — ShopMart" }];
}

export default function AdminMoved() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl font-bold">The admin console moved</h1>
      <p className="mt-3 text-gray-600">
        ShopMart staff now use the standalone admin console — a separate app with its own sign-in, not part of the storefront.
      </p>
      <p className="mt-6">
        <a className="btn" href="http://localhost:3001/" rel="noreferrer">Open the admin console →</a>
      </p>
      <p className="mt-4">
        <Link to="/" className="text-sm text-brand-700 hover:underline">← Back to the store</Link>
      </p>
    </div>
  );
}
