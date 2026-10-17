"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type BannerSlide = {
  href: string;
  title: string;
  text: string;
  cta: string;
  /** Clases del degradé de fondo. */
  tone: string;
  /** Foto de un producto (opcional) que flota a la derecha. */
  image?: { src: string; alt: string };
};

/**
 * Cartel deslizable de la portada en el celular: pasa solo cada pocos segundos, se puede
 * arrastrar con el dedo y los puntitos de abajo muestran en cuál está.
 */
export function HomeBanner({ slides }: { slides: BannerSlide[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const pausedUntil = useRef(0);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      const el = ref.current;
      if (!el || Date.now() < pausedUntil.current || document.hidden) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 4200);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;
  return (
    <div>
      <ul
        ref={ref}
        aria-label="Novedades de la tienda"
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onPointerDown={() => (pausedUntil.current = Date.now() + 9000)}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-[1.75rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s) => (
          <li key={s.href} className="w-full shrink-0 snap-start">
            <Link href={s.href} className={`relative flex h-44 flex-col justify-center overflow-hidden bg-gradient-to-br p-5 text-white ${s.tone}`}>
              <span aria-hidden="true" className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full bg-white/15 blur-2xl" />
              <span className="relative max-w-[58%] font-display text-[1.45rem] leading-[1.05] font-bold">{s.title}</span>
              <span className="relative mt-1.5 max-w-[56%] text-sm font-semibold text-white/90">{s.text}</span>
              <span className="relative mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-sm font-extrabold text-coral-deep">
                {s.cta} <ArrowRight className="size-4" aria-hidden="true" />
              </span>
              {s.image ? (
                <span className="animate-float absolute top-1/2 -right-1 block size-[8.5rem] -translate-y-1/2 rotate-6 overflow-hidden rounded-3xl bg-white p-1.5 shadow-lift">
                  <span className="relative block size-full overflow-hidden rounded-[1.1rem] bg-cream">
                    <Image src={s.image.src} alt={s.image.alt} fill sizes="140px" className="object-cover" />
                  </span>
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {slides.length > 1 ? (
        <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden="true">
          {slides.map((s, i) => (
            <span key={s.href} className={`h-[7px] rounded-full transition-all duration-500 ${i === index ? "w-[22px] bg-coral-deep" : "w-[7px] bg-grape/25"}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
