import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  route("", "./routes/home.tsx", { id: "home" }),
  route("products", "./routes/products.tsx"),
  route("products/:slug", "./routes/product-detail.tsx"),
  route("cart", "./routes/cart.tsx"),
  route("checkout", "./routes/checkout.tsx"),
  route("checkout/success", "./routes/checkout-success.tsx"),
  route("auth/login", "./routes/auth-login.tsx"),
  route("auth/register", "./routes/auth-register.tsx"),
  route("auth/forgot-password", "./routes/auth-forgot-password.tsx"),
  route("auth/reset", "./routes/auth-reset.tsx"),
  route("auth/verify", "./routes/auth-verify.tsx"),
  route("account", "./routes/account.tsx"),
  route("account/orders", "./routes/account-orders.tsx"),
  route("account/orders/:id", "./routes/order-detail.tsx"),
  route("wishlist", "./routes/wishlist.tsx"),
  route("admin", "./routes/admin.tsx", [
    index("./routes/admin-overview.tsx"),
    route("products", "./routes/admin-products.tsx"),
    route("orders", "./routes/admin-orders.tsx"),
    route("coupons", "./routes/admin-coupons.tsx"),
    route("emails", "./routes/admin-emails.tsx"),
  ]),
  route("*", "./routes/not-found.tsx"),
] satisfies RouteConfig;
