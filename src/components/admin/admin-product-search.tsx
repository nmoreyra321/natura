"use client";

import { Loader2, PackagePlus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { searchAdminProducts, type AdminSearchOption } from "@/app/admin/actions";
import { ProductImageFallback } from "@/components/store/product-card";
import { inputClasses } from "@/components/ui/fields";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";

/**
 * Campo "Buscar" del panel con sugerencias con foto mientras se escribe (como en la tienda).
 * Tocar una sugerencia abre el producto (o lo filtra en "Cargar stock"); Enter filtra la lista.
 */
export function AdminProductSearch({
  id,
  defaultValue = "",
  placeholder = "Buscar por nombre",
  mode = "edit",
}: {
  id: string;
  defaultValue?: string;
  placeholder?: string;
  /** "edit": abre la edición del producto. "stock": muestra ese producto en Cargar stock. */
  mode?: "edit" | "stock";
}) {
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ term: string; results: AdminSearchOption[] }>({ term: "", results: [] });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = q.trim();
  const listId = `${id}-sugerencias`;

  useEffect(() => {
    if (!open || term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await searchAdminProducts(term);
      if (!cancelled) setState({ term, results });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, open]);

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  const showPanel = open && term.length >= 2;
  const loading = showPanel && state.term !== term;
  const results = state.term === term ? state.results : [];
  const hrefFor = (p: AdminSearchOption) =>
    mode === "stock" ? `/admin/productos?q=${encodeURIComponent(p.name)}` : `/admin/productos/${p.id}`;

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={listId}
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "Enter") close();
        }}
        placeholder={placeholder}
        maxLength={80}
        className={`${inputClasses} h-10 pr-9 text-sm`}
      />
      {q ? (
        <button
          type="button"
          onClick={() => {
            setQ("");
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-forest/5"
          aria-label="Borrar búsqueda"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}

      {showPanel ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-lift md:min-w-[26rem]">
          {results.length > 0 ? (
            <>
              <p className="border-b border-line px-3 py-1.5 text-xs font-bold text-muted">
                {results.length >= 30 ? "Más de 30" : results.length} {results.length === 1 ? "producto" : "productos"}
                {results.length > 5 ? " · deslizá para ver más" : ""} · Enter para filtrar la lista
              </p>
              <ul id={listId} role="listbox" aria-label="Sugerencias" className="max-h-[55vh] overflow-y-auto overscroll-contain p-1">
                {results.map((p) => {
                  const src = p.image ? productImageUrl(p.image) : null;
                  return (
                    <li key={p.id} role="option" aria-selected={false}>
                      <Link href={hrefFor(p)} onClick={close} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-cream">
                        <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-white">
                          {src ? <Image src={src} alt="" fill sizes="44px" className="object-cover" /> : <ProductImageFallback className="size-full" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-sm font-semibold">{p.name}</span>
                          <span className="flex flex-wrap gap-x-2 text-xs text-muted tabular">
                            <span className="font-bold text-forest">{formatARS(Math.round(p.salePrice * 100))}</span>
                            <span>{p.stock > 0 ? `Stock ${p.stock}` : "Sin stock"}</span>
                            {p.status !== "published" ? <span className="rounded-full bg-cream px-1.5 font-bold">Borrador</span> : null}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div id={listId} role="status" className="px-3 py-3 text-sm text-muted">
              {loading ? (
                <p className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Buscando…
                </p>
              ) : (
                <>
                  <p>No hay productos con “{term}”.</p>
                  <Link
                    href={`/admin/productos?q=${encodeURIComponent(term)}&crear=1`}
                    onClick={close}
                    className="mt-2 flex items-center gap-2 rounded-xl bg-sage px-3 py-2 font-bold text-botanical-deep hover:bg-botanical-deep hover:text-white"
                  >
                    <PackagePlus className="size-4 shrink-0" aria-hidden="true" /> Agregar “{term}” como producto nuevo
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
