import { Download, Save } from "lucide-react";

import { saveMlCosts } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { requireAdmin } from "@/lib/auth";
import { formatARS } from "@/lib/format";
import { parseMlSettings } from "@/lib/mercadolibre";

export const metadata = { title: "Planilla para Mercado Libre" };

const pesos = (n: number) => formatARS(Math.round(n * 100));
const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });

export default async function MercadoLibrePage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("store_settings").select("ml_costs").eq("id", 1).maybeSingle();
  const ml = parseMlSettings(data?.ml_costs);
  const t = ml.fixedTiers;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl font-bold">Planilla para Mercado Libre</h1>
      <p className="mt-1 text-muted">
        Baja un Excel con tus productos listos para Mercado Libre. El precio ya está calculado para que, después de todo lo que te
        descuenta Mercado Libre, te quede lo mismo que cobrás en tu tienda.
      </p>

      <form method="get" action="/admin/mercadolibre/planilla" className="mt-5 flex flex-col gap-4 rounded-3xl bg-warm-white p-5 shadow-soft">
        <input type="hidden" name="stock" value="0" />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="stock" value="1" defaultChecked className="size-5 accent-[var(--coral-deep)]" />
          Solo los productos que tengo en stock
        </label>
        <button type="submit" className={buttonClasses("primary", "lg")}>
          <Download className="size-5" aria-hidden="true" /> Descargar la planilla
        </button>
      </form>

      <div className="mt-5 rounded-3xl bg-warm-white p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Lo que te cobra Mercado Libre</h2>
        <p className="mt-1 text-xs text-muted">
          {ml.updatedAt ? `Lo actualizaste el ${dateFmt.format(new Date(ml.updatedAt))}.` : "Valores de septiembre de 2026."}
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          <li>
            • Se queda con el <b>{ml.commission}%</b> de cada venta.
          </li>
          {t.map((tier, i) => (
            <li key={tier.upTo}>
              • Si el producto sale {i === 0 ? "menos de" : `entre ${pesos(t[i - 1].upTo)} y`} <b>{pesos(tier.upTo)}</b>, te cobra{" "}
              <b>{pesos(tier.fee)}</b> más.
            </li>
          ))}
          <li>
            • Si sale <b>{pesos(ml.freeShipping.from)} o más</b>, el envío es gratis para la clienta y a vos te cobra{" "}
            <b>{pesos(ml.freeShipping.cost)}</b>.
          </li>
        </ul>

        <details className="mt-4 rounded-2xl bg-cream p-3">
          <summary className="cursor-pointer text-sm font-semibold text-coral-deep">Mercado Libre cambió los costos: actualizarlos</summary>
          <p className="mt-2 text-xs text-muted">
            Cuando publiques un producto, Mercado Libre te muestra cuánto te cobra. Si es distinto de lo de arriba, cambiá los números acá y tocá
            «Guardar». La planilla se arma sola con los nuevos.
          </p>
          <form action={saveMlCosts} className="mt-3 flex flex-col gap-3 text-sm">
            <label className="font-semibold">
              Porcentaje que se queda Mercado Libre
              <span className="mt-1 flex items-center gap-1.5">
                <input name="comision" defaultValue={ml.commission} inputMode="decimal" className={`${inputClasses} h-10 w-20`} />
                <span>%</span>
              </span>
            </label>
            <div className="font-semibold">
              Lo que cobra de más en los productos baratos
              {[0, 1, 2].map((i) => (
                <div key={i} className="mt-1.5 flex flex-wrap items-center gap-1.5 font-normal">
                  <span>{i === 0 ? "Menos de $" : "Hasta $"}</span>
                  <input name={`hasta${i + 1}`} defaultValue={t[i]?.upTo ?? ""} inputMode="numeric" aria-label={`Precio hasta (${i + 1})`} className={`${inputClasses} h-10 w-28`} />
                  <span>cobra $</span>
                  <input name={`fijo${i + 1}`} defaultValue={t[i]?.fee ?? ""} inputMode="numeric" aria-label={`Lo que cobra (${i + 1})`} className={`${inputClasses} h-10 w-24`} />
                </div>
              ))}
            </div>
            <div className="font-semibold">
              Envío gratis
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-normal">
                <span>Desde $</span>
                <input name="gratisdesde" defaultValue={ml.freeShipping.from} inputMode="numeric" aria-label="Envío gratis desde" className={`${inputClasses} h-10 w-28`} />
                <span>te cobra $</span>
                <input name="envio" defaultValue={ml.freeShipping.cost} inputMode="numeric" aria-label="Lo que te cobra de envío" className={`${inputClasses} h-10 w-24`} />
              </div>
            </div>
            <button type="submit" className={buttonClasses("outline")}>
              <Save className="size-4" aria-hidden="true" /> Guardar
            </button>
          </form>
        </details>
      </div>

      <p className="mt-4 rounded-2xl bg-sun/50 p-4 text-sm">
        <b>Antes de publicar:</b> confirmá con Natura que podés vender en Mercado Libre. En la planilla, la columna «Para revisar» te marca lo que
        falta (fotos, descripción, títulos acortados).
      </p>
    </div>
  );
}
