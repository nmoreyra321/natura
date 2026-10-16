"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveShippingSettings } from "@/app/admin/actions";
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
  zones: { id: string; name: string; percent: number }[];
  minTotal: number;
}) {
  const router = useRouter();
  const [values, setValues] = useState(() => Object.fromEntries(zones.map((z) => [z.id, String(z.percent).replace(".", ",")])));
  const [min, setMin] = useState(String(minTotal).replace(".", ","));
  const [pending, start] = useTransition();
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
        Envío solo para compras desde
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
              <label className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-line">
                <span>
                  {z.name}
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
            </li>
          ))}
        </ul>
      </div>
      <button type="submit" disabled={pending} className={buttonClasses("secondary", "md", "w-fit")}>
        Guardar envíos
      </button>
    </form>
  );
}
