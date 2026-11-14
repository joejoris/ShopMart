export function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} ShopMart. Delivering across Kenya 🇰🇪</p>
        <div className="flex gap-6">
          <a href="/products">Shop</a>
          <a href="/account/orders">Orders</a>
          <a href="/auth/register">Create account</a>
        </div>
      </div>
    </footer>
  );
}
