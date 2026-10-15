"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

/**
 * En el celular, el buscador va solo con un botón «Filtros» al lado; el resto se abre al tocarlo.
 * En la computadora se ve todo siempre (como antes).
 */
export function CatalogFiltersToggle({
  search,
  activeCount,
  children,
}: {
  search: React.ReactNode;
  /** Filtros aplicados (además de la búsqueda), para mostrarlos en el botón. */
  activeCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="col-span-2 flex items-end gap-2 md:col-span-1">
        <div className="min-w-0 flex-1">{search}</div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="filtros-extra"
          className={`relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 text-sm font-bold md:hidden ${open || activeCount > 0 ? "border-forest bg-forest text-white" : "border-line bg-white text-forest"}`}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filtros
          {activeCount > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-sun text-xs text-forest tabular">{activeCount}</span>
          ) : (
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          )}
        </button>
      </div>
      <div id="filtros-extra" className={open ? "contents" : "hidden md:contents"}>
        {children}
      </div>
    </>
  );
}
