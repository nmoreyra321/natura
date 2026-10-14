"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { addProductLot, searchProductsForLots, type LotProductOption } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { productImageUrl } from "@/lib/images";
import { formatExpiry, monthsLeft, parseExpiry } from "@/lib/lots";

const monthName = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

/** "0129" → "01/29" mientras se escribe. */
function maskExpiry(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

type Loaded = { key: number; name: string; expiry: string; quantity: number };

/**
 * Carga rápida de vencimientos con el teclado:
 * nombre → Enter → vencimiento (0129) → Enter. El cursor vuelve al buscador.
 */
export function LotQuickEntry() {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<LotProductOption[]>([]);
  const [active, setActive] = useState(0);
  const [product, setProduct] = useState<LotProductOption | null>(null);
  const [expiry, setExpiry] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);

  const term = q.trim();
  useEffect(() => {
    if (product || term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await searchProductsForLots(term);
      if (!cancelled) {
        setOptions(res);
        setActive(0);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, product]);

  const choose = (p: LotProductOption) => {
    setProduct(p);
    setQ(p.name);
    setOptions([]);
    // Si ya hay un vencimiento escrito (el del producto anterior), queda seleccionado para pisarlo o reusarlo.
    setTimeout(() => {
      expiryRef.current?.focus();
      expiryRef.current?.select();
    }, 0);
  };

  const parsed = parseExpiry(expiry);
  const qty = Number(quantity);
  const ready = Boolean(product && parsed && Number.isInteger(qty) && qty >= 1);

  const submit = () => {
    if (!product) {
      toast.error("Elegí un producto de la lista.");
      searchRef.current?.focus();
      return;
    }
    if (!parsed) {
      toast.error("Escribí el vencimiento como en el envase, por ejemplo 01/29.");
      expiryRef.current?.focus();
      return;
    }
    start(async () => {
      const res = await addProductLot(product.id, expiry, qty);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLoaded((prev) => [{ key: Date.now(), name: product.name, expiry: formatExpiry(parsed), quantity: qty }, ...prev].slice(0, 8));
      setProduct(null);
      setQ("");
      setQuantity("1");
      router.refresh();
      searchRef.current?.focus();
    });
  };

  const showOptions = !product && term.length >= 2 && options.length > 0;
  const left = parsed ? monthsLeft(parsed) : null;

  return (
    <section aria-labelledby="carga" className="rounded-3xl border-2 border-forest bg-warm-white p-5 shadow-[4px_4px_0_var(--forest)]">
      <h2 id="carga" className="font-display text-xl font-bold">
        Cargar vencimientos
      </h2>
      <p className="text-sm text-muted">
        Escribí el producto, Enter, el vencimiento como figura en el envase (por ejemplo <strong>0129</strong> para 01/29) y Enter.
      </p>

      <form
        className="mt-4 grid gap-3 md:grid-cols-[1fr_9rem_6rem_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="relative">
          <label htmlFor="lote-producto" className="text-sm font-semibold">
            Producto
          </label>
          <input
            id="lote-producto"
            ref={searchRef}
            autoFocus
            autoComplete="off"
            role="combobox"
            aria-expanded={showOptions}
            aria-controls={listId}
            aria-activedescendant={showOptions ? `${listId}-${active}` : undefined}
            value={q}
            placeholder="Ej.: kaiak clasico"
            onChange={(e) => {
              setQ(e.target.value);
              setProduct(null);
            }}
            onKeyDown={(e) => {
              if (!showOptions) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => (i + 1) % options.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(options[active]);
              }
            }}
            className={`mt-1 h-11 w-full rounded-full border bg-white px-4 text-base focus:ring-3 focus:ring-botanical/20 focus:outline-none ${product ? "border-botanical" : "border-line"}`}
          />
          {product ? <Check className="absolute right-3 bottom-3 size-5 text-botanical-deep" aria-hidden="true" /> : null}
          {showOptions ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute top-full right-0 left-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-2xl border-2 border-forest bg-white p-1 shadow-lift"
            >
              {options.map((o, i) => {
                const src = o.image ? productImageUrl(o.image) : null;
                return (
                  <li
                    key={o.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      choose(o);
                    }}
                    onPointerEnter={() => setActive(i)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl p-2 text-sm ${i === active ? "bg-sun/60" : ""}`}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="size-9 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="size-9 shrink-0 rounded-lg bg-cream" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-semibold">{o.name}</span>
                      {o.size ? <span className="text-muted">{o.size}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <div>
          <label htmlFor="lote-vence" className="text-sm font-semibold">
            Vence (MM/AA)
          </label>
          <input
            id="lote-vence"
            ref={expiryRef}
            inputMode="numeric"
            autoComplete="off"
            placeholder="01/29"
            value={expiry}
            onChange={(e) => setExpiry(maskExpiry(e.target.value))}
            aria-invalid={expiry.length >= 5 && !parsed}
            aria-describedby="lote-vence-ayuda"
            className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base tabular focus:ring-3 focus:ring-botanical/20 focus:outline-none aria-[invalid=true]:border-coral-deep"
          />
        </div>

        <div>
          <label htmlFor="lote-cantidad" className="text-sm font-semibold">
            Cantidad
          </label>
          <input
            id="lote-cantidad"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base tabular focus:ring-3 focus:ring-botanical/20 focus:outline-none"
          />
        </div>

        <button type="submit" disabled={pending || !ready} className={buttonClasses("primary", "md")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          Guardar
        </button>
      </form>

      <p id="lote-vence-ayuda" className="mt-2 min-h-5 text-sm text-muted" aria-live="polite">
        {parsed
          ? `Vence a fin de ${monthName.format(new Date(`${parsed}T12:00:00Z`))}${
              left !== null ? (left < 0 ? " · ya está vencido" : left === 0 ? " · vence este mes" : ` · faltan ${left} ${left === 1 ? "mes" : "meses"}`) : ""
            }`
          : expiry.length >= 5
            ? "Revisá el mes: tiene que estar entre 01 y 12."
            : ""}
      </p>

      {loaded.length > 0 ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-bold tracking-[0.1em] text-muted uppercase">Recién cargados</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm">
            {loaded.map((l) => (
              <li key={l.key} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-botanical-deep" aria-hidden="true" />
                <span className="min-w-0 flex-1">{l.name}</span>
                <span className="tabular text-muted">
                  {l.quantity} u. · {l.expiry}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
