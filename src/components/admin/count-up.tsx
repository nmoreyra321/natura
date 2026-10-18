"use client";

import { useEffect, useState } from "react";

import { formatARS } from "@/lib/format";

/** Plata que «sube» contando desde cero, una sola vez al abrir. Con «reducir movimiento» muestra el número final. */
export function CountUp({ cents }: { cents: number }) {
  const [shown, setShown] = useState(cents);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || cents <= 0) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const k = Math.min((now - start) / duration, 1);
      setShown(Math.round(cents * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cents]);

  return <span className="tabular">{formatARS(shown)}</span>;
}
