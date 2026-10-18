"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { myClub, type MyClub } from "@/app/(tienda)/cuenta/actions";
import { getLoginProviders } from "@/lib/config";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";
import { AccountLogin } from "./account-login";
import { ClubCard } from "./club-card";

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
    <div className="relative flex flex-col gap-3 text-center text-forest sm:gap-4">
      <ClubCard done={done} name={club?.signedIn ? club.name : null} />
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
            Creá tu cuenta con Google: tu primera compra{min > 0 ? ` de ${formatARS(min)} o más` : ""} ya cuenta
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
