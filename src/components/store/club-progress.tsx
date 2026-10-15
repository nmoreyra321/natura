"use client";

import { CircleCheck, Gift } from "lucide-react";
import { useEffect, useState } from "react";

import { clubProgress, type ClubProgress } from "@/app/(tienda)/pedido/actions";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";
import { useSavedOrders } from "@/lib/my-orders";

/** Cuadrito del Club en la portada: el avance real de la clienta (si compró desde este celular). */
export function ClubProgressCard({ minCents }: { minCents: number }) {
  const saved = useSavedOrders();
  const ids = saved.map((o) => o.id).join(",");
  const [data, setData] = useState<ClubProgress | null>(null);

  useEffect(() => {
    if (!ids) return;
    let alive = true;
    clubProgress(ids.split(","))
      .then((r) => alive && setData(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ids]);

  const mine = ids && data ? data : null;
  const done = mine ? (mine.pending > 0 ? GIFT_EVERY : mine.progress) : 0;
  const min = mine?.minCents ?? minCents;

  return (
    <div className="relative flex flex-col items-center gap-3 rounded-3xl bg-white/70 p-5 text-center backdrop-blur">
      <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-extrabold tracking-wide text-muted uppercase">
        {mine ? "Tu avance" : "Tu tarjeta del Club"}
      </span>
      <div className="flex items-center gap-2" aria-label={`${done} de ${GIFT_EVERY} compras`}>
        {Array.from({ length: GIFT_EVERY }, (_, i) =>
          i < GIFT_EVERY - 1 ? (
            <span
              key={i}
              className={`flex size-10 items-center justify-center rounded-full sm:size-12 ${i < done ? "bg-botanical-deep text-white" : "border-2 border-dashed border-line bg-white text-line"}`}
            >
              <CircleCheck className="size-5" aria-hidden="true" />
            </span>
          ) : (
            <span
              key={i}
              className={`flex size-12 items-center justify-center rounded-full sm:size-14 ${done >= GIFT_EVERY ? "animate-pulse bg-coral-deep text-white shadow-lift" : "border-2 border-dashed border-coral-deep/50 bg-white text-coral-deep"}`}
            >
              <Gift className="size-6" aria-hidden="true" />
            </span>
          ),
        )}
      </div>
      {mine && mine.pending > 0 ? (
        <p className="font-display text-lg font-bold text-coral-deep">¡Te ganaste un regalo! 🎉</p>
      ) : mine ? (
        <p className="font-display text-lg font-bold">
          Llevás {mine.progress} de {GIFT_EVERY}: {mine.left === 1 ? "¡te falta 1 compra!" : `te faltan ${mine.left} compras`}
        </p>
      ) : (
        <p className="font-display text-lg font-bold">
          Tu primera compra{min > 0 ? ` de ${formatARS(min)} o más` : ""} ya cuenta
        </p>
      )}
      <p className="text-xs text-muted">
        {mine ? "Se actualiza con cada pedido pagado completo." : "Cuando compres desde este celular, acá vas a ver cuánto te falta."}
      </p>
    </div>
  );
}
