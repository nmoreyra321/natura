import { Settings } from "lucide-react";

/** Se muestra cuando faltan las variables de Supabase. No simula un login. */
export function SetupPending() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl bg-warm-white p-6 shadow-lift sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-full bg-coral-soft text-coral-deep">
          <Settings className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">Configuración pendiente</h1>
        <p className="mt-2 text-muted">
          El panel todavía no está conectado a la base de datos. Para habilitarlo hay que cargar estas variables de
          entorno en Vercel y volver a desplegar:
        </p>
        <ul className="mt-4 flex flex-col gap-1 rounded-2xl bg-cream p-4 font-mono text-sm">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY)</li>
        </ul>
        <p className="mt-4 text-sm text-muted">Los pasos completos están en el archivo README.md del repositorio.</p>
      </div>
    </main>
  );
}
