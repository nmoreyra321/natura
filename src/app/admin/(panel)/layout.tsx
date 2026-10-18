import type { Metadata } from "next";

import { AdminNav } from "@/components/admin/admin-nav";
import { SetupPending } from "@/components/admin/setup-pending";
import { requireAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";

// El panel depende de la sesión: nunca se prerenderiza ni se cachea.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel Natu Mariel" },
  robots: { index: false, follow: false },
  // «Agregar a inicio» estando en el panel crea su propio ícono, que abre directo el panel.
  manifest: "/panel.webmanifest",
  appleWebApp: { capable: true, title: "Panel NM" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupPending />;
  const { user, supabase } = await requireAdmin();
  // Número rojo de «Pedidos»: nuevos sin confirmar y pagos avisados por revisar.
  const { count: pedidosCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .neq("status", "cancelled")
    .or("status.eq.pending,and(payment_reported_at.not.is.null,payment_status.is.null)");
  return (
    <div className="flex min-h-dvh flex-col bg-cream lg:flex-row" style={{ "--cream": "#f1f7f3", "--line": "#dcebe1" } as React.CSSProperties}>
      <AdminNav email={user.email} pedidosCount={pedidosCount ?? 0} />
      <main id="contenido" className="min-w-0 flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-10 lg:py-10 lg:pb-10">
        {children}
      </main>
    </div>
  );
}
