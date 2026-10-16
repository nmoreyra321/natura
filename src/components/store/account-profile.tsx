"use client";

import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveMyAccount } from "@/app/(tienda)/cuenta/actions";
import { buttonClasses } from "@/components/ui/button";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Required, RequiredNote } from "./required";

/** Nombre y WhatsApp de la cuenta (el WhatsApp es con el que suma al Club). */
export function AccountProfile({ name, phone }: { name: string; phone: string }) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveMyAccount({ name: n, phone: p });
          if (res.ok) {
            toast.success("¡Listo! Guardamos tus datos.");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      <RequiredNote />
      <label className="text-sm font-semibold">
        Nombre y apellido
        <Required />
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          maxLength={80}
          autoComplete="name"
          className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base font-normal"
        />
      </label>
      <label className="text-sm font-semibold">
        Tu WhatsApp
        <Required />
        <input
          value={p}
          onChange={(e) => setP(e.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={30}
          placeholder="Ej.: 11 2345-6789"
          className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base font-normal"
        />
        <span className="mt-1 block px-1 text-xs font-normal text-muted">
          Con código de área. Con este número sumás tus compras al Club y te escribimos por tus pedidos.
        </span>
      </label>
      <button type="submit" disabled={pending} className={buttonClasses("primary", "md", "w-fit")}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Guardar
      </button>
    </form>
  );
}

/** Cerrar la sesión de la cuenta en este celular. */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await getBrowserClient()?.auth.signOut();
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted underline disabled:opacity-60"
    >
      <LogOut className="size-4" aria-hidden="true" /> Salir de mi cuenta
    </button>
  );
}
