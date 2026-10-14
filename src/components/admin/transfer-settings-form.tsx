"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveTransferSettings } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";

type Values = { alias: string; cbu: string; holder: string; bank: string };

/** Alias / CBU para que las clientas paguen por transferencia, sin comisión. */
export function TransferSettingsForm({ defaults }: { defaults: Values }) {
  const router = useRouter();
  const [values, setValues] = useState(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveTransferSettings(values);
          if (res.ok) {
            setErrors({});
            toast.success(res.message ?? "Guardado.");
            router.refresh();
          } else {
            setErrors(res.fields ?? {});
            toast.error(res.error);
          }
        });
      }}
    >
      <Field label="Alias" htmlFor="t-alias" error={errors.alias} hint="Ej.: natu.mariel.mp">
        <Input id="t-alias" autoComplete="off" value={values.alias} onChange={set("alias")} />
      </Field>
      <Field label="CBU o CVU (opcional)" htmlFor="t-cbu" error={errors.cbu} hint="22 números.">
        <Input id="t-cbu" inputMode="numeric" autoComplete="off" value={values.cbu} onChange={set("cbu")} />
      </Field>
      <Field label="Titular de la cuenta" htmlFor="t-holder" error={errors.holder} hint="Así la clienta ve que es la cuenta correcta.">
        <Input id="t-holder" autoComplete="off" value={values.holder} onChange={set("holder")} />
      </Field>
      <Field label="Banco o billetera (opcional)" htmlFor="t-bank" error={errors.bank} hint="Ej.: Mercado Pago, Banco Nación.">
        <Input id="t-bank" autoComplete="off" value={values.bank} onChange={set("bank")} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          Guardar datos de transferencia
        </Button>
      </div>
    </form>
  );
}
