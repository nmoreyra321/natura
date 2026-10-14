"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveMercadoPagoSurcharge } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";

/** % que se le suma a la clienta si paga con Mercado Pago (para no pagar vos la comisión). */
export function SurchargeForm({ defaultPercent }: { defaultPercent: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(defaultPercent));
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveMercadoPagoSurcharge(value);
          if (res.ok) {
            toast.success(res.message ?? "Guardado.");
            router.refresh();
          } else {
            toast.error(res.error);
          }
        });
      }}
    >
      <Field
        label="Recargo para quien paga con Mercado Pago (%)"
        htmlFor="mp-recargo"
        hint="0 = sin recargo. Efectivo y transferencia nunca tienen recargo."
        className="w-full sm:w-auto"
      >
        <div className="flex items-center gap-2">
          <Input id="mp-recargo" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-28" />
          <span className="font-bold">%</span>
        </div>
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
        Guardar recargo
      </Button>
    </form>
  );
}
