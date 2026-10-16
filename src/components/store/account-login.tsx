"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { getBrowserClient } from "@/lib/supabase/browser";

type Provider = "google" | "facebook";

/** «Continuar con Google / Facebook»: sin contraseña. Vuelve a `next` después de entrar. */
export function AccountLogin({ next = "/cuenta", providers }: { next?: string; providers: Provider[] }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (provider: Provider) => {
    const supabase = getBrowserClient();
    if (!supabase) return setError("La tienda no está configurada.");
    setPending(provider);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setPending(null);
      setError("No pudimos abrir el ingreso. Probá de nuevo en un rato.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {providers.includes("google") ? (
      <button
        type="button"
        onClick={() => go("google")}
        disabled={pending !== null}
        className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-white px-5 font-bold text-forest shadow-soft ring-1 ring-line transition hover:bg-cream disabled:opacity-60"
      >
        {pending === "google" ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <GoogleIcon />}
        Continuar con Google
      </button>
      ) : null}
      {providers.includes("facebook") ? (
      <button
        type="button"
        onClick={() => go("facebook")}
        disabled={pending !== null}
        className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-[#1877f2] px-5 font-bold text-white shadow-soft transition hover:bg-[#166fe5] disabled:opacity-60"
      >
        {pending === "facebook" ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <FacebookIcon />}
        Continuar con Facebook
      </button>
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-coral-deep" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}
