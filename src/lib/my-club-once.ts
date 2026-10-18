"use client";

import { myClub, type MyClub } from "@/app/(tienda)/cuenta/actions";

let pending: Promise<MyClub> | null = null;
let at = 0;

/** Una sola consulta de «mi club» aunque la pidan varios cuadritos a la vez (o al volver a la portada). */
export function myClubOnce(): Promise<MyClub> {
  const now = Date.now();
  if (!pending || now - at > 5000) {
    at = now;
    pending = myClub().catch((e) => {
      pending = null;
      throw e;
    });
  }
  return pending;
}
