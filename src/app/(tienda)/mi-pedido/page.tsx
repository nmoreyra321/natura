import type { Metadata } from "next";
import Link from "next/link";

import { AccountOrders } from "@/components/store/account-orders";
import { FindOrder } from "@/components/store/find-order";
import { getCustomer } from "@/lib/customer";

// Depende de la sesión de la clienta: nunca se prerenderiza.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seguir mi pedido",
  description: "Mirá en qué está tu pedido de Natu Mariel.",
  robots: { index: false, follow: true },
};

export default async function MyOrderPage() {
  const customer = await getCustomer();

  // Con la sesión iniciada, los pedidos de la cuenta se ven directo, sin buscar nada.
  if (customer) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Mis pedidos</h1>
        <p className="mt-2 text-muted">Tocá un pedido para ver qué compraste, cuánto pagaste y en qué está.</p>
        <AccountOrders customerId={customer.id} />
        <p className="mt-3 text-center text-sm">
          <Link href="/cuenta" className="font-semibold text-coral-deep underline">
            Ver mi cuenta y mi avance en el Club
          </Link>
        </p>
        <details className="mt-8 rounded-3xl bg-warm-white p-4 shadow-soft ring-1 ring-line/70">
          <summary className="cursor-pointer font-semibold">¿Hiciste un pedido sin la cuenta? Buscalo acá</summary>
          <FindOrder />
        </details>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Seguir mi pedido</h1>
      <p className="mt-2 text-muted">Mirá en qué está tu pedido y, si pagaste con Mercado Pago, si ya se aprobó el pago.</p>
      <FindOrder />
    </div>
  );
}
