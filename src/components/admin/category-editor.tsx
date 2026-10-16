"use client";

import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCategory, saveCategory, type ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";
import { ConfirmDialog } from "./confirm-dialog";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  is_visible: boolean;
};

export function CategoryEditor({ category, counts }: { category: Category | null; counts: { total: number; published: number } }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveCategory.bind(null, category?.id ?? null),
    null,
  );
  const [confirm, setConfirm] = useState(false);
  const [deleting, startDelete] = useTransition();
  const p = category?.id ?? "nueva";
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Guardado.");
      if (!category) formRef.current?.reset();
      router.refresh();
    } else toast.error(state.error);
  }, [state, router, category]);

  const fields = state && !state.ok ? state.fields : undefined;

  return (
    <form ref={formRef} action={action} className="grid gap-3 rounded-3xl bg-warm-white p-4 shadow-soft sm:grid-cols-[2fr_1.5fr_90px] sm:items-start">
      {!category ? <h2 className="font-display text-lg font-bold sm:col-span-3">Nueva categoría</h2> : null}
      <Field label="Nombre" htmlFor={`n-${p}`} error={fields?.name}>
        <Input id={`n-${p}`} name="name" defaultValue={category?.name} required />
      </Field>
      <Field label="Dirección en la web (opcional)" htmlFor={`s-${p}`} error={fields?.slug} hint={category ? undefined : "Opcional"}>
        <Input id={`s-${p}`} name="slug" defaultValue={category?.slug} />
      </Field>
      <Field label="Orden" htmlFor={`o-${p}`} error={fields?.position}>
        <Input id={`o-${p}`} name="position" type="number" min={0} max={1000} defaultValue={category?.position ?? 100} />
      </Field>
      <Field label="Descripción (opcional)" htmlFor={`d-${p}`} error={fields?.description} className="sm:col-span-3">
        <Input id={`d-${p}`} name="description" defaultValue={category?.description ?? ""} maxLength={300} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="is_visible" defaultChecked={category?.is_visible ?? true} className="size-5 accent-[var(--botanical-deep)]" />
          Visible en la tienda
        </label>
        {category ? (
          <span className="text-sm text-muted">
            {counts.published} publicados · {counts.total} en total
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          {category ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)} aria-label={`Eliminar categoría ${category.name}`}>
              <Trash2 className="size-4" aria-hidden="true" /> Eliminar
            </Button>
          ) : null}
          <Button type="submit" size="sm" variant={category ? "secondary" : "primary"} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : category ? <Save className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {category ? "Guardar" : "Crear categoría"}
          </Button>
        </div>
      </div>
      {category ? (
        <ConfirmDialog
          open={confirm}
          title={`¿Eliminar “${category.name}”?`}
          description={
            counts.total > 0
              ? `Tiene ${counts.total} producto(s): no se borran, quedan sin categoría.`
              : "La categoría no tiene productos."
          }
          pending={deleting}
          onCancel={() => setConfirm(false)}
          onConfirm={() =>
            startDelete(async () => {
              const res = await deleteCategory(category.id);
              setConfirm(false);
              if (res.ok) {
                toast.success(res.message ?? "Eliminada.");
                router.refresh();
              } else toast.error(res.error);
            })
          }
        />
      ) : null}
    </form>
  );
}
