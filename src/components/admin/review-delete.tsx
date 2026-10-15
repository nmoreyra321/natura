"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteReview } from "@/app/admin/actions";
import { ConfirmDialog } from "./confirm-dialog";

/** Botón «Sacar» de una reseña, con confirmación. */
export function ReviewDelete({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-bold text-coral-deep ring-1 ring-line hover:bg-coral-soft disabled:opacity-50"
      >
        <Trash2 className="size-4" aria-hidden="true" /> Sacar
      </button>
      <ConfirmDialog
        open={open}
        title={`¿Sacar la reseña de ${name}?`}
        description="Deja de verse en la tienda y se borra para siempre."
        confirmLabel="Sí, sacarla"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await deleteReview(id).catch(() => null);
            setOpen(false);
            if (res?.ok) {
              toast.success(res.message ?? "Listo.");
              router.refresh();
            } else {
              toast.error(res && !res.ok ? res.error : "No pudimos sacarla. Probá de nuevo.");
            }
          })
        }
      />
    </>
  );
}
