"use client";

import { Check, PackageCheck, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setOrderStatus, type OrderStatus } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

const SUCCESS: Record<OrderStatus, string> = {
  pending: "El pedido volvió a pendiente.",
  confirmed: "Pedido confirmado. Descontamos el stock.",
  delivered: "Pedido marcado como entregado.",
  cancelled: "Pedido cancelado.",
};

/** Botones para avanzar el pedido. Confirmar descuenta stock; cancelar o volver a pendiente lo devuelve. */
export function OrderActions({ id, number, status }: { id: string; number: number; status: OrderStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const change = (next: OrderStatus) =>
    start(async () => {
      const res = await setOrderStatus(id, next);
      if (res.ok) {
        toast.success(SUCCESS[next]);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" ? (
        <button type="button" disabled={pending} onClick={() => change("confirmed")} className={buttonClasses("primary", "md")}>
          <Check className="size-4" aria-hidden="true" /> Confirmar
        </button>
      ) : null}
      {status === "confirmed" ? (
        <button type="button" disabled={pending} onClick={() => change("delivered")} className={buttonClasses("primary", "md")}>
          <PackageCheck className="size-4" aria-hidden="true" /> Marcar entregado
        </button>
      ) : null}
      {status === "cancelled" || status === "delivered" ? (
        <button type="button" disabled={pending} onClick={() => change("pending")} className={buttonClasses("outline", "md")}>
          <RotateCcw className="size-4" aria-hidden="true" /> Volver a pendiente
        </button>
      ) : null}
      {status !== "cancelled" ? (
        <button type="button" disabled={pending} onClick={() => setConfirmCancel(true)} className={buttonClasses("ghost", "md")}>
          <X className="size-4" aria-hidden="true" /> Cancelar
        </button>
      ) : null}
      <ConfirmDialog
        open={confirmCancel}
        title={`¿Cancelar el pedido N.º ${number}?`}
        description={
          status === "pending"
            ? "El pedido queda como cancelado. No cambia el stock."
            : "El pedido queda como cancelado y devolvemos al stock las unidades que se habían descontado."
        }
        confirmLabel="Cancelar pedido"
        onConfirm={() => {
          setConfirmCancel(false);
          change("cancelled");
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
