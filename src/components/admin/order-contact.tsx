"use client";

import { MessageCircle, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setOrderContact } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { formatPhone, toWhatsAppPhone } from "@/lib/debts";

/** Datos de la clienta de un pedido: escribirle por WhatsApp y completarlos o corregirlos. */
export function OrderContact({
  orderId,
  code,
  name,
  phone,
  status,
  delivery,
  zone,
  trackUrl,
}: {
  orderId: string;
  code: string;
  name: string | null;
  phone: string | null;
  /** Estado del pedido: el mensaje cambia según esté pendiente, confirmado, entregado o cancelado. */
  status: "pending" | "confirmed" | "delivered" | "cancelled";
  /** "envio" si se lleva a la casa de la clienta. */
  delivery: string | null;
  zone: string | null;
  trackUrl: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(name ?? "");
  const [newPhone, setNewPhone] = useState(phone ? formatPhone(phone) : "");
  const [saving, start] = useTransition();
  const wa = toWhatsAppPhone(phone);
  const firstName = (name ?? "").trim().split(/\s+/)[0];
  const hello = `¡Hola${firstName ? ` ${firstName}` : ""}! Soy Mariel de Natu Mariel 🌸`;
  const message = {
    pending: `${hello} Vi tu pedido ${code}. ¿Te ayudo a terminarlo?\n${trackUrl}`,
    confirmed:
      delivery === "envio"
        ? `${hello} Tu pedido ${code} está confirmado y listo. Te lo llevo a ${zone ?? "tu casa"}: ¿qué día y horario te queda bien?\n${trackUrl}`
        : `${hello} Tu pedido ${code} está confirmado y listo. ¿Cuándo y dónde nos encontramos para entregártelo?\n${trackUrl}`,
    delivered: `${hello} Gracias por tu compra (pedido ${code}). ¡Cualquier cosa me escribís! 💖`,
    cancelled: `${hello} Tu pedido ${code} quedó cancelado. Si querés, lo armamos de nuevo. 💖`,
  }[status];
  const label = { pending: "Avisarle por WhatsApp", confirmed: "Avisar: pedido listo", delivered: "Agradecerle", cancelled: "Escribirle" }[status];

  if (editing) {
    return (
      <form
        className="mt-2 flex flex-wrap items-end gap-2 rounded-2xl bg-cream p-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await setOrderContact(orderId, newName, newPhone);
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
        <label className="text-xs font-semibold">
          Nombre
          <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} className={`${inputClasses} mt-1 h-10 w-48 text-sm`} />
        </label>
        <label className="text-xs font-semibold">
          WhatsApp
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            inputMode="tel"
            placeholder="11 2345-6789"
            maxLength={30}
            className={`${inputClasses} mt-1 h-10 w-40 text-sm`}
          />
        </label>
        <button type="submit" disabled={saving} className={buttonClasses("secondary", "sm")}>
          Guardar
        </button>
        <button type="button" onClick={() => setEditing(false)} className="px-2 py-2 text-sm font-semibold text-muted hover:underline">
          Cancelar
        </button>
      </form>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span>
        <span className="font-semibold">{name || <span className="text-coral-deep">Sin nombre</span>}</span>
        {" · "}
        {phone ? <span className="tabular">{formatPhone(phone)}</span> : <span className="font-semibold text-coral-deep">sin teléfono</span>}
      </span>
      {wa ? (
        <a
          href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-sage px-3 py-1 text-xs font-bold text-botanical-deep hover:bg-botanical-deep hover:text-white"
        >
          <MessageCircle className="size-3.5" aria-hidden="true" /> {label}
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-xs font-bold text-coral-deep hover:underline"
      >
        <Pencil className="size-3" aria-hidden="true" /> {name && phone ? "Corregir datos" : "Completar datos"}
      </button>
    </div>
  );
}
