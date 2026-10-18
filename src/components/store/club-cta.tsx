"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { myClub } from "@/app/(tienda)/cuenta/actions";

/** Botón del Club en el inicio: «Crear mi cuenta» si no entró, «Ver mi tarjeta» si ya tiene cuenta. */
export function ClubCta() {
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

  return (
    <Link
      href={signedIn ? "/club" : "/club#crear"}
      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-coral-deep px-5 text-sm font-bold text-white shadow-lift transition hover:-translate-y-0.5 sm:mt-5 sm:min-h-11 sm:px-6 sm:text-base"
    >
      {signedIn ? "Ver mi tarjeta" : "Crear mi cuenta y obtener mi tarjeta"} <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}
