"use client";

import { Loader2, Minus, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { registerManualSale, searchProductsForSale, type SaleProductOption } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { toCents } from "@/lib/pricing";
import { parseMoney } from "@/lib/validation";

type Line = SaleProductOption & { quantity: number; price: string };

const CHANNELS = [
  { value: "facebook", label: "Vivo de Facebook" },
  { value: "presencial", label: "En persona" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "otro", label: "Otro" },
] as const;

type Channel = (typeof CHANNELS)[number]["value"];

/** Carga rápida de una venta hecha por fuera de la tienda. Descuenta stock al registrarla. */
export function QuickSale() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SaleProductOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<Channel>("facebook");
  const [method, setMethod] = useState<"efectivo" | "transferencia">("transferencia");
  const [paidAll, setPaidAll] = useState(true);
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");
  const [delivered, setDelivered] = useState(false);
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  // Búsqueda mientras escribe (con una pequeña espera para no buscar en cada letra).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await searchProductsForSale(term);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);
  const visibleResults = q.trim().length >= 2 ? results : [];

  const totalCents = lines.reduce((sum, l) => {
    const price = parseMoney(l.price);
    return sum + (Number.isFinite(price) ? toCents(price) : 0) * l.quantity;
  }, 0);

  const add = (p: SaleProductOption) => {
    setLines((prev) => {
      const found = prev.find((l) => l.id === p.id);
      if (found) return prev.map((l) => (l.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { ...p, quantity: 1, price: String(p.salePrice).replace(".", ",") }];
    });
    setQ("");
    setResults([]);
    setSearching(false);
    searchRef.current?.focus();
  };

  const update = (id: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const reset = () => {
    setLines([]);
    setCustomer("");
    setPhone("");
    setPaidAll(true);
    setPaid("");
    setNote("");
    setDelivered(false);
  };

  const submit = () =>
    start(async () => {
      const amountPaid = paidAll ? totalCents / 100 : parseMoney(paid || "0");
      if (!paidAll && !Number.isFinite(amountPaid)) {
        toast.error("Revisá cuánto te pagó.");
        return;
      }
      const res = await registerManualSale({
        items: lines.map((l) => ({ productId: l.id, quantity: l.quantity, unitPrice: parseMoney(l.price) })),
        customerName: customer,
        customerPhone: phone,
        channel,
        paymentMethod: method,
        amountPaid,
        paymentNote: note,
        delivered,
      });
      if (res.ok) {
        toast.success(res.message ?? "Venta registrada.");
        reset();
      } else {
        toast.error(res.error);
      }
    });

  const chip = (active: boolean) =>
    `rounded-full border-2 px-3 py-2 text-sm font-bold transition-colors ${active ? "border-forest bg-sun/70" : "border-line bg-white hover:bg-cream"}`;
  const overStock = lines.filter((l) => l.quantity > l.stock);

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Productos */}
      <section className="rounded-3xl bg-warm-white p-4 shadow-soft">
        <h2 className="font-display text-lg font-bold">1. ¿Qué vendiste?</h2>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="vr-buscar" className="sr-only">
            Buscar producto
          </label>
          <input
            id="vr-buscar"
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSearching(e.target.value.trim().length >= 2);
            }}
            placeholder="Buscá el producto (ej.: kaiak)"
            autoComplete="off"
            className="h-12 w-full rounded-full border border-line bg-white pr-10 pl-10 text-base focus:border-botanical focus:ring-3 focus:ring-botanical/20 focus:outline-none"
          />
          {searching ? <Loader2 className="absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2 animate-spin text-muted" /> : null}
        </div>
        {visibleResults.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 rounded-2xl border border-line bg-white p-1">
            {visibleResults.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sun/50"
                >
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImageUrl(p.image) ?? undefined} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="size-11 shrink-0 rounded-lg bg-cream" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm leading-snug font-semibold">{p.name}</span>
                    <span className="text-xs text-muted">
                      {p.size ? `${p.size} · ` : ""}
                      {formatARS(toCents(p.salePrice))} · stock {p.stock}
                    </span>
                  </span>
                  <Plus className="size-5 shrink-0 text-botanical-deep" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : q.trim().length >= 2 && !searching ? (
          <p className="mt-2 text-sm text-muted">No encontramos productos con ese nombre.</p>
        ) : null}

        {lines.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {lines.map((l) => (
              <li key={l.id} className="rounded-2xl border border-line bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-snug font-semibold">
                    {l.name}
                    {l.size ? <span className="font-normal text-muted"> · {l.size}</span> : null}
                  </p>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-coral-soft hover:text-coral-deep"
                    aria-label={`Quitar ${l.name}`}
                  >
                    <Trash2 className="size-4.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex h-11 items-center rounded-full border border-line">
                    <button
                      type="button"
                      onClick={() => update(l.id, { quantity: Math.max(1, l.quantity - 1) })}
                      className="inline-flex size-11 items-center justify-center rounded-full hover:bg-forest/5"
                      aria-label={`Restar uno a ${l.name}`}
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <span className="w-8 text-center font-bold tabular">{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => update(l.id, { quantity: Math.min(1000, l.quantity + 1) })}
                      className="inline-flex size-11 items-center justify-center rounded-full hover:bg-forest/5"
                      aria-label={`Sumar uno a ${l.name}`}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <label className="flex items-center gap-1 text-sm">
                    <span className="text-muted">c/u $</span>
                    <input
                      inputMode="decimal"
                      value={l.price}
                      onChange={(e) => update(l.id, { price: e.target.value })}
                      aria-label={`Precio de ${l.name}`}
                      className="h-10 w-24 rounded-xl border border-line px-2 text-right font-semibold tabular"
                    />
                  </label>
                </div>
                {l.quantity > l.stock ? (
                  <p className="mt-1.5 text-xs font-semibold text-coral-deep">
                    Tenés {l.stock} cargados en stock: va a quedar en 0.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Buscá y tocá cada producto que vendiste. Si vendió más de uno, usá el +.</p>
        )}
      </section>

      {/* 2. Cliente y canal */}
      <section className="rounded-3xl bg-warm-white p-4 shadow-soft">
        <h2 className="font-display text-lg font-bold">2. ¿A quién y dónde?</h2>
        <label htmlFor="vr-cliente" className="mt-3 block text-sm font-semibold">
          Nombre de la clienta <span className="font-normal text-muted">(opcional)</span>
        </label>
        <input
          id="vr-cliente"
          value={customer}
          maxLength={80}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Ej.: Laura Gómez"
          className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base"
        />
        <label htmlFor="vr-tel" className="mt-3 block text-sm font-semibold">
          WhatsApp de la clienta <span className="font-normal text-muted">(opcional: para recordarle si queda debiendo, y si tiene cuenta suma al Club)</span>
        </label>
        <input
          id="vr-tel"
          type="tel"
          inputMode="tel"
          value={phone}
          maxLength={20}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Ej.: 11 2345-6789"
          className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base"
        />
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Dónde se vendió">
          {CHANNELS.map((c) => (
            <button key={c.value} type="button" role="radio" aria-checked={channel === c.value} onClick={() => setChannel(c.value)} className={chip(channel === c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* 3. Pago y entrega */}
      <section className="rounded-3xl bg-warm-white p-4 shadow-soft">
        <h2 className="font-display text-lg font-bold">3. Pago y entrega</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de pago">
          {(["transferencia", "efectivo"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={chip(method === m)}>
              {m === "efectivo" ? "Efectivo" : "Transferencia"}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Cuánto pagó">
          <button type="button" role="radio" aria-checked={paidAll} onClick={() => setPaidAll(true)} className={chip(paidAll)}>
            Pagó todo
          </button>
          <button type="button" role="radio" aria-checked={!paidAll} onClick={() => setPaidAll(false)} className={chip(!paidAll)}>
            Pagó una parte o nada
          </button>
        </div>
        {!paidAll ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr]">
            <label className="flex flex-col text-sm font-semibold">
              ¿Cuánto pagó?
              <span className="mt-1 flex items-center gap-1">
                $
                <input
                  inputMode="decimal"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  placeholder="0"
                  className="h-11 w-28 rounded-xl border border-line bg-white px-2 tabular"
                />
              </span>
            </label>
            <label className="flex flex-col text-sm font-semibold">
              Nota <span className="sr-only">del cobro</span>
              <input
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej.: el resto el lunes"
                className="mt-1 h-11 rounded-xl border border-line bg-white px-3 font-normal"
              />
            </label>
          </div>
        ) : null}
        <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={delivered}
            onChange={(e) => setDelivered(e.target.checked)}
            className="size-5 accent-[var(--coral-deep)]"
          />
          Ya lo entregué
        </label>
      </section>

      {/* Total y registrar */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t-2 border-forest bg-cream/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-3xl sm:border-2">
        <div className="flex items-baseline justify-between">
          <span className="font-bold">Total de la venta</span>
          <span className="text-2xl font-extrabold text-coral-deep tabular">{formatARS(totalCents)}</span>
        </div>
        {overStock.length > 0 ? (
          <p className="mt-1 text-xs text-coral-deep">
            Ojo: {overStock.length === 1 ? "un producto supera" : `${overStock.length} productos superan`} el stock cargado.
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending || lines.length === 0 || totalCents <= 0}
          onClick={submit}
          className={buttonClasses("primary", "lg", "mt-2 w-full")}
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ShoppingBag className="size-5" aria-hidden="true" />}
          Registrar venta y descontar stock
        </button>
      </div>
    </div>
  );
}
