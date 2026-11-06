import { Download } from "lucide-react";

import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Planilla para Mercado Libre" };

export default async function MercadoLibrePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-3xl font-bold">Planilla para Mercado Libre</h1>
      <p className="mt-1 text-muted">
        Baja un Excel con tus productos ya armados para Mercado Libre: título de hasta 60 letras, precio con la comisión sumada, stock, descripción y fotos.
        Después copiás los datos en la planilla de carga masiva de Mercado Libre.
      </p>

      <form method="get" action="/admin/mercadolibre/planilla" className="mt-5 flex flex-col gap-4 rounded-3xl bg-warm-white p-5 shadow-soft">
        <label className="text-sm font-semibold">
          Recargo para la comisión de Mercado Libre
          <select name="recargo" defaultValue="15" className={`${inputClasses} mt-1 h-11`}>
            <option value="0">Sin recargo (mismo precio que la tienda)</option>
            <option value="10">10%</option>
            <option value="13">13%</option>
            <option value="15">15% (recomendado)</option>
            <option value="18">18%</option>
            <option value="20">20%</option>
            <option value="25">25%</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-muted">
            Mercado Libre cobra una comisión por cada venta. Con este recargo el precio de ahí sube para no perder plata.
          </span>
        </label>
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
