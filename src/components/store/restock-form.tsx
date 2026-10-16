"use client";

import { BellRing, Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { requestRestock } from "@/app/(tienda)/productos/actions";
import { buttonClasses } from "@/components/ui/button";
import { Required, RequiredNote } from "./required";

/** "Avisame cuando vuelva": la clienta deja su WhatsApp en un producto sin stock. */
export function RestockForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-sage px-4 py-3 font-semibold text-botanical-deep" role="status">
        <Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> {done}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClasses("secondary", "lg")}>
        <BellRing className="size-5" aria-hidden="true" /> Avisame cuando vuelva
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
          const res = await requestRestock(productId, name, phone);
          if (res.ok) setDone(res.message);
          else setError(res.error);
        });
      }}
    >
      <p className="font-semibold">Dejanos tu WhatsApp y te avisamos cuando vuelva a haber stock.</p>
      <RequiredNote />
      <label className="text-sm font-semibold">
        Nombre <span className="font-normal text-muted">(opcional)</span>
        <input
          value={name}
          maxLength={80}
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
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <BellRing className="size-5" aria-hidden="true" />}
        Avisame
      </button>
      <p className="text-xs text-muted">Solo lo usamos para avisarte de este producto.</p>
    </form>
  );
}
