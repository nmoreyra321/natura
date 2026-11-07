import { Download } from "lucide-react";

import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { requireAdmin } from "@/lib/auth";
import { ML_FIXED_TIERS_DEFAULT } from "@/lib/mercadolibre";

export const metadata = { title: "Planilla para Mercado Libre" };

export default async function MercadoLibrePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl font-bold">Planilla para Mercado Libre</h1>
      <p className="mt-1 text-muted">
        Baja un Excel con tus productos ya armados para Mercado Libre: título de hasta 60 letras, precio ya ajustado para no perder plata (comisión, costo fijo y envío), stock, descripción y fotos.
        Después copiás los datos en la planilla de carga masiva de Mercado Libre.
      </p>

      <form method="get" action="/admin/mercadolibre/planilla" className="mt-5 flex flex-col gap-4 rounded-3xl bg-warm-white p-5 shadow-soft">
        <label className="text-sm font-semibold">
          Comisión que te cobra Mercado Libre
          <select name="comision" defaultValue="16" className={`${inputClasses} mt-1 h-11`}>
            <option value="0">0% (mismo precio que la tienda)</option>
            <option value="12">12%</option>
            <option value="14">14%</option>
            <option value="16">16% (recomendado para empezar)</option>
            <option value="18">18%</option>
            <option value="20">20%</option>
            <option value="25">25%</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-muted">
            El precio sube lo justo para que, después de la comisión, el costo fijo y el envío, te quede al menos lo mismo que en la tienda. La comisión exacta la ves en Mercado Libre al publicar el primer producto.
          </span>
        </label>
        <details className="rounded-2xl bg-cream p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Cambiar los costos de Mercado Libre (no hace falta tocarlo)
          </summary>
          <div className="mt-3 flex flex-col gap-4">
          <input type="hidden" name="fijo" value="0" />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="fijo" value="1" defaultChecked className="size-5 accent-[var(--coral-deep)]" />
            Sumar el costo fijo por unidad
          </label>
          <p className="mt-1 text-xs text-muted">
            Aparte de la comisión, Mercado Libre cobra un monto fijo por cada producto barato. Sin esto, en los productos baratos perdés plata.
            Son valores de referencia (agosto 2026): si al publicar te muestra otros, cambialos acá.
          </p>
          <div className="mt-2 grid gap-2">
            {ML_FIXED_TIERS_DEFAULT.map((t, i) => (
              <div key={t.upTo} className="flex flex-wrap items-center gap-1.5 text-sm">
                <span>Hasta $</span>
                <input name={`hasta${i + 1}`} defaultValue={t.upTo} inputMode="numeric" aria-label={`Tramo ${i + 1}: precio hasta`} className={`${inputClasses} h-9 w-24`} />
                <span>cobra $</span>
                <input name={`fijo${i + 1}`} defaultValue={t.fee} inputMode="numeric" aria-label={`Tramo ${i + 1}: costo fijo`} className={`${inputClasses} h-9 w-20`} />
              </div>
            ))}
            <p className="text-xs text-muted">Más caro que el último: sin costo fijo.</p>
          </div>
        <label className="text-sm font-semibold">
          Envío que pagás vos por cada venta ($)
          <input name="envio" defaultValue="0" inputMode="numeric" className={`${inputClasses} mt-1 h-11`} />
          <span className="mt-1 block text-xs font-normal text-muted">
            Si ofrecés envío gratis (en los productos caros Mercado Libre lo exige), poné cuánto te descuentan por envío. Si lo paga la clienta, dejá 0.
          </span>
        </label>
          </div>
        </details>
        <input type="hidden" name="stock" value="0" />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="stock" value="1" defaultChecked className="size-5 accent-[var(--coral-deep)]" />
          Solo los productos que tengo en stock
        </label>
        <button type="submit" className={buttonClasses("primary", "lg")}>
          <Download className="size-5" aria-hidden="true" /> Descargar la planilla
        </button>
      </form>

      <p className="mt-4 rounded-2xl bg-sun/50 p-4 text-sm">
        <b>Antes de publicar:</b> confirmá con Natura que podés vender en Mercado Libre, y fijate que cada producto coincida con la ficha del catálogo de Mercado Libre (marca, tamaño y versión).
        En la planilla, la columna «Para revisar» te marca lo que falta.
      </p>
    </div>
  );
}
