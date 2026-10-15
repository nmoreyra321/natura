"use client";

import { BadgeCheck, Check, PackageCheck, RotateCcw, Undo2, X } from "lucide-react";
import { formatARS } from "@/lib/format";
import { parseMoney } from "@/lib/validation";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { registerOrderPayment, resetOrderPayment, setOrderStatus, type OrderStatus } from "@/app/admin/actions";
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
  hideConfirm = false,
}: {
  id: string;
  code: string;
  status: OrderStatus;
  /** Pago online sin confirmar: se confirma con «Confirmar pago», no con este botón. */
  hideConfirm?: boolean;
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

  return (
    <div className="flex flex-wrap gap-2">

      {status === "pending" && !hideConfirm ? (
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

/**
 * Cobro de pedidos en efectivo o transferencia: se anota cada pago (seña y resto, o todo junto).
 * Cuando lo pagado cubre el total, el pedido queda "Pagado".
 */
export function PaymentControl({
  id,
  totalCents,
  paidCents,
}: {
  id: string;
  totalCents: number;
  paidCents: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const remainingCents = Math.max(totalCents - paidCents, 0);
  const [amount, setAmount] = useState(String(remainingCents / 100).replace(".", ","));
  const [note, setNote] = useState("");

  const run = (fn: () => ReturnType<typeof resetOrderPayment>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Listo.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  if (remainingCents === 0) {
    return (
      <button type="button" disabled={pending} onClick={() => run(() => resetOrderPayment(id))} className={buttonClasses("ghost", "sm")}>
        <Undo2 className="size-4" aria-hidden="true" /> Desmarcar pago
      </button>
    );
  }

  const value = parseMoney(amount);
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-2xl bg-cream/70 p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => registerOrderPayment(id, value, value * 100 < remainingCents ? note : undefined));
      }}
    >
      <label className="flex flex-col text-xs font-semibold">
        Monto que pagó
        <span className="mt-1 flex items-center gap-1">
          <span className="text-sm">$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-10 w-28 rounded-xl border border-line bg-white px-2 text-sm tabular"
          />
        </span>
      </label>
      {Number.isFinite(value) && value > 0 && value * 100 < remainingCents ? (
        <label className="flex min-w-40 flex-1 flex-col text-xs font-semibold">
          Nota (opcional)
          <input
            value={note}
            maxLength={120}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej.: el resto el lunes"
            className="mt-1 h-10 rounded-xl border border-line bg-white px-2 text-sm font-normal"
          />
        </label>
      ) : null}
      <button
        type="submit"
        disabled={pending || !Number.isFinite(value) || value <= 0}
        className={buttonClasses("secondary", "sm", "h-10")}
      >
        <BadgeCheck className="size-4" aria-hidden="true" /> Registrar pago
      </button>
      {paidCents > 0 ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => resetOrderPayment(id))}
          className="h-10 px-2 text-xs font-semibold text-muted underline hover:text-coral-deep"
        >
          Borrar pagos
        </button>
      ) : null}
      <p className="w-full text-xs text-muted">
        {paidCents > 0
          ? `Ya pagó ${formatARS(paidCents)} de ${formatARS(totalCents)}. Falta ${formatARS(remainingCents)}.`
          : `Total del pedido: ${formatARS(totalCents)}. Si te pagó una parte, escribí solo esa parte.`}
      </p>
    </form>
  );
}
