import type { Metadata } from "next";

import { CartView } from "@/components/store/cart-view";
import { getSiteUrl } from "@/lib/config";
import { isMercadoPagoEnabled } from "@/lib/mercadopago";
import { getLoyaltyMinTotal, getMercadoPagoSurcharge, getTransferDetails } from "@/lib/store-settings";
import { getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Mi carrito",
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  const mercadoPago = isMercadoPagoEnabled();
  // Con Mercado Pago activo, la clienta paga con el link (se aprueba solo) y no se ofrece transferencia.
  const [transfer, mpSurcharge, clubMin] = await Promise.all([
    mercadoPago ? null : getTransferDetails(),
    mercadoPago ? getMercadoPagoSurcharge() : 0,
    getLoyaltyMinTotal(),
  ]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-6 font-display text-3xl font-bold sm:text-4xl">Mi carrito</h1>
      <CartView
        whatsappNumber={getWhatsAppNumber()}
        siteUrl={getSiteUrl()}
        mercadoPago={mercadoPago}
        mpSurcharge={mpSurcharge}
        transfer={transfer}
        clubMinCents={Math.round(clubMin * 100)}
      />
    </div>
  );
}
