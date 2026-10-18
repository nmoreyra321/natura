"use client";

import { BadgeCheck, Check, Loader2, MessageCircle, PackageCheck, RotateCcw, ThumbsDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { approveTransferPayment, rejectTransferPayment, setOrderContact, setOrderStatus, type OrderStatus } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { formatPhone, toWhatsAppPhone } from "@/lib/debts";
import { formatARS } from "@/lib/format";
import { ConfirmDialog } from "./confirm-dialog";
import { PaymentControl } from "./order-actions";
import { SelectBox } from "./select-to-delete";

const REASONS = ["No me llegó el pago", "El monto no coincide con el pedido", "No se ve bien el comprobante"];

export type OrderCardItem = { id: string; name: string; size: string | null; quantity: number; lots: string | null };

export type OrderCardProps = {
  id: string;
  code: string;
  number: number;
  status: OrderStatus;
  cancelledByCustomer: boolean;
  /** Solo si no es de la tienda web (venta rápida…). */
  originLabel: string | null;
  withAccount: boolean;
  delivery: { method: "envio" | "retiro"; zone: string | null; address: string | null; shippingCents: number };
  name: string | null;
  phone: string | null;
  trackUrl: string;
  paymentMethod: string;
  paymentStatus: string | null;
  /** Transferencia sin pagar por completo (la clienta avisó o todavía no). */
  onlineUnpaid: boolean;
  review: boolean;
  reportedAtLabel: string | null;
  createdLabel: string;
  totalCents: number;
  paidCents: number;
  netReceivedCents: number | null;
  paymentNote: string | null;
  paymentRejection: string | null;
  items: OrderCardItem[];
};

/**
 * Un pedido, pensado para leerse de un vistazo: una pregunta o aviso arriba («¿Te llegó la plata de…?»),
 * quién y cuánto, qué compró, y un botón grande para lo que hay que hacer. Lo raro va en «Más opciones».
 */
export function OrderCard(o: OrderCardProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(o.name ?? "");
  const [newPhone, setNewPhone] = useState(o.phone ? formatPhone(o.phone) : "");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const wa = toWhatsAppPhone(o.phone);
  const first = (o.name ?? "").trim().split(/\s+/)[0];
  const hello = `¡Hola${first ? ` ${first}` : ""}! Soy Mariel de Natu Mariel 🌸`;
  const cancelled = o.status === "cancelled";
  const isCash = o.paymentMethod === "efectivo";
  const isMp = o.paymentMethod === "mercadopago";
  const paid = o.paymentStatus === "approved";
  const who = first || "la clienta";

  const waText = {
    pending: `${hello} Vi tu pedido ${o.code}. ¿Te ayudo a terminarlo?\n${o.trackUrl}`,
    confirmed:
      o.delivery.method === "envio"
        ? `${hello} Tu pedido ${o.code} está confirmado y listo. Te lo llevo a ${o.delivery.zone ?? "tu casa"}: ¿qué día y horario te queda bien?\n${o.trackUrl}`
        : `${hello} Tu pedido ${o.code} está confirmado y listo. ¿Cuándo y dónde nos encontramos para entregártelo?\n${o.trackUrl}`,
    delivered: `${hello} Gracias por tu compra (pedido ${o.code}). ¡Cualquier cosa me escribís! 💖`,
    cancelled: `${hello} Tu pedido ${o.code} quedó cancelado. Si querés, lo armamos de nuevo. 💖`,
  }[o.status];

  const change = (next: OrderStatus, ok: string) =>
    start(async () => {
      const res = await setOrderStatus(o.id, next);
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else toast.error(res.error);
    });

  /** Abre WhatsApp durante el toque (para que no lo bloquee el navegador) y lo completa cuando termina. */
  const payAction = (action: () => ReturnType<typeof approveTransferPayment>, text: string) => {
    const win = wa ? window.open("", "_blank") : null;
    start(async () => {
      const res = await action();
      if (!res.ok) {
        win?.close();
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Listo.");
      if (win && wa) {
        win.opener = null;
        win.location.href = `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
      }
      setRejecting(false);
      router.refresh();
    });
  };
  const approve = () =>
    payAction(
      () => approveTransferPayment(o.id),
      `${hello} Recibimos tu pago del pedido ${o.code} ✅ ¡Muchísimas gracias por tu compra! Tu pedido ya está reservado. ¿Coordinamos la entrega? Contame qué día y en qué lugar te queda cómodo recibirlo.`,
    );

  // Qué le decimos arriba y cuál es el botón principal.
  let tone = "text-grape";
  let ask: string;
  let body: string | null = null;
  if (cancelled) {
    tone = "text-muted";
    ask = o.cancelledByCustomer ? "La clienta canceló este pedido" : "Pedido cancelado";
  } else if (o.onlineUnpaid && o.review) {
    ask = `¿Te llegó la plata de ${who}?`;
    body = `Dice que transfirió el ${o.reportedAtLabel}. Mirá en Mercado Pago si entró.`;
  } else if (o.onlineUnpaid) {
    ask = `Esperando el pago de ${who}`;
    body = "Eligió pagar por transferencia. Cuando veas que la plata entró, tocá «Ya me llegó».";
  } else if (isMp && !paid) {
    ask = "Esperando el pago por Mercado Pago";
    body = "Se confirma solo apenas pague. No tenés que hacer nada.";
  } else if (o.status === "pending") {
    tone = "text-grape";
    ask = isCash ? "Pedido nuevo, paga en efectivo" : "Pedido nuevo, ya pagó";
    body = isCash ? "Cobrás cuando se lo entregues." : null;
  } else if (o.status === "confirmed") {
    tone = "text-botanical-deep";
    ask = isCash && o.paidCents < o.totalCents ? "Confirmado. Cobrás al entregar." : "Pagado. Falta entregar.";
  } else {
    tone = "text-botanical-deep";
    ask = "✓ Entregado";
  }

  const mainBtn = "w-full min-h-14 text-lg font-extrabold";

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-warm-white p-4 shadow-soft sm:p-5">
      <p className={`font-display text-xl leading-tight font-bold text-balance ${tone}`}>{ask}</p>

      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-lg font-extrabold break-words">{o.name || <span className="text-coral-deep">Sin nombre</span>}</p>
        <p className="font-display text-2xl font-bold whitespace-nowrap text-coral-deep tabular">{formatARS(o.totalCents)}</p>
      </div>
      {body ? <p>{body}</p> : null}

      <div className="rounded-2xl bg-cream p-3">
        <p className="text-xs font-bold tracking-wide text-muted uppercase">Compró</p>
        <ul>
          {o.items.map((i) => (
            <li key={i.id}>
              <span className="font-bold tabular">{i.quantity} ×</span> {i.name}
              {i.size ? <span className="text-muted"> ({i.size})</span> : null}
              {i.lots ? <span className="block text-xs text-muted">Salió de: {i.lots}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-cream p-3">
        <p className="text-xs font-bold tracking-wide text-muted uppercase">Entrega</p>
        {o.delivery.method === "envio" ? (
          <p>
            🚚 Envío a <b>{o.delivery.zone}</b> ({formatARS(o.delivery.shippingCents)}, ya sumado al total)
            <span className="block text-muted">{o.delivery.address}</span>
          </p>
        ) : (
          <p>📍 Punto de encuentro (se coordina por WhatsApp)</p>
        )}
      </div>

      {o.paymentRejection && o.onlineUnpaid && !o.review ? (
        <p className="rounded-2xl bg-coral-soft px-3 py-2 text-sm">
          <b>Dijiste que el pago no llegó:</b> {o.paymentRejection}. Esperando que la clienta vuelva a avisar.
        </p>
      ) : null}
      {o.paymentNote && !paid ? (
        <p className="rounded-2xl bg-sun/40 px-3 py-2 text-sm">
          <b>Nota del cobro:</b> {o.paymentNote}
        </p>
      ) : null}
      {isMp && o.netReceivedCents !== null ? (
        <p className="text-sm">
          💳 Mercado Pago: te llegaron <b>{formatARS(o.netReceivedCents)}</b> (el pedido era de {formatARS(o.totalCents)}
          {o.netReceivedCents + 50 < o.totalCents ? <span className="font-semibold text-coral-deep"> · quedó por debajo, subí el recargo</span> : null}).
        </p>
      ) : null}

      {/* Botón principal */}
      {!cancelled && o.onlineUnpaid && o.review ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pending} onClick={approve} className={buttonClasses("primary", "lg", mainBtn)}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <BadgeCheck className="size-5" aria-hidden="true" />}
            Sí, llegó
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRejecting((v) => !v)}
            aria-expanded={rejecting}
            className={buttonClasses("outline", "lg", mainBtn)}
          >
            <ThumbsDown className="size-5" aria-hidden="true" /> No llegó
          </button>
        </div>
      ) : null}
      {!cancelled && o.onlineUnpaid && !o.review ? (
        <button type="button" disabled={pending} onClick={approve} className={buttonClasses("primary", "lg", mainBtn)}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <BadgeCheck className="size-5" aria-hidden="true" />}
          Ya me llegó
        </button>
      ) : null}
      {rejecting ? (
        <form
          className="flex flex-col gap-2 rounded-2xl bg-lilac/40 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            payAction(
              () => rejectTransferPayment(o.id, reason),
              `${hello} Revisé el pago del pedido ${o.code}: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}. ¿Lo revisás? Cuando lo tengas, avisame de nuevo acá: ${o.trackUrl}`,
            );
          }}
        >
          <p className="font-bold">¿Qué pasó? La clienta lo ve en la página de su pedido.</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${reason === r ? "bg-forest text-white" : "bg-white hover:bg-sun"}`}
              >
                {r}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor={`motivo-${o.id}`}>
            Motivo
          </label>
          <input id={`motivo-${o.id}`} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className={inputClasses} />
          <button type="submit" disabled={pending || reason.trim().length < 3} className={buttonClasses("secondary", "md", "self-start")}>
            Avisarle a la clienta
          </button>
        </form>
      ) : null}
      {!cancelled && !o.onlineUnpaid && o.status === "pending" && (!isMp || paid) ? (
        <button type="button" disabled={pending} onClick={() => change("confirmed", "Pedido confirmado. Descontamos el stock y los vencimientos (primero el que vence antes).")} className={buttonClasses("primary", "lg", mainBtn)}>
          <Check className="size-5" aria-hidden="true" /> Confirmar el pedido
        </button>
      ) : null}
      {o.status === "confirmed" ? (
        <button type="button" disabled={pending} onClick={() => change("delivered", "Pedido marcado como entregado.")} className={buttonClasses("primary", "lg", mainBtn)}>
          <PackageCheck className="size-5" aria-hidden="true" /> Ya lo entregué
        </button>
      ) : null}

      {/* Cobro en efectivo */}
      {isCash && !cancelled && (o.status !== "pending" || o.paidCents > 0) ? (
        <PaymentControl key={`${o.paidCents}-${o.totalCents}`} id={o.id} totalCents={o.totalCents} paidCents={o.paidCents} />
      ) : null}

      {wa ? (
        <a
          href={`https://wa.me/${wa}?text=${encodeURIComponent(waText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses("whatsapp", "lg", "w-full min-h-12 text-base")}
        >
          <MessageCircle className="size-5" aria-hidden="true" /> Escribirle por WhatsApp
        </a>
      ) : (
        <p className="rounded-2xl bg-coral-soft px-3 py-2 text-sm font-semibold">No tiene teléfono cargado. Tocá «Más opciones» para completarlo.</p>
      )}

      <details className="border-t border-line pt-2">
        <summary className="flex min-h-10 cursor-pointer items-center font-bold text-muted">Más opciones</summary>
        <div className="mt-2 flex flex-col gap-2">
          {editing ? (
            <form
              className="flex flex-col gap-2 rounded-2xl bg-cream p-3"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await setOrderContact(o.id, newName, newPhone);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success(res.message ?? "Guardado.");
                  setEditing(false);
                  router.refresh();
                });
              }}
            >
              <label className="text-sm font-semibold">
                Nombre
                <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} className={`${inputClasses} mt-1`} />
              </label>
              <label className="text-sm font-semibold">
                WhatsApp
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} inputMode="tel" placeholder="11 2345-6789" maxLength={30} className={`${inputClasses} mt-1`} />
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={pending} className={buttonClasses("secondary", "md")}>
                  Guardar
                </button>
                <button type="button" onClick={() => setEditing(false)} className={buttonClasses("ghost", "md")}>
                  No cambiar
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className={buttonClasses("outline", "md", "w-full")}>
              ✎ {o.name && o.phone ? "Corregir sus datos" : "Completar sus datos"}
            </button>
          )}
          {cancelled || o.status === "delivered" ? (
            <button type="button" disabled={pending} onClick={() => change("pending", "El pedido volvió a pendiente.")} className={buttonClasses("outline", "md", "w-full")}>
              <RotateCcw className="size-4" aria-hidden="true" /> Volver a pendiente
            </button>
          ) : null}
          {!cancelled ? (
            <button type="button" disabled={pending} onClick={() => setConfirmCancel(true)} className={buttonClasses("outline", "md", "w-full")}>
              <X className="size-4" aria-hidden="true" /> Cancelar el pedido
            </button>
          ) : null}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <SelectBox id={o.id} label={`el pedido ${o.code}`} />
        <span className="tabular">
          Pedido {o.code} · n.º {o.number} · {o.createdLabel}
        </span>
        {o.originLabel ? <span className="font-bold">{o.originLabel}</span> : null}
        {o.withAccount ? <span className="font-bold text-botanical-deep">👤 Con cuenta: suma al Club</span> : null}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title={`¿Cancelar el pedido ${o.code}?`}
        description={
          o.status === "pending"
            ? "El pedido queda como cancelado. No cambia el stock."
            : "El pedido queda como cancelado y devolvemos al stock y a sus vencimientos las unidades que se habían descontado."
        }
        confirmLabel="Cancelar pedido"
        onConfirm={() => {
          setConfirmCancel(false);
          change("cancelled", "Pedido cancelado.");
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
