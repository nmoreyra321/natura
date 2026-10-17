"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { clearAllStock } from "@/app/admin/actions";
import { ConfirmDialog } from "./confirm-dialog";

/** Botón peligroso: deja todo el stock en cero. Pide escribir BORRAR antes de hacerlo. */
export function ClearAllStock({ withStock }: { withStock: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border-2 border-coral-deep px-4 py-2 text-sm font-bold text-coral-deep hover:bg-coral-soft"
      >
        <TriangleAlert className="size-4" aria-hidden="true" /> Borrar todo el stock
      </button>
      <ConfirmDialog
        open={open}
        title="⚠️ ¡Importante! Vas a borrar TODO el stock"
        description={`Los ${withStock} productos que hoy tienen stock van a quedar en 0 («Sin stock») y se van a borrar los vencimientos anotados. Los productos y los pedidos no se borran. Esto no se puede deshacer.`}
        confirmLabel="Sí, borrar todo el stock"
        cancelLabel="No, volver"
        confirmWord="BORRAR"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await clearAllStock();
            setOpen(false);
            if (res.ok) {
              toast.success(res.message ?? "Listo.");
              router.refresh();
            } else toast.error(res.error);
          })
        }
      />
    </div>
  );
}
