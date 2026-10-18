"use client";

import { Check, Gift } from "lucide-react";
import { useRef } from "react";

import { GIFT_EVERY } from "@/lib/loyalty";

/**
 * Tarjeta virtual del Club: se ve como una tarjeta de verdad, con chip, nombre y un casillero por
 * compra. Cada sello se estampa al aparecer y el regalo salta cuando se gana. Se inclina con el dedo.
 */
export function ClubCard({ done, name }: { done: number; name: string | null }) {
  const ref = useRef<HTMLDivElement>(null);

  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `rotateY(${(x - 0.5) * 20}deg) rotateX(${(0.5 - y) * 20}deg)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  const shown = Math.min(done, GIFT_EVERY);
  return (
    <div className="[perspective:900px]">
      <div
        ref={ref}
        onPointerMove={tilt}
        onPointerDown={tilt}
        onPointerLeave={reset}
        onPointerUp={reset}
        onPointerCancel={reset}
        role="img"
        aria-label={`Tarjeta del Club Natu Mariel: ${shown} de ${GIFT_EVERY} compras`}
        className="club-card relative isolate flex aspect-[1.586] w-full touch-pan-y flex-col justify-between overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-coral-deep via-[#a3278f] to-grape p-4 text-white shadow-lift transition-transform duration-200 ease-out sm:p-5"
      >
        <div className="relative z-10 flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-lg font-bold">
            <span aria-hidden="true" className="block size-5 -rotate-[20deg] rounded-[50%_50%_50%_25%] bg-sun" />
            Natu Mariel
          </span>
          <span aria-hidden="true" className="relative block h-7 w-9 rounded-md bg-gradient-to-br from-[#ffe58f] to-[#e0a93a] after:absolute after:inset-y-0 after:left-[36%] after:w-px after:bg-[#784600]/35 before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-[#784600]/35" />
        </div>

        <ul className="relative z-10 flex justify-between gap-1.5" aria-hidden="true">
          {Array.from({ length: GIFT_EVERY }, (_, i) => {
            const gift = i === GIFT_EVERY - 1;
            const on = gift ? shown >= GIFT_EVERY : i < shown;
            return (
              <li
                key={i}
                style={{ "--i": i } as React.CSSProperties}
                className={`flex aspect-square max-w-13 flex-1 items-center justify-center rounded-full border-2 ${
                  on
                    ? gift
                      ? "animate-tada border-sun bg-sun text-forest"
                      : "animate-stamp border-white bg-white text-coral-deep"
                    : gift
                      ? "border-dashed border-sun bg-white/10 text-sun"
                      : "border-dashed border-white/50 bg-white/10 text-white/55"
                }`}
              >
                {gift ? <Gift className="size-[55%]" /> : <Check className="size-[50%]" strokeWidth={3} />}
              </li>
            );
          })}
        </ul>

        <div className="relative z-10 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-extrabold tracking-[0.12em] uppercase opacity-85">Club de clientas</p>
            <p className="truncate font-display text-base font-semibold tracking-wider uppercase">{name?.trim() || "Tu nombre acá"}</p>
          </div>
          <p className="shrink-0 font-display text-sm tracking-[0.15em] tabular opacity-90">
            •••• {shown}/{GIFT_EVERY}
          </p>
        </div>
      </div>
    </div>
  );
}
