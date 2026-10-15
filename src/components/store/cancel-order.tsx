"use client";

import { Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelMyOrder } from "@/app/(tienda)/pedido/actions";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

/** «Cancelar mi pedido» con un cartel que pide confirmación. El pedido no se borra: queda cancelado. */
export function CancelOrder({ orderId, code }: { orderId: string; code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-muted underline hover:text-coral-deep disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <XCircle className="size-4" aria-hidden="true" />}
        Me arrepentí: cancelar mi pedido
      </button>
      <ConfirmDialog
        open={open}
        title={`¿Cancelar el pedido ${code}?`}
        description="Natu Mariel va a ver que lo cancelaste y no te va a preparar nada. Si después cambiás de idea, vas a tener que hacer un pedido nuevo."
        confirmLabel="Sí, cancelar mi pedido"
        cancelLabel="No, volver"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await cancelMyOrder(orderId).catch(() => null);
            setOpen(false);
            if (res?.ok) {
              toast.success("Listo, cancelaste tu pedido.");
              router.refresh();
            } else {
              toast.error(res?.error ?? "No pudimos cancelar el pedido. Revisá tu conexión y probá de nuevo.");
            }
          })
        }
      />
    </>
  );
}
