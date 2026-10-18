"use client";

import { ArrowLeftRight, Banknote, CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { changePaymentMethod, type PaymentChoice } from "@/app/(tienda)/pedido/actions";

const OPTIONS: Record<PaymentChoice, { label: string; Icon: typeof Banknote }> = {
  efectivo: { label: "Pagar en efectivo", Icon: Banknote },
  transferencia: { label: "Pagar por transferencia (sin recargo)", Icon: ArrowLeftRight },
  mercadopago: { label: "Pagar con Mercado Pago", Icon: CreditCard },
};

/** «Me equivoqué»: cambiar la forma de pago del mismo pedido mientras no se haya pagado nada. */
export function ChangePayment({
  orderId,
  options,
  mpSurcharge,
}: {
  orderId: string;
  options: PaymentChoice[];
  mpSurcharge: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (options.length === 0) return null;
  return (
    <div className="rounded-2xl bg-cream p-4 text-left">
      <p className="font-bold">¿Te equivocaste o preferís pagar de otra forma?</p>
      <p className="mt-0.5 text-sm text-muted">Cambialo acá, tu pedido sigue igual.</p>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((m) => {
          const { label, Icon } = OPTIONS[m];
          return (
            <button
              key={m}
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await changePaymentMethod(orderId, m).catch(() => null);
                  if (res?.ok) {
                    toast.success("Listo, cambiamos la forma de pago.");
                    router.refresh();
                  } else toast.error(res && !res.ok ? res.error : "No pudimos cambiarlo. Probá de nuevo.");
                })
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-line bg-white px-4 text-sm font-bold transition-colors hover:bg-sage/40 disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
              {m === "mercadopago" && mpSurcharge > 0 ? `${label} (+${mpSurcharge}%)` : label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
