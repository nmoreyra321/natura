"use client";

import { ArrowRight, Gift } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

import { myClub } from "@/app/(tienda)/cuenta/actions";

/**
 * Texto del Club en el inicio: quien todavía no tiene cuenta ve la invitación; quien ya entró
 * ve solo un título corto y «Ver mi tarjeta» (no hace falta explicarle por qué crear la cuenta).
 */
export function ClubPitch({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    myClub()
      .then((r) => alive && setSignedIn(r.signedIn))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!signedIn) return <>{children}</>;
  return (
    <>
      <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-coral-deep sm:text-sm">
        <Gift className="size-4" aria-hidden="true" /> Club Natu Mariel
      </p>
      <h2
        id="club"
        className="mt-2 font-display text-2xl leading-tight font-bold sm:mt-3 sm:text-4xl"
      >
        Tu tarjeta del <span className="text-coral-deep">Club</span>
      </h2>
      <Link
        href="/club"
        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-coral-deep px-5 text-sm font-bold text-white shadow-lift transition hover:-translate-y-0.5 sm:mt-5 sm:min-h-11 sm:px-6 sm:text-base"
      >
        Ver mi tarjeta <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </>
  );
}
