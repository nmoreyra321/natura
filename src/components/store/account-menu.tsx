"use client";

import { CircleUser, Gift, LogOut, Package } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { getLoginProviders } from "@/lib/config";
import { getBrowserClient } from "@/lib/supabase/browser";
import { AccountLogin } from "./account-login";

type Me = { name: string | null; email: string | null } | null;

/** La personita de arriba: abre un mini panel con la cuenta (o para entrar). */
export function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    // Las sesiones con mail son del panel (administradoras), no cuentas de clientas.
    const read = (user: { app_metadata?: { provider?: unknown }; user_metadata?: Record<string, unknown>; email?: string } | undefined | null) => {
      if (!user || !user.app_metadata?.provider || user.app_metadata.provider === "email") return setMe(null);
      const m = user.user_metadata ?? {};
      const name = typeof m.full_name === "string" ? m.full_name : typeof m.name === "string" ? m.name : null;
      setMe({ name, email: user.email ?? null });
    };
    supabase.auth.getSession().then(({ data }) => {
      read(data.session?.user);
      // Recién entró con Google o Facebook: cartelito de bienvenida y se limpia la dirección.
      const url = new URL(window.location.href);
      if (url.searchParams.get("bienvenida") === "1") {
        url.searchParams.delete("bienvenida");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
        const m = data.session?.user.user_metadata ?? {};
        const full = typeof m.full_name === "string" ? m.full_name : typeof m.name === "string" ? m.name : "";
        const first = full.split(" ")[0];
        if (data.session) toast.success(`¡Hola${first ? `, ${first}` : ""}! Ya entraste a tu cuenta 🎉`, { position: "bottom-center", duration: 3000 });
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => read(session?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  // Se cierra al tocar afuera, con Escape o al tocar un enlace.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const providers = getLoginProviders();
  const item = "flex min-h-11 items-center gap-3 rounded-2xl px-3 font-semibold hover:bg-cream";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative inline-flex size-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/5"
        aria-label={me ? "Mi cuenta (sesión iniciada)" : "Mi cuenta"}
        title="Mi cuenta"
      >
        <CircleUser className="size-5.5" aria-hidden="true" />
        {me ? <span className="absolute top-2 right-2 size-2.5 rounded-full bg-botanical-deep ring-2 ring-cream" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Mi cuenta"
          className="animate-rise absolute top-full right-0 z-50 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-3xl bg-warm-white p-3 text-forest shadow-lift ring-1 ring-line"
        >
          {me ? (
            <>
              <div className="px-3 pt-1 pb-2">
                <p className="font-display text-lg font-bold">Hola{me.name ? `, ${me.name.split(" ")[0]}` : ""} 👋</p>
                {me.email ? <p className="truncate text-xs text-muted">{me.email}</p> : null}
              </div>
              <nav className="flex flex-col border-t border-line/70 pt-1.5">
                <Link href="/cuenta" className={item} onClick={() => setOpen(false)}>
                  <CircleUser className="size-5 text-coral-deep" aria-hidden="true" /> Mi cuenta
                </Link>
                <Link href="/club" className={item} onClick={() => setOpen(false)}>
                  <Gift className="size-5 text-coral-deep" aria-hidden="true" /> Club Natu Mariel
                </Link>
                <Link href="/mi-pedido" className={item} onClick={() => setOpen(false)}>
                  <Package className="size-5 text-coral-deep" aria-hidden="true" /> Mis pedidos
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await getBrowserClient()?.auth.signOut();
                    setOpen(false);
                    // Al salir, vuelve al inicio de la tienda con un cartelito.
                    toast.success("Saliste de tu cuenta. ¡Hasta pronto! 👋", { position: "bottom-center", duration: 2500 });
                    router.push("/");
                    router.refresh();
                  }}
                  className={`${item} text-muted`}
                >
                  <LogOut className="size-5" aria-hidden="true" /> Salir de mi cuenta
                </button>
              </nav>
            </>
          ) : (
            <div className="p-2">
              <p className="font-display text-lg font-bold">Mi cuenta</p>
              <p className="mt-0.5 mb-3 text-sm text-muted">
                Entrá para sumar tus compras al <b className="text-forest">Club Natu Mariel</b> 🎁 y ver tus pedidos desde cualquier celular.
              </p>
              {providers.length > 0 ? (
                <AccountLogin next={pathname || "/"} providers={providers} />
              ) : (
                <p className="rounded-2xl bg-cream p-3 text-sm font-semibold">Muy pronto vas a poder entrar con tu cuenta. 💖</p>
              )}
              <Link href="/club" onClick={() => setOpen(false)} className="mt-3 flex items-center gap-2 px-1 text-sm font-semibold text-coral-deep underline">
                <Gift className="size-4" aria-hidden="true" /> Cómo funciona el Club
              </Link>
              <Link href="/mi-pedido" onClick={() => setOpen(false)} className="mt-2 flex items-center gap-2 px-1 text-sm font-semibold text-coral-deep underline">
                <Package className="size-4" aria-hidden="true" /> Seguir un pedido sin cuenta
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
