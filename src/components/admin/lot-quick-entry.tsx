"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { addProductLot, receiveStock, searchProductsForLots, type LotProductOption } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { productImageUrl } from "@/lib/images";
import { formatExpiry, maskExpiry, monthsLeft, parseExpiry } from "@/lib/lots";

const monthName = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

type Loaded = { key: number; name: string; expiry: string | null; quantity: number; stock?: number };

/**
 * Carga rápida con el teclado. El cursor vuelve solo al buscador.
 * - "llegada" («Me llegó mercadería», a mano): producto → Enter → cantidad → Enter. Suma al stock;
 *   el vencimiento es opcional y, si se escribe, queda anotado.
 * - "vencimiento": producto → Enter → vencimiento (0129) → Enter. Solo anota el vencimiento de algo
 *   que ya está en el stock (no lo cambia).
 */
export function LotQuickEntry({ mode = "vencimiento" }: { mode?: "llegada" | "vencimiento" }) {
  const arrival = mode === "llegada";
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
  const quantityRef = useRef<HTMLInputElement>(null);

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
      const next = arrival ? quantityRef.current : expiryRef.current;
      next?.focus();
      next?.select();
    }, 0);
  };

  const parsed = parseExpiry(expiry);
  const qty = Number(quantity);
  const expiryOk = arrival ? !expiry.trim() || Boolean(parsed) : Boolean(parsed);
  const ready = Boolean(product && expiryOk && Number.isInteger(qty) && qty >= 1);

  const submit = () => {
    if (!product) {
      toast.error("Elegí un producto de la lista.");
      searchRef.current?.focus();
      return;
    }
    if (!expiryOk) {
      toast.error(arrival ? "Revisá el vencimiento (por ejemplo 01/29) o dejalo vacío." : "Escribí el vencimiento como en el envase, por ejemplo 01/29.");
      expiryRef.current?.focus();
      return;
    }
    start(async () => {
      const res = arrival ? await receiveStock(product.id, qty, expiry, true) : await addProductLot(product.id, expiry, qty);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const stock = arrival && res.data && "stock" in res.data ? res.data.stock : undefined;
      setLoaded((prev) =>
        [{ key: Date.now(), name: product.name, expiry: parsed ? formatExpiry(parsed) : null, quantity: qty, stock }, ...prev].slice(0, 8),
      );
      if (arrival) setExpiry("");
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
        {arrival ? "Cargar a mano" : "Agregar un producto próximo a vencer"}
      </h2>
      <p className="text-sm text-muted">
        {arrival ? (
          <>
            Escribí el producto, Enter, la cantidad que llegó y Enter: <strong>se suma al stock</strong>. Si querés,
            antes de Enter poné el vencimiento (por ejemplo <strong>0129</strong> para 01/29).
          </>
        ) : (
          <>
            Anotá solo los que ves que vencen pronto (no hace falta cargar todos). Escribí el producto, Enter, el
            vencimiento como figura en el envase (por ejemplo <strong>0129</strong> para 01/29) y Enter. El stock no
            cambia: ese producto ya está contado.
          </>
        )}
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

        <div className={arrival ? "order-3" : undefined}>
          <label htmlFor="lote-vence" className="text-sm font-semibold">
            {arrival ? "Vence (opcional)" : "Vence (MM/AA)"}
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
            ref={quantityRef}
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base tabular focus:ring-3 focus:ring-botanical/20 focus:outline-none"
          />
        </div>

        <button type="submit" disabled={pending || !ready} className={buttonClasses("primary", "md", arrival ? "order-4" : "")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {arrival ? "Sumar" : "Guardar"}
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
                  {arrival ? `+${l.quantity}` : `${l.quantity} u.`}
                  {l.expiry ? ` · vence ${l.expiry}` : ""}
                  {l.stock !== undefined ? ` · ahora hay ${l.stock}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
