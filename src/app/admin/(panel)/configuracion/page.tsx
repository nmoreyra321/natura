import { CheckCircle2, CircleAlert } from "lucide-react";

import { PushToggle } from "@/components/admin/push-toggle";
import { ShippingPricesForm } from "@/components/admin/shipping-prices-form";
import { SocialLinksForm } from "@/components/admin/social-links-form";
import { SurchargeForm } from "@/components/admin/surcharge-form";
import { TransferSettingsForm } from "@/components/admin/transfer-settings-form";
import { requireAdmin } from "@/lib/auth";
import { getSiteUrl } from "@/lib/config";
import { isMercadoPagoEnabled } from "@/lib/mercadopago";
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
  const { supabase } = await requireAdmin();
  const { data: settings } = await supabase
    .from("store_settings")
    .select("transfer_alias, transfer_cbu, transfer_holder, transfer_bank, mp_link, mp_surcharge_percent, facebook_url, instagram_url, shipping_min_total")
    .eq("id", 1)
    .maybeSingle();
  const { data: zones } = await supabase.from("shipping_zones").select("id, name, percent").order("position").order("name");
  const whatsapp = getWhatsAppNumber();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ? getSiteUrl() : null;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Configuración</h1>
      <p className="text-muted">Estado de las integraciones de la tienda.</p>

      <div className="mt-6">
        <PushToggle />
      </div>

      <section className="mt-6 rounded-3xl bg-warm-white p-5 shadow-soft">
        <h2 className="font-display text-xl font-bold">Cómo te pagan las clientas</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Con el <strong>link de pago</strong> cargado, en el carrito aparece <strong>Mercado Pago</strong>: en la página
          de su pedido la clienta abre tu link, paga y toca «Ya pagué». Vos tocás «Confirmar pago» en Pedidos. Si no hay link, se
          ofrece <strong>Transferencia</strong> con el alias. Si borrás todo, la opción desaparece.
        </p>
        <TransferSettingsForm
          defaults={{
            mpLink: settings?.mp_link ?? "",
            alias: settings?.transfer_alias ?? "",
            cbu: settings?.transfer_cbu ?? "",
            holder: settings?.transfer_holder ?? "",
            bank: settings?.transfer_bank ?? "",
          }}
        />
      </section>

      <section className="mt-4 rounded-3xl bg-warm-white p-5 shadow-soft">
        <h2 className="font-display text-xl font-bold">Envíos a domicilio</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          La clienta paga un % de su compra según la localidad, y se suma solo al total del pedido. Como es un %, si
          suben los precios, el envío sube solo.
        </p>
        <ShippingPricesForm
          zones={(zones ?? []).map((z) => ({ id: z.id, name: z.name, percent: Number(z.percent) }))}
          minTotal={Number(settings?.shipping_min_total ?? 35000)}
        />
      </section>

      <section className="mt-4 rounded-3xl bg-warm-white p-5 shadow-soft">
        <h2 className="font-display text-xl font-bold">Redes sociales</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Aparecen en la página <strong>Quiénes somos</strong> de la tienda, con un botón para seguirte. Si dejás uno vacío,
          no se muestra.
        </p>
        <SocialLinksForm defaults={{ facebook: settings?.facebook_url ?? "", instagram: settings?.instagram_url ?? "" }} />
      </section>

      {/* Cobro con link de Mercado Pago: solo si se conecta la cuenta (MP_ACCESS_TOKEN). */}
      {isMercadoPagoEnabled() ? (
      <section className="mt-4 rounded-3xl bg-warm-white p-5 shadow-soft">
        <h2 className="font-display text-xl font-bold">Cobrar con Mercado Pago</h2>
        <p className="mt-1 text-sm text-muted">
          Activo: en el carrito aparece <strong>Mercado Pago</strong>. Mercado Pago cobra una comisión por cada venta;
          con el recargo la paga la clienta.
        </p>
        <div className="mt-4">
          <SurchargeForm defaultPercent={Number(settings?.mp_surcharge_percent ?? 0)} />
        </div>
      </section>
      ) : null}
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
