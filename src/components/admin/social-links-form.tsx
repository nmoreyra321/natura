"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveSocialLinks } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";

type Values = { facebook: string; instagram: string };

/** Links de Facebook e Instagram que se muestran en «Quiénes somos». */
export function SocialLinksForm({ defaults }: { defaults: Values }) {
  const router = useRouter();
  const [values, setValues] = useState(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSocialLinks(values);
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
      <Field label="Facebook (donde hacés los vivos)" htmlFor="s-fb" error={errors.facebook} hint="Ej.: facebook.com/natumariel">
        <Input id="s-fb" inputMode="url" autoComplete="off" value={values.facebook} onChange={set("facebook")} />
      </Field>
      <Field label="Instagram (opcional)" htmlFor="s-ig" error={errors.instagram} hint="Ej.: instagram.com/natumariel">
        <Input id="s-ig" inputMode="url" autoComplete="off" value={values.instagram} onChange={set("instagram")} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          Guardar redes
        </Button>
      </div>
    </form>
  );
}
