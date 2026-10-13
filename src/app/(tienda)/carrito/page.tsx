import type { Metadata } from "next";

import { CartView } from "@/components/store/cart-view";
import { getSiteUrl } from "@/lib/config";
import { getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Mi carrito",
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-6 font-display text-3xl font-bold sm:text-4xl">Mi carrito</h1>
      <CartView whatsappNumber={getWhatsAppNumber()} siteUrl={getSiteUrl()} />
    </div>
  );
}
