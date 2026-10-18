import { CheckCircle2, CircleAlert } from "lucide-react";

import { SettingCard } from "@/components/admin/setting-card";
import { formatARS } from "@/lib/format";
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
  const { data: zones } = await supabase.from("shipping_zones").select("id, name, percent, is_active").order("position").order("name");
  const whatsapp = getWhatsAppNumber();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ? getSiteUrl() : null;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Ajustes</h1>

      <div className="mt-6">
        <PushToggle />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <SettingCard
          icon="🏦"
          title="Cómo te pagan"
          state={
            settings?.transfer_alias || settings?.transfer_cbu ? (
              <>
                Alias <strong>{settings?.transfer_alias ?? settings?.transfer_cbu}</strong>
                {settings?.transfer_holder ? ` · ${settings.transfer_holder}` : ""}
              </>
            ) : (
              "Todavía no cargaste tu alias"
            )
          }
        >
          <p className="mb-4 text-base text-muted">Es lo que ve la clienta cuando elige pagar por transferencia.</p>
          <TransferSettingsForm
            defaults={{
              mpLink: settings?.mp_link ?? "",
              alias: settings?.transfer_alias ?? "",
              cbu: settings?.transfer_cbu ?? "",
              holder: settings?.transfer_holder ?? "",
              bank: settings?.transfer_bank ?? "",
            }}
          />
        </SettingCard>

        {/* Recargo: solo si se conecta la cuenta de Mercado Pago (MP_ACCESS_TOKEN). */}
        {isMercadoPagoEnabled() ? (
          <SettingCard icon="💳" title="Recargo de Mercado Pago" state={<>Hoy: <strong>{String(Number(settings?.mp_surcharge_percent ?? 0)).replace(".", ",")} %</strong></>}>
            <p className="mb-4 text-base text-muted">Se suma solo si la clienta paga con Mercado Pago, para que la comisión no la pagues vos.</p>
            <SurchargeForm defaultPercent={Number(settings?.mp_surcharge_percent ?? 0)} />
          </SettingCard>
        ) : null}

        <SettingCard
          icon="🚚"
          title="Envíos"
          state={`Desde ${formatARS(Math.round(Number(settings?.shipping_min_total ?? 35000) * 100))} · ${(zones ?? []).filter((z) => z.is_active).length} localidades`}
        >
          <p className="mb-4 text-base text-muted">El envío es un porcentaje de la compra y se suma solo al total. Debajo de la compra mínima no se ofrece.</p>
          <ShippingPricesForm
            zones={(zones ?? []).map((z) => ({ id: z.id, name: z.name, percent: Number(z.percent), is_active: z.is_active }))}
            minTotal={Number(settings?.shipping_min_total ?? 35000)}
          />
        </SettingCard>

        <SettingCard
          icon="📱"
          title="Redes sociales"
          state={settings?.instagram_url || settings?.facebook_url ? "Cargadas" : "Todavía no cargaste ninguna"}
        >
          <p className="mb-4 text-base text-muted">Aparecen en «Quiénes somos». Si dejás una vacía, no se muestra.</p>
          <SocialLinksForm defaults={{ facebook: settings?.facebook_url ?? "", instagram: settings?.instagram_url ?? "" }} />
        </SettingCard>
      </div>

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
        <Status ok label="Productos y fotos">
          <p>Conectado. Los productos que publiques aparecen en la tienda al instante.</p>
        </Status>
      </ul>
    </div>
  );
}
