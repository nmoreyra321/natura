"use client";

import { Banknote, CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { retryMercadoPago, switchOrderToCash } from "@/app/(tienda)/pedido/actions";
import { buttonClasses } from "@/components/ui/button";

/** Pedido de Mercado Pago que quedó sin pagar: pagar de nuevo, o pasarlo a efectivo (sin perder la compra). */
export function UnpaidMpActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [switching, startSwitch] = useTransition();

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
      <button type="button" onClick={pay} disabled={paying || switching} className={buttonClasses("primary", "lg")}>
        {paying ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <CreditCard className="size-5" aria-hidden="true" />}
        Pagar con Mercado Pago
      </button>
      <button
        type="button"
        disabled={paying || switching}
        onClick={() =>
          startSwitch(async () => {
            const res = await switchOrderToCash(orderId).catch(() => null);
            if (res?.ok) {
              toast.success("Listo: pagás en efectivo al recibir tu pedido.");
              router.refresh();
            } else toast.error(res && !res.ok ? res.error : "No pudimos cambiar el pedido. Probá de nuevo.");
          })
        }
        className={buttonClasses("outline", "lg")}
      >
        {switching ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Banknote className="size-5" aria-hidden="true" />}
        Prefiero pagar en efectivo
      </button>
    </div>
  );
}
