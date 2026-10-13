import { CheckCircle2, CircleAlert } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { getSiteUrl } from "@/lib/config";
import { getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata = { title: "Configuración" };

function Status({ ok, label, children }: { ok: boolean; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-3xl bg-warm-white p-5 shadow-soft">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-botanical" aria-hidden="true" />
      ) : (
        <CircleAlert className="mt-0.5 size-6 shrink-0 text-coral-deep" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="font-semibold">
          {label}: <span className={ok ? "text-botanical-deep" : "text-coral-deep"}>{ok ? "configurado" : "pendiente"}</span>
        </p>
        <div className="mt-1 text-sm text-muted">{children}</div>
      </div>
    </li>
  );
}

export default async function SettingsPage() {
  await requireAdmin();
  const whatsapp = getWhatsAppNumber();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ? getSiteUrl() : null;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold">Configuración</h1>
      <p className="text-muted">Estado de las integraciones de la tienda.</p>
      <ul className="mt-6 flex flex-col gap-3">
        <Status ok={Boolean(whatsapp)} label="WhatsApp para pedidos">
          {whatsapp ? (
            <p>Los pedidos se envían al número terminado en …{whatsapp.slice(-4)}.</p>
          ) : (
            <>
              <p>
                Para activar los pedidos, cargá en Vercel la variable <code className="font-mono">NEXT_PUBLIC_WHATSAPP_NUMBER</code>{" "}
                con el número en formato internacional, solo dígitos (para un celular de Argentina: 549 + código de área sin 0 + número
                sin 15). Después hay que volver a desplegar el sitio.
              </p>
            </>
          )}
        </Status>
        <Status ok={Boolean(siteUrl)} label="Dirección del sitio">
          {siteUrl ? (
            <p>{siteUrl}</p>
          ) : (
            <p>
              Opcional. Cargá <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> con el dominio definitivo (ej.
              https://natumariel.com.ar) para que los enlaces compartidos y el sitemap usen esa dirección.
            </p>
          )}
        </Status>
        <Status ok label="Base de datos y fotos">
          <p>Conectado a Supabase. Los productos que publiques aparecen en la tienda al instante.</p>
        </Status>
      </ul>
    </div>
  );
}
