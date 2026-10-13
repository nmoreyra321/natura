import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupPending } from "@/components/admin/setup-pending";
import { LoginForm } from "@/components/admin/login-form";
import { LeafMark } from "@/components/store/logo";
import { getAdminContext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";

// El panel depende de la sesión: nunca se prerenderiza ni se cachea.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ingresar al panel",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (!isSupabaseConfigured()) return <SetupPending />;
  if (await getAdminContext()) redirect("/admin");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-blush via-cream to-sage px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-warm-white p-6 shadow-lift sm:p-8">
        <div className="flex items-center gap-2">
          <LeafMark className="size-9 text-botanical" />
          <p className="font-display text-2xl font-semibold">
            Natu <span className="italic text-coral-deep">Mariel</span>
          </p>
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold">Panel de administración</h1>
        <p className="mt-1 text-muted">Ingresá con tu correo y contraseña.</p>
        <LoginForm />
      </div>
    </main>
  );
}
