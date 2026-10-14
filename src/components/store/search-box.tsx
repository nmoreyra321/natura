"use client";

import { Loader2, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { SearchSuggestion } from "@/lib/catalog";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { toCents } from "@/lib/pricing";
import { ProductImageFallback } from "./product-card";

type State = { status: "idle" | "loading" | "done" | "error"; term: string; results: SearchSuggestion[] };

/** Buscador con sugerencias mientras se escribe. Enter sin elegir una sugerencia busca en el catálogo. */
export function SearchBox({ onDone, autoFocus = false }: { onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-sugerencias`;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<State>({ status: "idle", term: "", results: [] });
  const rootRef = useRef<HTMLFormElement>(null);

  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, status: "loading" }));
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = (await res.json()) as { results?: SearchSuggestion[] };
        setState({ status: res.ok ? "done" : "error", term, results: data.results ?? [] });
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState({ status: "error", term, results: [] });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const results = term.length >= 2 && state.term === term ? state.results : [];
  const showPanel = open && term.length >= 2;
  const loading = state.status === "loading" || (term.length >= 2 && state.term !== term);

  const finish = () => {
    setOpen(false);
    setQ("");
    onDone?.();
  };

  const goToSearch = () => {
    router.push(term ? `/productos?q=${encodeURIComponent(term)}` : "/productos");
    finish();
  };

  return (
    <form
      ref={rootRef}
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        const chosen = active >= 0 ? results[active] : undefined;
        if (chosen) {
          router.push(`/productos/${chosen.slug}`);
          finish();
        } else {
          goToSearch();
        }
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar productos
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && results.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp" && results.length) {
            e.preventDefault();
            setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
          } else if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
        placeholder="Buscar perfumes, cremas, kits…"
        autoFocus={autoFocus}
        maxLength={80}
        enterKeyHint="search"
        className="h-11 w-full rounded-full border border-line bg-white pr-12 pl-4 text-base text-forest placeholder:text-muted/70 focus:border-botanical focus:ring-3 focus:ring-botanical/20 focus:outline-none"
      />
      <button
        type="submit"
        className="absolute top-1 right-1 inline-flex size-9 items-center justify-center rounded-full bg-botanical-deep text-white transition-colors hover:bg-[#146347]"
        aria-label="Buscar"
      >
        <Search className="size-4.5" aria-hidden="true" />
      </button>

      {showPanel ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-3xl border-2 border-forest bg-warm-white shadow-[4px_4px_0_var(--forest)] md:min-w-[22rem]">
          {results.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Sugerencias" className="max-h-[60vh] overflow-y-auto p-1.5">
              {results.map((r, i) => {
                const src = r.image ? productImageUrl(r.image) : null;
                const sale = toCents(r.salePrice);
                const mag = toCents(r.magazinePrice);
                return (
                  <li key={r.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                    <Link
                      href={`/productos/${r.slug}`}
                      onClick={finish}
                      onMouseEnter={() => setActive(i)}
                      tabIndex={-1}
                      className={`flex items-center gap-3 rounded-2xl p-2 ${i === active ? "bg-sun/60" : "hover:bg-sun/40"}`}
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-white">
                        {src ? (
                          <Image src={src} alt="" fill sizes="48px" className="object-cover" />
                        ) : (
                          <ProductImageFallback className="size-full" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm leading-snug font-semibold">{r.name}</span>
                        <span className="text-sm tabular">
                          <span className="font-bold text-coral-deep">{formatARS(sale)}</span>
                          {mag > sale ? <span className="ml-1.5 text-xs text-muted line-through">{formatARS(mag)}</span> : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p id={listId} className="flex items-center gap-2 px-4 py-3 text-sm text-muted" role="status">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Buscando…
                </>
              ) : state.status === "error" ? (
                "No pudimos buscar ahora. Probá de nuevo."
              ) : (
                `No encontramos productos para “${term}”.`
              )}
            </p>
          )}
          {results.length > 0 ? (
            <button
              type="button"
              onClick={goToSearch}
              className="block w-full border-t border-line px-4 py-2.5 text-left text-sm font-bold text-coral-deep hover:bg-blush"
            >
              Ver todos los resultados para “{term}”
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
