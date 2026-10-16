import type { Metadata } from "next";

import { FindOrder } from "@/components/store/find-order";

export const metadata: Metadata = {
  title: "Seguir mi pedido",
  description: "Mirá en qué está tu pedido de Natu Mariel.",
  robots: { index: false, follow: true },
};

export default function MyOrderPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Seguir mi pedido</h1>
      <p className="mt-2 text-muted">Mirá en qué está tu pedido y, si pagaste con Mercado Pago, si ya se aprobó el pago.</p>
      <FindOrder />
    </div>
  );
}
