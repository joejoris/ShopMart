import * as React from "react";
import { type RouteObject } from "react-router";
import type { MetaFunction } from "react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, isRouteErrorResponse } from "react-router";
import stylesheet from "./app.css?url";
import { CartProvider } from "./components/CartContext";
import { SessionExpiredListener } from "./components/SessionExpiredListener";

export const links = () => [
  { rel: "stylesheet", href: stylesheet },
];

export function meta() {
  return [
    { title: "ShopMart Kenya — Online Store" },
    { name: "description", content: "Kenya's online store. Electronics, fashion, home essentials, books and sports — delivered countrywide." },
  ];
}

export default function App() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <CartProvider>
          <SessionExpiredListener />
          <Outlet />
        </CartProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  let title = "Something went wrong";
  let message = "An unexpected error occurred. The API may be unavailable.";
  if (isRouteErrorResponse(error)) {
    title = `${error.status}`;
    message = error.statusText || message;
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} — ShopMart</title>
      </head>
      <body>
        <main style={{ padding: "4rem 2rem", fontFamily: "system-ui" }}>
          <h1 style={{ fontSize: "1.5rem" }}>{title}</h1>
          <p>{message}</p>
          <a href="/">Back to the storefront</a>
        </main>
      </body>
    </html>
  );
}
