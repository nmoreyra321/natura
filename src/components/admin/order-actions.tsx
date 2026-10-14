"use client";

import { BadgeCheck, Check, PackageCheck, RotateCcw, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setOrderPaid, setOrderStatus, type OrderStatus } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

const SUCCESS: Record<OrderStatus, string> = {
  pending: "El pedido volvió a pendiente.",
  confirmed: "Pedido confirmado. Descontamos el stock y los vencimientos (primero el que vence antes).",
  delivered: "Pedido marcado como entregado.",
  cancelled: "Pedido cancelado.",
};

/** Botones para avanzar el pedido. Confirmar descuenta stock; cancelar o volver a pendiente lo devuelve. */
export function OrderActions({
  id,
  code,
  status,
  manualPayment = false,
  paid = false,
}: {
  id: string;
  code: string;
  status: OrderStatus;
  /** true si es efectivo o transferencia (el pago se marca a mano). */
  manualPayment?: boolean;
  paid?: boolean;
}) {
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

  const togglePaid = (next: boolean) =>
    start(async () => {
      const res = await setOrderPaid(id, next);
      if (res.ok) {
        toast.success(res.message ?? "Listo.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      {manualPayment && status !== "cancelled" ? (
        paid ? (
          <button type="button" disabled={pending} onClick={() => togglePaid(false)} className={buttonClasses("ghost", "md")}>
            <Undo2 className="size-4" aria-hidden="true" /> Desmarcar pago
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => togglePaid(true)}
            className={buttonClasses("secondary", "md")}
          >
            <BadgeCheck className="size-4" aria-hidden="true" /> Pago recibido
          </button>
        )
      ) : null}
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
        title={`¿Cancelar el pedido ${code}?`}
        description={
          status === "pending"
            ? "El pedido queda como cancelado. No cambia el stock."
            : "El pedido queda como cancelado y devolvemos al stock y a sus vencimientos las unidades que se habían descontado."
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
