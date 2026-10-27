"use client";

import { Check, Clock, Loader2, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { reserveProduct } from "@/app/(tienda)/productos/actions";
import { buttonClasses } from "@/components/ui/button";
import { QuantityInput } from "./add-to-cart";
import { Required, RequiredNote } from "./required";

const NAME_KEY = "natu-mariel:nombre";
const PHONE_KEY = "natu-mariel:telefono";

function saved(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

const untilFmt = new Intl.DateTimeFormat("es-AR", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

/** «Reservar 24 horas»: la clienta separa el producto y la tienda se lo guarda un día. */
export function ReserveForm({ productId, productName, stock, whatsappUrl }: { productId: string; productName: string; stock: number; whatsappUrl?: string | null }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<{ until: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="animate-rise rounded-2xl bg-sage px-4 py-3 font-semibold text-botanical-deep" role="status">
        <p className="flex items-start gap-2">
          <Check className="animate-pop mt-0.5 size-5 shrink-0" aria-hidden="true" /> ¡Reservado! Te lo guardamos hasta el {done.until}.
        </p>
        <p className="mt-1 pl-7 text-sm font-normal">Coordiná con Mariel para retirarlo antes de que venza.</p>
        {whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline", "md", "mt-3 w-full")}>
            <MessageCircle className="size-5" aria-hidden="true" /> Avisarle a Mariel por WhatsApp
          </a>
        ) : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setName((n) => n || saved(NAME_KEY));
          setPhone((p) => p || saved(PHONE_KEY));
          setOpen(true);
        }}
        className={buttonClasses("secondary", "lg")}
      >
        <Clock className="size-5" aria-hidden="true" /> Reservar 24 horas
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-3xl border-2 border-forest bg-warm-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await reserveProduct(productId, quantity, name, phone).catch(() => null);
          if (res?.ok) {
            try {
              window.localStorage.setItem(NAME_KEY, name);
              window.localStorage.setItem(PHONE_KEY, phone);
            } catch {
              // Sin almacenamiento: no pasa nada.
            }
            setDone({ until: untilFmt.format(new Date(res.expiresAt)) });
          } else setError(res?.error ?? "No pudimos reservarlo. Revisá tu conexión y probá de nuevo.");
        });
      }}
    >
      <p className="font-semibold">Te guardamos «{productName}» por 24 horas, sin pagar ahora. Si no lo retirás, vuelve a la tienda.</p>
      <RequiredNote />
      {stock > 1 ? (
        <div className="flex items-center gap-3 text-sm font-semibold">
          Cantidad
          <QuantityInput id="reserve-qty" label="Cantidad a reservar" value={quantity} max={Math.min(stock, 10)} onChange={setQuantity} />
        </div>
      ) : null}
      <label className="text-sm font-semibold">
        Tu nombre
        <Required />
        <input
          value={name}
          required
          maxLength={60}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base font-normal"
        />
      </label>
      <label className="text-sm font-semibold">
        Tu WhatsApp (con código de área)
        <Required />
        <input
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel"
          value={phone}
          maxLength={20}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Ej.: 11 2345-6789"
          className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base font-normal"
        />
      </label>
      {error ? (
        <p className="text-sm font-semibold text-coral-deep" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Clock className="size-5" aria-hidden="true" />}
        Reservar
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-muted hover:underline">
        Cancelar
      </button>
      <p className="text-xs text-muted">Solo usamos tus datos para avisarte de esta reserva.</p>
    </form>
  );
}
