"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, cloneElement, isValidElement, useCallback, useEffect, useRef } from "react";

/**
 * Fila única que se desliza para los dos lados y no termina nunca: los elementos se repiten
 * (copia antes y después) y, al llegar a una copia, se salta sin que se note a la del medio.
 */
export function InfiniteCarousel({ children, label }: { children: React.ReactNode; label: string }) {
  const items = Children.toArray(children);
  const ref = useRef<HTMLUListElement>(null);

  const setWidth = useCallback(() => (ref.current ? ref.current.scrollWidth / 3 : 0), []);

  /** Salta sin animación (para que el cambio de copia no se vea). */
  const jumpTo = useCallback((left: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.scrollBehavior = "auto";
    el.scrollLeft = left;
    el.style.scrollBehavior = "";
  }, []);

  // Arranca en la copia del medio.
  useEffect(() => {
    jumpTo(setWidth());
  }, [jumpTo, setWidth, items.length]);

  const recenter = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const w = setWidth();
    if (w <= 0) return;
    if (el.scrollLeft < w * 0.5) jumpTo(el.scrollLeft + w);
    else if (el.scrollLeft > w * 1.5) jumpTo(el.scrollLeft - w);
  }, [jumpTo, setWidth]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recenter, 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [recenter]);

  const move = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (items.length === 0) return null;
  const copy = (prefix: string, hidden: boolean) =>
    items.map((child, i) =>
      isValidElement<{ "aria-hidden"?: boolean; inert?: boolean }>(child)
        ? cloneElement(child, { key: `${prefix}-${i}`, ...(hidden ? { "aria-hidden": true, inert: true } : {}) })
        : child,
    );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => move(-1)}
        className="absolute top-[38%] -left-2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-forest shadow-lift ring-1 ring-line hover:bg-sun sm:flex"
        aria-label={`${label}: ver anteriores`}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <ul
        ref={ref}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pt-2 pb-2 [scrollbar-width:none] sm:mx-0 sm:gap-4 sm:px-1 [&::-webkit-scrollbar]:hidden"
      >
        {copy("a", true)}
        {copy("b", false)}
        {copy("c", true)}
      </ul>
      <button
        type="button"
        onClick={() => move(1)}
        className="absolute top-[38%] -right-2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-forest shadow-lift ring-1 ring-line hover:bg-sun sm:flex"
        aria-label={`${label}: ver siguientes`}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
