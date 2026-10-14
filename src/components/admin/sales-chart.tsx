"use client";

import { useState } from "react";

import { formatARS } from "@/lib/format";

export type SalesBar = {
  /** Texto corto del eje (ej. "5" o "oct"). */
  tick: string;
  /** Texto completo para el detalle (ej. "Lunes 5 de octubre"). */
  label: string;
  cents: number;
  /** Resalta la barra del período elegido. */
  current?: boolean;
};

const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 2 });

/** Tope "redondo" del eje: 1, 2 o 5 × 10ⁿ. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

/**
 * Columnas de una sola serie (ventas en pesos). Cada barra muestra su valor al pasar el
 * mouse, tocarla o enfocarla con el teclado; la tabla de abajo tiene todos los valores.
 */
export function SalesChart({
  bars,
  title,
  tickEvery = 1,
}: {
  bars: SalesBar[];
  title: string;
  tickEvery?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...bars.map((b) => b.cents / 100), 0));
  const ticks = [max, max / 2, 0];
  const hovered = active !== null ? bars[active] : null;
  // Si ninguna barra está resaltada, todas van en color pleno (una sola serie).
  const emphasis = bars.some((b) => b.current);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="relative flex gap-2">
        {/* Eje Y: valores redondos, compactos */}
        <div className="flex h-48 w-12 shrink-0 flex-col justify-between text-right text-xs text-muted tabular" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              $ {compact.format(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Líneas guía */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-48 flex-col justify-between" aria-hidden="true">
            {ticks.map((t) => (
              <div key={t} className="h-px bg-line" />
            ))}
          </div>

          <ul className="relative flex h-48 items-end gap-[2px]" aria-label={title}>
            {bars.map((b, i) => {
              const pct = (b.cents / 100 / max) * 100;
              return (
                <li key={i} className="flex h-full min-w-0 flex-1 justify-center">
                  <button
                    type="button"
                    className="group flex h-full w-full max-w-6 items-end justify-center focus-visible:outline-none"
                    aria-label={`${b.label}: ${formatARS(b.cents)}`}
                    onPointerEnter={() => setActive(i)}
                    onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive((a) => (a === i ? null : a))}
                    onClick={() => setActive(i)}
                  >
                    <span
                      className={`block w-full rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-forest ${!emphasis || b.current || active === i ? "bg-botanical-deep" : "bg-botanical-deep/45"}`}
                      style={{ height: b.cents > 0 ? `max(${pct}%, 3px)` : "0px" }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Eje X */}
          <div className="mt-1.5 flex gap-[2px] text-xs text-muted tabular" aria-hidden="true">
            {bars.map((b, i) => (
              <span key={i} className="min-w-0 flex-1 text-center">
                {i % tickEvery === 0 || i === bars.length - 1 ? b.tick : ""}
              </span>
            ))}
          </div>

          {hovered ? (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-2xl border border-line bg-white px-3 py-2 text-sm whitespace-nowrap shadow-lift"
              // Se mantiene dentro del gráfico aunque la barra esté en un extremo.
              style={{ left: `clamp(4.5rem, ${((active! + 0.5) / bars.length) * 100}%, calc(100% - 4.5rem))` }}
              role="status"
            >
              <span className="block font-bold tabular">{formatARS(hovered.cents)}</span>
              <span className="text-muted">{hovered.label}</span>
            </div>
          ) : null}
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-muted hover:text-forest">Ver como tabla</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-2xl border border-line">
          <table className="w-full">
            <tbody>
              {bars.map((b, i) => (
                <tr key={i} className="border-b border-line/60 last:border-b-0">
                  <td className="px-3 py-1.5">{b.label}</td>
                  <td className="px-3 py-1.5 text-right tabular">{formatARS(b.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
