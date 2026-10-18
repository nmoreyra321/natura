"use client";

import { Check, Gift } from "lucide-react";
import { useRef, useState } from "react";

import { GIFT_EVERY } from "@/lib/loyalty";

/** Una ola en SVG (para el fondo de la tarjeta). */
function wavePath(y: number, amp: number, freq: number, phase: number): string {
  let d = `M0 ${y}`;
  for (let x = 0; x <= 400; x += 8) d += ` L${x} ${(y + amp * Math.sin((x / 400) * Math.PI * 2 * freq + phase)).toFixed(1)}`;
  return `${d} V120 H0Z`;
}
const WAVES = [
  { d: wavePath(58, 20, 1.2, 0), fill: "#ff8ac0" },
  { d: wavePath(80, 17, 1.4, 1), fill: "#e0247f" },
  { d: wavePath(102, 14, 1.6, 2), fill: "#8a2fb0" },
];

function Waves() {
  return (
    <svg aria-hidden="true" viewBox="0 0 400 120" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[-5%] bottom-[-2px] z-0 h-[52%] w-[110%]">
      {WAVES.map((w) => (
        <path key={w.fill} d={w.d} fill={w.fill} />
      ))}
    </svg>
  );
}

// Cada cara se muestra o se oculta del todo (no se usa `backface-visibility`, que en el iPhone dejaba ver el frente "en espejo").
const FACE = "absolute inset-0 overflow-hidden rounded-[1.4rem] bg-gradient-to-br from-[#fff6e6] to-[#ffeccf] text-forest shadow-[0_22px_40px_-26px_rgb(209_22_107/0.55),0_0_0_1px_rgb(0_0_0/0.06)]";

/**
 * Tarjeta virtual del Club con aspecto de tarjeta real: adelante tiene chip, los sellos de las compras
 * y el nombre; al tocarla se da vuelta y muestra el dorso (banda, firma y avance). Se inclina con el dedo.
 * Cada sello se estampa al aparecer y el regalo salta cuando se gana.
 */
export function ClubCard({ done, name }: { done: number; name: string | null }) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [flipped, setFlipped] = useState(false);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  const shown = Math.min(done, GIFT_EVERY);
  const who = name?.trim() || null;

  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 6) moved.current = true;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `rotateY(${(x - 0.5) * 14}deg) rotateX(${(0.5 - y) * 14}deg)`;
  };
  const reset = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "";
  };
  // Giro en dos tiempos: la tarjeta se pone de canto (90°), ahí se cambia de cara, y termina de girar por el otro lado.
  const toggle = () => {
    const el = flipRef.current;
    if (!el || busy.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFlipped((f) => !f);
      return;
    }
    busy.current = true;
    el.style.transition = "transform 200ms ease-in";
    el.style.transform = "rotateY(90deg)";
    setTimeout(() => {
      setFlipped((f) => !f);
      el.style.transition = "none";
      el.style.transform = "rotateY(-90deg)";
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.style.transition = "transform 260ms ease-out";
          el.style.transform = "rotateY(0deg)";
          setTimeout(() => {
            busy.current = false;
          }, 270);
        }),
      );
    }, 200);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div className="[perspective:1000px]">
      <div
        ref={tiltRef}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
          moved.current = false;
        }}
        onPointerMove={tilt}
        onPointerLeave={reset}
        onPointerUp={reset}
        onPointerCancel={reset}
        onClick={() => {
          if (!moved.current) toggle();
        }}
        className="touch-pan-y transition-transform duration-200 ease-out"
      >
        <div ref={flipRef} className="relative aspect-[1.586] w-full">
          {/* Adelante */}
          <div
            role="button"
            tabIndex={flipped ? -1 : 0}
            aria-hidden={flipped}
            aria-label={`Tarjeta del Club Natu Mariel: ${shown} de ${GIFT_EVERY} compras. Tocá para darla vuelta.`}
            onKeyDown={onKey}
            className={`${FACE} ${flipped ? "hidden" : "flex"} cursor-pointer flex-col justify-between p-4 sm:p-5`}
          >
            <Waves />
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className="font-display text-lg font-bold">Natu Mariel</span>
              <span className="flex items-center gap-3">
                <span className="text-[0.64rem] font-extrabold tracking-[0.14em] uppercase opacity-85">
                  Club · {shown}/{GIFT_EVERY}
                </span>
                <span aria-hidden="true" className="relative block h-7 w-9 rounded-md bg-gradient-to-br from-[#ffeaa0] to-[#d9a43a] shadow-[inset_0_0_0_1px_rgb(120_70_0/0.3)] before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-[#784600]/30 after:absolute after:inset-y-0 after:left-[34%] after:w-px after:bg-[#784600]/30 after:shadow-[14px_0_0_rgb(120_70_0/0.3)]" />
              </span>
            </div>

            <ul className="relative z-10 flex justify-between gap-1.5" aria-hidden="true">
              {Array.from({ length: GIFT_EVERY }, (_, i) => {
                const gift = i === GIFT_EVERY - 1;
                const on = gift ? shown >= GIFT_EVERY : i < shown;
                return (
                  <li
                    key={i}
                    style={{ "--i": i } as React.CSSProperties}
                    className={`flex aspect-square max-w-13 flex-1 items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25)] ${
                      gift
                        ? on
                          ? "animate-tada bg-sun! text-[#6a3d00] shadow-[0_3px_8px_rgb(0_0_0/0.3)]"
                          : "text-[#e09a10] ring-[1.5px] ring-sun"
                        : on
                          ? "animate-stamp text-coral-deep shadow-[0_3px_8px_rgb(0_0_0/0.3)]"
                          : "text-[#c06a96]"
                    }`}
                  >
                    {gift ? (
                      <Gift className="size-[48%]" />
                    ) : on ? (
                      <Check className="size-[46%]" strokeWidth={3} />
                    ) : (
                      <span className="flex flex-col items-center leading-none">
                        <span className="text-[0.5rem] font-extrabold tracking-wide uppercase">Compra</span>
                        <span className="font-display text-lg font-bold">{i + 1}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="relative z-10 flex items-end">
              <div className="min-w-0 rounded-xl bg-white/90 px-3.5 py-1.5 shadow-[0_3px_8px_-4px_rgb(0_0_0/0.3)]">
                <p className="text-[0.64rem] font-extrabold tracking-[0.14em] uppercase opacity-80">Club de clientas</p>
                <p className="truncate font-display text-base font-semibold tracking-wider uppercase">{who ?? "Tu nombre acá"}</p>
              </div>
            </div>
          </div>

          {/* Dorso */}
          <div
            role="button"
            tabIndex={flipped ? 0 : -1}
            aria-hidden={!flipped}
            aria-label="Dorso de la tarjeta del Club. Tocá para darla vuelta."
            onKeyDown={onKey}
            className={`${FACE} ${flipped ? "block" : "hidden"} cursor-pointer`}
          >
            <Waves />
            <i aria-hidden="true" className="absolute inset-x-0 top-[13%] z-10 h-[17%] bg-gradient-to-b from-[#2a2a2e] via-[#0e0e10] to-[#2a2a2e]" />
            <div
              className="absolute top-[40%] right-[30%] left-[6%] z-10 flex h-[18%] items-center overflow-hidden bg-[repeating-linear-gradient(135deg,#fff_0_5px,#f1eee8_5px_10px)] px-2.5 text-[1.35rem] whitespace-nowrap text-[#2a3a6a] shadow-[0_1px_3px_rgb(0_0_0/0.25)]"
              style={{ fontFamily: "var(--font-caveat), cursive", fontWeight: 700 }}
            >
              {who ?? "Tu firma"}
            </div>
            <div className="absolute top-[40%] right-[6%] z-10 flex h-[18%] w-[19%] items-center justify-center bg-white text-sm font-extrabold text-[#222] shadow-[0_1px_3px_rgb(0_0_0/0.25)] tabular">
              {shown}/{GIFT_EVERY}
            </div>
            <p className="absolute inset-x-[6%] bottom-[9%] z-10 rounded-xl bg-white/90 px-3 py-1.5 text-[0.68rem] leading-snug font-bold shadow-[0_3px_8px_-4px_rgb(0_0_0/0.3)]">
              <b className="block font-display text-[0.8rem]">Club Natu Mariel</b>
              Cada compra pagada y confirmada suma un sello. Con el {GIFT_EVERY}º, ¡regalo de Mariel!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
