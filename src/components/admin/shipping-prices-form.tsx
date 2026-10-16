"use client";

import { Plus, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addShippingZone, deleteShippingZone, saveShippingSettings, setShippingZoneActive } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { formatARS } from "@/lib/format";
import { shippingCostCents } from "@/lib/delivery";
import { parseMoney } from "@/lib/validation";

const EXAMPLE_CENTS = 40_000_00;

/** Envíos a domicilio: el % de la compra que se cobra en cada localidad y la compra mínima. */
export function ShippingPricesForm({
  zones,
  minTotal,
}: {
  zones: { id: string; name: string; percent: number; is_active: boolean }[];
  minTotal: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState(() => Object.fromEntries(zones.map((z) => [z.id, String(z.percent).replace(".", ",")])));
  const [min, setMin] = useState(String(minTotal).replace(".", ","));
  const [pending, start] = useTransition();
  const [newName, setNewName] = useState("");
  const [newPercent, setNewPercent] = useState("");
  const run = (job: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await job();
      if (res.ok) {
        toast.success(res.message ?? "Listo.");
        after?.();
        router.refresh();
      } else toast.error(res.error ?? "No pudimos hacerlo.");
    });
  const pct = (id: string) => Number((values[id] ?? "").replace(",", ".")) || 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const input = {
          minTotal: min.trim() ? parseMoney(min) : 0,
          zones: zones.map((z) => ({ id: z.id, percent: pct(z.id) })),
        };
        start(async () => {
          const res = await saveShippingSettings(input);
          if (res.ok) {
            toast.success(res.message ?? "Guardado.");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        Compra mínima para pedir envío a domicilio
        <span className="flex items-center gap-1">
          $
          <input
            inputMode="decimal"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-10 w-28 rounded-xl border border-line bg-white px-2 text-right tabular"
          />
        </span>
      </label>
      <div>
        <p className="mb-2 text-sm text-muted">
          % de la compra que se cobra de envío. Entre paréntesis, cuánto sería en una compra de {formatARS(EXAMPLE_CENTS)}.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {zones.map((z) => (
            <li key={z.id}>
              <label
                className={`flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-line ${z.is_active ? "" : "opacity-60"}`}
              >
                <span>
                  {z.name}
                  {z.is_active ? null : <span className="block text-xs font-normal text-coral-deep">Apagada: no se ofrece</span>}
                  <span className="block text-xs font-normal text-muted tabular">
                    ({formatARS(shippingCostCents(EXAMPLE_CENTS, pct(z.id)))})
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <input
                    inputMode="decimal"
                    value={values[z.id] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [z.id]: e.target.value }))}
                    className="h-9 w-16 rounded-xl border border-line bg-white px-2 text-right tabular"
                    aria-label={`% de envío a ${z.name}`}
                  />
                  %
                </span>
              </label>
              <div className="mt-1 flex items-center justify-end gap-3 px-2 text-xs font-semibold">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setShippingZoneActive(z.id, !z.is_active))}
                  className="inline-flex items-center gap-1 text-muted hover:underline"
                >
                  <Power className="size-3" aria-hidden="true" /> {z.is_active ? "Apagar" : "Prender"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`¿Borrar ${z.name}? Los pedidos que ya hiciste no se tocan.`)) run(() => deleteShippingZone(z.id));
                  }}
                  className="inline-flex items-center gap-1 text-coral-deep hover:underline"
                >
                  <Trash2 className="size-3" aria-hidden="true" /> Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <button type="submit" disabled={pending} className={buttonClasses("secondary", "md", "w-fit")}>
        Guardar envíos
      </button>
      <div className="rounded-2xl bg-cream p-3">
        <p className="mb-2 text-sm font-semibold">Agregar una localidad</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej.: Ezeiza"
            maxLength={60}
            className="h-10 min-w-40 flex-1 rounded-xl border border-line bg-white px-3"
            aria-label="Nombre de la localidad"
          />
          <span className="flex items-center gap-1 text-sm">
            <input
              inputMode="decimal"
              value={newPercent}
              onChange={(e) => setNewPercent(e.target.value)}
              placeholder="10"
              className="h-10 w-16 rounded-xl border border-line bg-white px-2 text-right tabular"
              aria-label="% de envío"
            />
            %
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => addShippingZone(newName, Number(newPercent.replace(",", ".")) || 0),
                () => {
                  setNewName("");
                  setNewPercent("");
                },
              )
            }
            className={buttonClasses("outline", "md")}
          >
            <Plus className="size-4" aria-hidden="true" /> Agregar
          </button>
        </div>
      </div>
    </form>
  );
}
