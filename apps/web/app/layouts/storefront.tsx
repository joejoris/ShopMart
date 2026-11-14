import { Outlet } from "react-router";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

/** Storefront chrome: header, centered content, footer. */
export default function StorefrontLayout() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
