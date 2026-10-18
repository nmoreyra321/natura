"use client";

import { CircleCheck, Gift } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { myClub, type MyClub } from "@/app/(tienda)/cuenta/actions";
import { getLoginProviders } from "@/lib/config";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";
import { AccountLogin } from "./account-login";

/** Cuadrito del Club en la portada: el avance de la cuenta, o para entrar si no tiene sesión. */
export function ClubProgressCard({ minCents }: { minCents: number }) {
  const [club, setClub] = useState<MyClub | null>(null);

  useEffect(() => {
    let alive = true;
    myClub()
      .then((r) => alive && setClub(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const mine = club?.signedIn && club.hasPhone ? club : null;
  const done = mine ? (mine.pending > 0 ? GIFT_EVERY : mine.progress) : 0;
  const min = mine?.minCents ?? minCents;
  const providers = getLoginProviders();

  return (
    <div className="relative flex flex-col items-center gap-2 rounded-3xl bg-white/70 p-4 text-center backdrop-blur sm:gap-3 sm:p-5">
      <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-extrabold tracking-wide text-muted uppercase">
        {mine ? "Tu avance" : "Tu tarjeta del Club"}
      </span>
      <div className="flex items-center gap-1.5 sm:gap-2" aria-label={`${done} de ${GIFT_EVERY} compras`}>
        {Array.from({ length: GIFT_EVERY }, (_, i) =>
          i < GIFT_EVERY - 1 ? (
            <span
              key={i}
              style={{ "--i": i } as React.CSSProperties}
              className={`flex size-9 items-center justify-center rounded-full sm:size-12 ${i < done ? "animate-stamp bg-botanical-deep text-white" : "border-2 border-dashed border-line bg-white text-line"}`}
            >
              <CircleCheck className="size-5" aria-hidden="true" />
            </span>
          ) : (
            <span
              key={i}
              className={`flex size-10 items-center justify-center rounded-full sm:size-14 ${done >= GIFT_EVERY ? "animate-tada bg-coral-deep text-white shadow-lift" : "border-2 border-dashed border-coral-deep/50 bg-white text-coral-deep"}`}
            >
              <Gift className="size-6" aria-hidden="true" />
            </span>
          ),
        )}
      </div>
      {mine && mine.pending > 0 ? (
        <p className="font-display text-base font-bold text-coral-deep sm:text-lg">¡Te ganaste un regalo! 🎉</p>
      ) : mine ? (
        <>
          <p className="font-display text-base font-bold sm:text-lg">
            Llevás {mine.progress} de {GIFT_EVERY}: {mine.left === 1 ? "¡te falta 1 compra!" : `te faltan ${mine.left} compras`}
          </p>
          <p className="hidden text-xs text-muted sm:block">Se actualiza con cada pedido pagado completo.</p>
        </>
      ) : club?.signedIn ? (
        <>
          <p className="font-display text-base font-bold sm:text-lg">Te falta un paso</p>
          <Link href="/cuenta" className="text-sm font-semibold text-coral-deep underline">
            Cargá tu WhatsApp en Mi cuenta para empezar a sumar
          </Link>
        </>
      ) : (
        <>
          <p className="font-display text-base font-bold sm:text-lg">
            Entrá con tu cuenta y tu primera compra{min > 0 ? ` de ${formatARS(min)} o más` : ""} ya cuenta
          </p>
          {providers.length > 0 ? (
            <div className="w-full max-w-xs">
              <AccountLogin next="/" providers={providers} />
            </div>
          ) : (
            <p className="text-xs text-muted">Muy pronto vas a poder entrar con tu cuenta.</p>
          )}
        </>
      )}
    </div>
  );
}
