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
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupPending />;
  const { user } = await requireAdmin();
  return (
    <div className="flex min-h-dvh flex-col bg-cream lg:flex-row">
      <AdminNav email={user.email} />
      <main id="contenido" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
