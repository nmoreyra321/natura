"use client";

import { MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setCustomerPhone } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import type { CustomerDebt } from "@/lib/debts";
import { formatARS } from "@/lib/format";

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" });

function reminderText(debt: CustomerDebt): string {
  const codes = debt.orders.map((o) => o.code).join(", ");
  const saludo = debt.name ? `Hola, ${debt.name.split(" ")[0]}.` : "Hola.";
  return `${saludo} Te escribimos de Natu Mariel para recordarte que quedó un saldo pendiente de ${formatARS(debt.owedCents)} (pedido ${codes}). Cuando puedas, avisanos por este medio. ¡Muchas gracias!`;
}

/** Tarjeta de una clienta que debe: cuánto, desde cuándo, de qué pedidos y botón de recordatorio. */
export function DebtCard({ debt, today }: { debt: CustomerDebt; today: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [pending, start] = useTransition();
  const days = Math.max(0, Math.floor((today - new Date(debt.since).getTime()) / 86_400_000));
  const text = encodeURIComponent(reminderText(debt));
  // Sin teléfono se abre WhatsApp para elegir el contacto.
  const waUrl = debt.phone ? `https://wa.me/${debt.phone}?text=${text}` : `https://wa.me/?text=${text}`;

  return (
    <li className="rounded-3xl bg-warm-white p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-bold">{debt.name ?? "Clienta sin nombre"}</p>
          <p className="text-sm text-muted">
            Debe desde el {dateFmt.format(new Date(debt.since))} ·{" "}
            <span className={days >= 30 ? "font-bold text-coral-deep" : ""}>
              {days === 0 ? "hoy" : days === 1 ? "hace 1 día" : `hace ${days} días`}
            </span>
          </p>
        </div>
        <p className="text-2xl font-extrabold text-coral-deep tabular">{formatARS(debt.owedCents)}</p>
      </div>

      <ul className="mt-3 divide-y divide-line/70 rounded-2xl border border-line/70 text-sm">
        {debt.orders.map((o) => (
          <li key={o.id} className="flex flex-wrap justify-between gap-x-3 px-3 py-2">
            <span>
              Pedido{" "}
              <Link href={`/admin/pedidos?estado=todos&q=${encodeURIComponent(o.code)}`} className="font-bold text-coral-deep hover:underline">
                {o.code}
              </Link>
              {o.note ? <span className="text-muted"> · {o.note}</span> : null}
            </span>
            <span className="tabular">falta {formatARS(o.owedCents)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={waUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("whatsapp", "md")}>
          <MessageCircle className="size-4" aria-hidden="true" /> Recordar por WhatsApp
        </a>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className={buttonClasses("ghost", "md")}>
            <Phone className="size-4" aria-hidden="true" /> {debt.phone ? "Cambiar WhatsApp" : "Agregar WhatsApp"}
          </button>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await setCustomerPhone(
                  debt.orders.map((o) => o.id),
                  phone,
                );
                if (res.ok) {
                  toast.success(res.message ?? "Guardado.");
                  setEditing(false);
                  router.refresh();
                } else {
                  toast.error(res.error);
                }
              });
            }}
          >
            <input
              type="tel"
              inputMode="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11 2345-6789"
              aria-label="WhatsApp de la clienta"
              className="h-10 w-40 rounded-xl border border-line bg-white px-3"
            />
            <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm", "h-10")}>
              Guardar
            </button>
          </form>
        )}
      </div>
      {!debt.phone && !editing ? (
        <p className="mt-2 text-xs text-muted">
          Sin WhatsApp guardado: al tocar el botón elegís el contacto en WhatsApp. Si lo agregás, va directo a su chat.
        </p>
      ) : null}
    </li>
  );
}
