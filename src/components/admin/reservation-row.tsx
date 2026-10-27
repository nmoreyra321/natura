"use client";

import {
  Banknote,
  HandCoins,
  Loader2,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { cancelReservation, completeReservation } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";

/** Una reserva activa: avisar por WhatsApp, anotar que la retiró (pagó o debe) o cancelarla. */
export function ReservationRow({
  id,
  name,
  phone,
  productName,
  quantity,
  until,
  hoursLeft,
}: {
  id: string;
  name: string;
  phone: string;
  productName: string;
  quantity: number;
  until: string;
  hoursLeft: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const text = `Hola ${name.split(" ")[0]}, te escribo de Natu Mariel. Te tengo guardado ${quantity > 1 ? `${quantity} × ` : ""}${productName}. Te lo guardo hasta ${until}. ¿Cuándo pasás a buscarlo?`;

  const run = (
    fn: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message ?? "Listo.");
      else toast.error(res.error ?? "No pudimos hacerlo.");
      router.refresh();
    });

  return (
    <li className="rounded-3xl bg-warm-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg leading-snug font-bold">
            {quantity > 1 ? `${quantity} × ` : ""}
            {productName}
          </p>
          <p className="text-sm text-muted">
            <b className="text-forest">{name}</b> · +{phone}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${hoursLeft <= 3 ? "bg-coral-soft text-coral-deep" : "bg-sage text-botanical-deep"}`}
        >
          {hoursLeft <= 0 ? "Vence ya" : `Vence ${until}`}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("whatsapp", "sm")}
        >
          <MessageCircle className="size-4" aria-hidden="true" /> Escribirle
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => completeReservation(id, true))}
          className={buttonClasses("primary", "sm")}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Banknote className="size-4" aria-hidden="true" />
          )}{" "}
          Retiró y pagó
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => completeReservation(id, false))}
          className={buttonClasses("secondary", "sm")}
        >
          <HandCoins className="size-4" aria-hidden="true" /> Retiró, paga
          después
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              window.confirm(
                "¿Cancelar esta reserva? El producto vuelve al stock.",
              )
            )
              run(() => cancelReservation(id));
          }}
          className={buttonClasses("outline", "sm")}
        >
          <XCircle className="size-4" aria-hidden="true" /> Cancelar
        </button>
      </div>
    </li>
  );
}
