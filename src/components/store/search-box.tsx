"use client";

import { Loader2, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { SearchSuggestion } from "@/lib/catalog";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { toCents } from "@/lib/pricing";
import { ProductImageFallback } from "./product-card";

type State = { status: "idle" | "loading" | "done" | "error"; term: string; results: SearchSuggestion[] };

/** Pide sugerencias mientras se escribe (con una pequeña espera). */
function useSuggestions(term: string) {
  const [state, setState] = useState<State>({ status: "idle", term: "", results: [] });

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, status: "loading" }));
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = (await res.json()) as { results?: SearchSuggestion[] };
        setState({ status: res.ok ? "done" : "error", term, results: data.results ?? [] });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState({ status: "error", term, results: [] });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const results = term.length >= 2 && state.term === term ? state.results : [];
  const loading = state.status === "loading" || (term.length >= 2 && state.term !== term);
  return { results, loading, error: state.status === "error" };
}

const PLACEHOLDERS = ["perfumes…", "cremas para manos…", "labiales…", "desodorantes…", "kits de regalo…"];

/** Placeholder que se escribe solo mientras el buscador está vacío y sin tocar. */
function useTypedPlaceholder(enabled: boolean): string {
  const [text, setText] = useState("Buscar perfumes, cremas, kits…");
  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let word = 0;
    let chars = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const w = PLACEHOLDERS[word];
      setText(`Buscar ${w.slice(0, chars)}`);
      let wait = deleting ? 40 : 85;
      if (!deleting && chars < w.length) chars++;
      else if (!deleting) {
        deleting = true;
        wait = 1300;
      } else if (chars > 0) chars--;
      else {
        deleting = false;
        word = (word + 1) % PLACEHOLDERS.length;
        wait = 300;
      }
      timer = setTimeout(tick, wait);
    };
    timer = setTimeout(tick, 600);
    return () => {
      clearTimeout(timer);
      setText("Buscar perfumes, cremas, kits…");
    };
  }, [enabled]);
  return text;
}

/** Cierra el panel al tocar afuera. */
function useCloseOnOutside(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, ref, close]);
}

/** Lista desplegable de sugerencias con foto y precio. */
function SuggestionsPanel({
  listId,
  term,
  results,
  loading,
  error,
  active,
  setActive,
  onPick,
  onSeeAll,
}: {
  listId: string;
  term: string;
  results: SearchSuggestion[];
  loading: boolean;
  error: boolean;
  active: number;
  setActive: (i: number) => void;
  onPick: () => void;
  onSeeAll: () => void;
}) {
  return (
    <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-3xl border-2 border-forest bg-warm-white text-left shadow-[4px_4px_0_var(--forest)] md:min-w-[22rem]">
      {results.length > 0 ? (
        <>
        <p className="border-b border-line px-4 py-2 text-xs font-bold text-muted">
          {results.length === 1 ? "1 producto" : `${results.length >= 30 ? "Más de 30" : results.length} productos`}
          {results.length > 4 ? " · deslizá para ver más" : ""}
        </p>
        <ul
          id={listId}
          role="listbox"
          aria-label="Sugerencias"
          className="max-h-[55vh] overflow-y-auto overscroll-contain p-1.5"
        >
          {results.map((r, i) => {
            const src = r.image ? productImageUrl(r.image) : null;
            const sale = toCents(r.salePrice);
            const mag = toCents(r.magazinePrice);
            return (
              <li key={r.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <Link
                  href={`/productos/${r.slug}`}
                  onClick={onPick}
                  onMouseEnter={() => setActive(i)}
                  tabIndex={-1}
                  style={{ "--i": i } as React.CSSProperties}
                  className={`animate-sug-in flex items-center gap-3 rounded-2xl p-2 ${i === active ? "bg-sun/60" : "hover:bg-sun/40"}`}
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
                      <span className="font-bold whitespace-nowrap text-coral-deep">{formatARS(sale)}</span>
                      {mag > sale ? <span className="ml-1.5 text-xs whitespace-nowrap text-muted line-through">{formatARS(mag)}</span> : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        </>
      ) : (
        <p id={listId} className="flex items-center gap-2 px-4 py-3 text-sm text-muted" role="status">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Buscando…
            </>
          ) : error ? (
            "No pudimos buscar ahora. Probá de nuevo."
          ) : (
            `No encontramos productos para “${term}”.`
          )}
        </p>
      )}
      {results.length > 0 ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="block w-full border-t border-line px-4 py-2.5 text-left text-sm font-bold text-coral-deep hover:bg-blush"
        >
          Ver todos los resultados para “{term}”
        </button>
      ) : null}
    </div>
  );
}

/** Teclas ↑ ↓ Esc para moverse por las sugerencias. Devuelve true si la tecla se usó. */
function navigate(
  e: React.KeyboardEvent,
  count: number,
  setActive: React.Dispatch<React.SetStateAction<number>>,
  close: () => void,
): boolean {
  if (e.key === "ArrowDown" && count) {
    e.preventDefault();
    setActive((i) => (i + 1) % count);
    return true;
  }
  if (e.key === "ArrowUp" && count) {
    e.preventDefault();
    setActive((i) => (i <= 0 ? count - 1 : i - 1));
    return true;
  }
  if (e.key === "Escape") {
    close();
    setActive(-1);
    return true;
  }
  return false;
}

/** Buscador con sugerencias mientras se escribe. Enter sin elegir una sugerencia busca en el catálogo. */
export function SearchBox({ onDone, autoFocus = false }: { onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-sugerencias`;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLFormElement>(null);
  const term = q.trim();
  const { results, loading, error } = useSuggestions(term);
  const showPanel = open && term.length >= 2;
  const close = useCallback(() => setOpen(false), []);
  useCloseOnOutside(open, rootRef, close);
  const placeholder = useTypedPlaceholder(q === "" && !open && !autoFocus);

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
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          navigate(e, results.length, setActive, close);
        }}
        placeholder={placeholder}
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
        <SuggestionsPanel
          listId={listId}
          term={term}
          results={results}
          loading={loading}
          error={error}
          active={active}
          setActive={setActive}
          onPick={finish}
          onSeeAll={goToSearch}
        />
      ) : null}
    </form>
  );
}

/**
 * Campo "Buscar" del catálogo (dentro del formulario de filtros): muestra sugerencias con foto
 * mientras se escribe. Enter sin elegir sugerencia filtra el catálogo como siempre.
 */
export function CatalogSearchField({ id, defaultValue = "" }: { id: string; defaultValue?: string }) {
  const router = useRouter();
  const listId = `${id}-sugerencias`;
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const term = q.trim();
  // Solo busca cuando la persona escribe (no al cargar la página con una búsqueda hecha).
  const { results, loading, error } = useSuggestions(open ? term : "");
  const showPanel = open && term.length >= 2;
  const close = useCallback(() => setOpen(false), []);
  useCloseOnOutside(open, rootRef, close);

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        name="q"
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
          setActive(-1);
        }}
        onKeyDown={(e) => {
          if (navigate(e, results.length, setActive, close)) return;
          if (e.key === "Enter" && active >= 0 && results[active]) {
            e.preventDefault();
            setOpen(false);
            router.push(`/productos/${results[active].slug}`);
          } else if (e.key === "Enter") {
            setOpen(false);
          }
        }}
        placeholder="Nombre del producto"
        maxLength={80}
        enterKeyHint="search"
        className="h-11 w-full rounded-2xl border border-line bg-white px-4 text-base text-forest placeholder:text-muted/70 focus:border-botanical focus:ring-3 focus:ring-botanical/20 focus:outline-none"
      />
      {showPanel ? (
        <SuggestionsPanel
          listId={listId}
          term={term}
          results={results}
          loading={loading}
          error={error}
          active={active}
          setActive={setActive}
          onPick={() => setOpen(false)}
          onSeeAll={() => {
            setOpen(false);
            router.push(`/productos?q=${encodeURIComponent(term)}`);
          }}
        />
      ) : null}
    </div>
  );
}
