import * as React from "react";
import { type RouteObject } from "react-router";
import type { MetaFunction } from "react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, isRouteErrorResponse } from "react-router";
import stylesheet from "./app.css?url";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { CartProvider } from "./components/CartContext";

export const links = () => [
  { rel: "stylesheet", href: stylesheet },
];

export function meta() {
  return [
    { title: "ShopMart — Online Store" },
    { name: "description", content: "A full-stack ecommerce storefront." },
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
          <Header />
          <main className="mx-auto max-w-7xl px-4">
            <Outlet />
          </main>
          <Footer />
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
  let message = "An unexpected error occurred.";
  if (isRouteErrorResponse(error)) {
    title = `${error.status}`;
    message = error.statusText || message;
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
