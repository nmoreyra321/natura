"use client";

import { BadgeCheck, FileText, Loader2, ThumbsDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { approveTransferPayment, rejectTransferPayment } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { toWhatsAppPhone } from "@/lib/debts";

const REASONS = ["No me llegó el pago", "El monto no coincide con el pedido", "No se ve bien el comprobante"];

/**
 * Pedido que se paga online (link de Mercado Pago o transferencia) y todavía no está pagado.
 * Un solo botón, «Confirmar pago»: queda pagado, se confirma el pedido y se abre WhatsApp con un
 * mensaje listo para la clienta. Si la clienta avisó que pagó, también se puede rechazar.
 */
export function PaymentReview({
  orderId,
  code,
  name,
  phone,
  total,
  reportedAt,
  proofUrl,
  proofIsPdf,
  trackUrl,
}: {
  orderId: string;
  code: string;
  name: string | null;
  phone: string | null;
  /** Total ya formateado ("$ 20.000"). */
  total: string;
  /** Cuándo avisó la clienta que pagó (null si todavía no avisó). */
  reportedAt: string | null;
  proofUrl: string | null;
  proofIsPdf: boolean;
  trackUrl: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const wa = toWhatsAppPhone(phone);
  const firstName = (name ?? "").trim().split(/\s+/)[0];
  const hi = `¡Hola${firstName ? ` ${firstName}` : ""}!`;

  /** Abre WhatsApp ya (durante el toque, para que no lo bloquee el navegador) y lo completa después. */
  const run = (action: () => ReturnType<typeof approveTransferPayment>, text: string) => {
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

  return (
    <div className="rounded-2xl border-2 border-grape/40 bg-lilac/40 p-3 sm:p-4">
      {reportedAt ? (
        <>
          <p className="font-bold text-grape">💸 La clienta avisó que pagó {total}</p>
          <p className="text-sm text-muted">
            El {reportedAt}. Fijate en Mercado Pago o en tu cuenta que haya llegado y confirmalo.
          </p>
        </>
      ) : (
        <>
          <p className="font-bold text-grape">💳 Esperando el pago de {total}</p>
          <p className="text-sm text-muted">Cuando veas el pago en Mercado Pago o en tu cuenta, tocá «Confirmar pago».</p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!reportedAt ? null : proofUrl ? (
          <a href={proofUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "md", "bg-white")}>
            <FileText className="size-4" aria-hidden="true" /> Ver comprobante{proofIsPdf ? " (PDF)" : ""}
          </a>
        ) : (
          <span className="self-center rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-muted">No subió comprobante</span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () => approveTransferPayment(orderId),
              `${hi} Soy Mariel de Natu Mariel 🌸 Confirmamos tu pago del pedido ${code} ✅ ¡Gracias! ¿Coordinamos la entrega?`,
            )
          }
          className={buttonClasses("primary", "md")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="size-4" aria-hidden="true" />}
          Confirmar pago
        </button>
        {reportedAt ? (
          <button type="button" disabled={pending} onClick={() => setRejecting((v) => !v)} className={buttonClasses("ghost", "md")}>
            <ThumbsDown className="size-4" aria-hidden="true" /> No llegó
          </button>
        ) : null}
      </div>
      {rejecting ? (
        <form
          className="mt-3 flex flex-col gap-2 rounded-2xl bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => rejectTransferPayment(orderId, reason),
              `${hi} Soy Mariel de Natu Mariel 🌸 Revisé el pago del pedido ${code}: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}. ¿Lo revisás? Cuando lo tengas, avisame de nuevo acá: ${trackUrl}`,
            );
          }}
        >
          <p className="text-sm font-bold">¿Qué pasó? La clienta lo va a ver en la página de su pedido.</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${reason === r ? "bg-forest text-white" : "bg-cream hover:bg-sun"}`}
              >
                {r}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor={`motivo-${orderId}`}>
            Motivo
          </label>
          <input
            id={`motivo-${orderId}`}
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            className={inputClasses}
          />
          <button type="submit" disabled={pending || reason.trim().length < 3} className={buttonClasses("secondary", "md", "self-start")}>
            Avisarle a la clienta
          </button>
        </form>
      ) : null}
    </div>
  );
}
