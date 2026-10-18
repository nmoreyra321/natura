"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { retryMercadoPago } from "@/app/(tienda)/pedido/actions";
import { buttonClasses } from "@/components/ui/button";

/** Pedido de Mercado Pago que quedó sin pagar: pagar de nuevo, o pasarlo a efectivo (sin perder la compra). */
export function UnpaidMpActions({ orderId }: { orderId: string }) {
  // El pasaje a otra forma de pago (efectivo, transferencia) lo ofrece «¿Te equivocaste?» aparte.
  const [paying, setPaying] = useState(false);

  const pay = async () => {
    if (paying) return;
    setPaying(true);
    const res = await retryMercadoPago(orderId).catch(() => null);
    if (res?.ok) {
      window.location.href = res.url;
      return;
    }
    toast.error(res?.error ?? "No pudimos abrir Mercado Pago. Revisá tu conexión y probá de nuevo.");
    setPaying(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={pay} disabled={paying} className={buttonClasses("primary", "lg")}>
        {paying ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <CreditCard className="size-5" aria-hidden="true" />}
        Pagar con Mercado Pago
      </button>
    </div>
  );
}
