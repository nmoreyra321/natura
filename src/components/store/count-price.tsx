"use client";

import { useEffect, useState } from "react";

import { formatARS } from "@/lib/format";

/**
 * Precio que «baja» contando desde el de la revista hasta el de Natu Mariel, una sola vez
 * al abrir la ficha. Con «reducir movimiento» activado muestra el precio final de entrada.
 */
export function CountPrice({ fromCents, toCents }: { fromCents: number; toCents: number }) {
  const [cents, setCents] = useState(toCents);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || fromCents <= toCents) return;
    let raf = 0;
    const start = performance.now() + 500;
    const duration = 900;
    const tick = (now: number) => {
      const k = Math.min(Math.max((now - start) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setCents(Math.round(fromCents - (fromCents - toCents) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fromCents, toCents]);

  return <span className="animate-price-pop tabular">{formatARS(cents)}</span>;
}
