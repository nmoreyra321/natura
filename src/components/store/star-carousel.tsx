"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatARS } from "@/lib/format";
import { CountPrice } from "./count-price";

export type StarItem = {
  id: string;
  name: string;
  slug: string;
  src: string | null;
  magazineCents: number;
  saleCents: number;
  discountPercent: number;
};

const AUTOPLAY_MS = 5500;

/** Carrusel de «Productos de la semana»: se desliza con el dedo, avanza solo y cada producto flota y baja de precio. */
export function StarCarousel({ items }: { items: StarItem[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);

  const go = useCallback((i: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  // Avanza solo cada tanto; si la clienta toca o desliza, espera un rato antes de seguir.
  useEffect(() => {
    if (items.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (document.hidden || Date.now() < pausedUntil.current) return;
      const el = track.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % items.length;
      go(next);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [items.length, go]);

  const pause = () => {
    pausedUntil.current = Date.now() + 12_000;
  };

  return (
    <section className="px-3 py-4 sm:px-6" aria-roledescription="carrusel" aria-label="Productos de la semana">
      <div className="mx-auto max-w-7xl">
        <ul
          ref={track}
          onScroll={onScroll}
          onPointerDown={pause}
          onTouchStart={pause}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-[2rem] shadow-lift [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((p, i) => (
            <li key={p.id} className="w-full shrink-0 snap-center" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${items.length}`}>
              <Link
                href={`/productos/${p.slug}`}
                className="star-card relative grid h-full items-center gap-4 overflow-hidden bg-gradient-to-br from-blush via-lilac to-peach p-5 sm:grid-cols-[1fr_1.2fr] sm:gap-8 sm:p-8"
              >
                <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-coral-deep shadow-soft sm:text-sm">
                  ⭐ Producto de la semana · {i + 1}/{items.length}
                </span>
                <div className="star-float relative mx-auto mt-8 aspect-square w-48 sm:mt-0 sm:w-64">
                  {p.src ? (
                    <Image
                      src={p.src}
                      alt={p.name}
                      fill
                      sizes="(min-width: 640px) 256px, 192px"
                      className="object-contain drop-shadow-[0_14px_10px_rgba(80,20,80,0.25)]"
                      priority={i === 0}
                    />
                  ) : null}
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="font-display text-2xl leading-tight font-bold sm:text-4xl">{p.name}</h2>
                  <p className="mt-3 text-xs font-extrabold tracking-wide text-forest/70 uppercase">Precio en revista</p>
                  <p className="text-lg text-forest/70 line-through decoration-coral-deep/50 decoration-1 tabular">{formatARS(p.magazineCents)}</p>
                  <p className="mt-1 text-xs font-extrabold tracking-wide text-coral-deep uppercase">Precio en Natu Mariel</p>
                  <p className="font-display text-4xl font-bold text-coral-deep sm:text-5xl">
                    {/* Se vuelve a armar cuando este producto queda a la vista: así el precio baja contando en cada uno. */}
                    <CountPrice key={active === i ? "on" : "off"} fromCents={p.magazineCents} toCents={p.saleCents} />
                  </p>
                  <p className="mt-1 font-bold text-botanical-deep">−{p.discountPercent}% que en la revista</p>
                  <span className="mt-4 inline-flex min-h-12 items-center rounded-full bg-coral-deep px-6 text-base font-extrabold text-white shadow-soft">Lo quiero</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {items.length > 1 ? (
          <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Elegir producto">
            {items.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active === i}
                aria-label={`Ver ${p.name}`}
                onClick={() => {
                  pause();
                  go(i);
                }}
                className="flex size-6 items-center justify-center"
              >
                <span className={`block h-2.5 rounded-full transition-all duration-300 ${active === i ? "w-7 bg-coral-deep" : "w-2.5 bg-coral-deep/30"}`} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
