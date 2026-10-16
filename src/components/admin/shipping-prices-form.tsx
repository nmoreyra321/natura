"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { raiseShippingPrices, saveShippingPrices } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { parseMoney } from "@/lib/validation";

/** Precio del envío a domicilio de cada localidad, y un botón para subirlos todos un %. */
export function ShippingPricesForm({ zones }: { zones: { id: string; name: string; price: number }[] }) {
  const router = useRouter();
  const [values, setValues] = useState(() => Object.fromEntries(zones.map((z) => [z.id, String(z.price).replace(".", ",")])));
  const [percent, setPercent] = useState("");
  const [pending, start] = useTransition();

  const done = (res: { ok: true; message?: string } | { ok: false; error: string }) => {
    if (res.ok) {
      toast.success(res.message ?? "Guardado.");
      router.refresh();
    } else toast.error(res.error);
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const list = zones.map((z) => ({ id: z.id, price: values[z.id]?.trim() ? parseMoney(values[z.id]) : 0 }));
          start(async () => done(await saveShippingPrices(list)));
        }}
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {zones.map((z) => (
            <li key={z.id}>
              <label className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-line">
                {z.name}
                <span className="flex items-center gap-1">
                  $
                  <input
                    inputMode="decimal"
                    value={values[z.id] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [z.id]: e.target.value }))}
                    className="h-9 w-24 rounded-xl border border-line bg-white px-2 text-right tabular"
                    aria-label={`Precio del envío a ${z.name}`}
                  />
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button type="submit" disabled={pending} className={buttonClasses("secondary", "md", "mt-3")}>
          Guardar precios
        </button>
      </form>

      <form
        className="flex flex-wrap items-end gap-2 rounded-2xl bg-cream p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const p = Number(percent.replace(",", "."));
          start(async () => {
            done(await raiseShippingPrices(p));
            setPercent("");
          });
        }}
      >
        <label className="flex flex-col text-sm font-semibold">
          ¿Aumentó la nafta? Subí todos los envíos un
          <span className="mt-1 flex items-center gap-1">
            <input
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="10"
              className="h-10 w-20 rounded-xl border border-line bg-white px-2 text-right tabular"
            />
            %
          </span>
        </label>
        <button type="submit" disabled={pending || !percent.trim()} className={buttonClasses("outline", "sm", "h-10")}>
          Subir todos
        </button>
        <p className="w-full text-xs text-muted">Se redondea a $100. Para bajarlos, poné un número negativo (por ejemplo -10).</p>
      </form>
    </div>
  );
}
