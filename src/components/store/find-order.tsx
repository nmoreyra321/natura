"use client";

import { ChevronRight, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { findOrder, myOrdersStatus, type FindOrderState, type MyOrderStatus } from "@/app/(tienda)/pedido/actions";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { buttonClasses } from "@/components/ui/button";
import { formatARS } from "@/lib/format";
import { forgetOrder, useSavedOrders, type SavedOrder } from "@/lib/my-orders";
import { Required, RequiredNote } from "./required";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** Pedidos hechos desde este celular + búsqueda por código y WhatsApp. */
const TONE = { good: "bg-sage text-botanical-deep", wait: "bg-sun text-forest", bad: "bg-coral-soft text-coral-deep" } as const;

export function FindOrder() {
  const saved = useSavedOrders();
  const [state, action, pending] = useActionState<FindOrderState, FormData>(findOrder, null);
  // En qué está cada pedido (si no vuelve, es que ya no existe).
  const [status, setStatus] = useState<Map<string, MyOrderStatus> | null>(null);
  const [removing, setRemoving] = useState<SavedOrder | null>(null);
  const ids = saved.map((o) => o.id).join(",");
  useEffect(() => {
    if (!ids) return;
    let alive = true;
    myOrdersStatus(ids.split(","))
      .then((list) => alive && setStatus(new Map(list.map((s) => [s.id, s]))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ids]);

  return (
    <>
      {saved.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Tus pedidos en este celular</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {saved.map((o) => (
              <li key={o.id} className="flex items-stretch gap-2">
                <Link
                  href={`/pedido/${o.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl bg-warm-white p-4 shadow-soft ring-1 ring-line/70 transition hover:-translate-y-0.5"
                >
                  <span className="min-w-0">
                    <span className="block font-bold">Pedido {o.code}</span>
                    <span className="block text-sm text-muted">
                      {dateFormatter.format(new Date(o.at))}
                      {status?.get(o.id)
                        ? ` · ${status.get(o.id)!.items} ${status.get(o.id)!.items === 1 ? "producto" : "productos"} · ${formatARS(status.get(o.id)!.totalCents)}`
                        : ""}
                    </span>
                    {status ? (
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${status.get(o.id) ? TONE[status.get(o.id)!.tone] : "bg-cream text-muted"}`}
                      >
                        {status.get(o.id)?.label ?? "Ya no está en la tienda"}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-coral-deep" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => setRemoving(o)}
                  className="inline-flex w-10 shrink-0 items-center justify-center rounded-2xl text-muted hover:bg-coral-soft hover:text-coral-deep"
                  aria-label={`Quitar el pedido ${o.code} de esta lista`}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Tocá un pedido para ver qué compraste, cuánto pagaste y en qué está.</p>
        </section>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title={`¿Quitar el pedido ${removing?.code ?? ""} de esta lista?`}
        description="Solo lo sacamos de la lista de este celular: el pedido no se cancela. Para volver a verlo, buscalo abajo con su código y tu WhatsApp."
        confirmLabel="Sí, quitar"
        cancelLabel="No"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) forgetOrder(removing.id);
          setRemoving(null);
        }}
      />

      <form action={action} className="mt-8 flex flex-col gap-4 rounded-3xl bg-warm-white p-5 shadow-soft ring-1 ring-line/70">
        <h2 className="font-display text-xl font-bold">{saved.length > 0 ? "¿Es otro pedido?" : "Buscá tu pedido"}</h2>
        <RequiredNote className="-mt-2" />
        <label className="flex flex-col gap-1 text-sm font-bold">
          <span>
            Código del pedido
            <Required />
          </span>
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
          <span>
            Tu WhatsApp
            <Required />
          </span>
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
