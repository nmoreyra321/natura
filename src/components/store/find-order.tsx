"use client";

import { ChevronRight, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";

import { findOrder, type FindOrderState } from "@/app/(tienda)/pedido/actions";
import { buttonClasses } from "@/components/ui/button";
import { readSavedOrders, type SavedOrder } from "@/lib/my-orders";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

const NONE: SavedOrder[] = [];
let cached: { raw: string; list: SavedOrder[] } | null = null;
/** Lee los pedidos guardados sin crear una lista nueva en cada render. */
function snapshot(): SavedOrder[] {
  const list = readSavedOrders();
  const raw = JSON.stringify(list);
  if (cached?.raw !== raw) cached = { raw, list };
  return cached.list;
}

/** Pedidos hechos desde este celular + búsqueda por código y WhatsApp. */
export function FindOrder() {
  const saved = useSyncExternalStore(
    () => () => {},
    snapshot,
    () => NONE,
  );
  const [state, action, pending] = useActionState<FindOrderState, FormData>(findOrder, null);

  return (
    <>
      {saved.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Tus pedidos en este celular</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {saved.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/pedido/${o.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-warm-white p-4 shadow-soft ring-1 ring-line/70 transition hover:-translate-y-0.5"
                >
                  <span>
                    <span className="block font-bold">Pedido {o.code}</span>
                    <span className="block text-sm text-muted">{dateFormatter.format(new Date(o.at))}</span>
                  </span>
                  <ChevronRight className="size-5 text-coral-deep" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action={action} className="mt-8 flex flex-col gap-4 rounded-3xl bg-warm-white p-5 shadow-soft ring-1 ring-line/70">
        <h2 className="font-display text-xl font-bold">{saved.length > 0 ? "¿Es otro pedido?" : "Buscá tu pedido"}</h2>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Código del pedido
          <input
            name="code"
            required
            autoCapitalize="characters"
            placeholder="NM-1A2B3C"
            className="h-12 rounded-2xl border border-line bg-white px-4 text-base font-normal uppercase focus:border-botanical focus:outline-none"
          />
          <span className="font-normal text-muted">Está en la página de tu pedido y en el mensaje de WhatsApp.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Tu WhatsApp
          <input
            name="phone"
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="11 2345-6789"
            className="h-12 rounded-2xl border border-line bg-white px-4 text-base font-normal focus:border-botanical focus:outline-none"
          />
          <span className="font-normal text-muted">El mismo que pusiste al hacer el pedido.</span>
        </label>
        {state?.error ? (
          <p className="text-sm font-semibold text-coral-deep" role="alert">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Search className="size-5" aria-hidden="true" />}
          Ver mi pedido
        </button>
      </form>
    </>
  );
}
