"use client";

import { Children, useEffect, useRef, useState } from "react";

/**
 * Lista larga que se muestra de a partes: primero `step` filas (carga al instante) y, a medida que
 * se baja, se agregan las siguientes solas. Sigue siendo una sola hoja, sin páginas.
 */
export function ProgressiveList({ children, step = 50, className }: { children: React.ReactNode; step?: number; className?: string }) {
  const items = Children.toArray(children);
  const [shown, setShown] = useState(step);
  const sentinel = useRef<HTMLLIElement>(null);
  const more = shown < items.length;

  useEffect(() => {
    if (!more) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + step);
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, step, shown]);

  return (
    <ul className={className}>
      {items.slice(0, shown)}
      {more ? (
        <li ref={sentinel} className="px-3 py-4 text-center text-sm text-muted">
          Cargando más productos…
        </li>
      ) : null}
    </ul>
  );
}
