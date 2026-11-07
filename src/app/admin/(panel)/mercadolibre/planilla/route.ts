import type { NextRequest } from "next/server";

import { getAdminContext } from "@/lib/auth";
import { getSiteUrl } from "@/lib/config";
import { productImageUrl } from "@/lib/images";
import { mlDescription, mlFixedFee, mlIssues, mlNet, mlPrice, mlShippingCost, mlTitle, parseMlSettings, type MlCosts } from "@/lib/mercadolibre";
import { buildXlsx, type Sheet } from "@/lib/xlsx";

/** Planilla para cargar productos en Mercado Libre. Solo para administradoras. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getAdminContext();
  if (!ctx) return new Response("No autorizado", { status: 401 });
  const { supabase } = ctx;

  const params = request.nextUrl.searchParams;
  // Las casillas mandan "0" (campo oculto) y, si están tildadas, también "1".
  const checked = (name: string) => (params.has(name) ? params.getAll(name).includes("1") : true);
  const onlyStock = checked("stock");
  // Los costos de Mercado Libre guardados en la página «Planilla para Mercado Libre».
  const { data: settings } = await supabase.from("store_settings").select("ml_costs").eq("id", 1).maybeSingle();
  const ml = parseMlSettings(settings?.ml_costs);
  const commission = ml.commission;
  const fixedTiers = ml.fixedTiers;
  const freeShipping = ml.freeShipping;
  const costs: MlCosts = { fixedTiers, freeShipping };

  let query = supabase
    .from("products")
    .select("name, slug, size, line, natura_sku, description, magazine_price, sale_price, stock, category:categories(name), images:product_images(storage_path, position)")
    .eq("status", "published")
    .gt("magazine_price", 1)
    .order("name")
    .limit(5000);
  if (onlyStock) query = query.gt("stock", 0);
  const { data, error } = await query;
  if (error) return new Response("No pudimos armar la planilla. Probá de nuevo.", { status: 503 });

  const site = getSiteUrl();
  let withIssues = 0;
  const rows = (data ?? []).map((p) => {
    const { title, shortened } = mlTitle(p.name);
    const photos = [...(p.images ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((i) => productImageUrl(i.storage_path))
      .filter((u): u is string => !!u)
      .slice(0, 3);
    const description = mlDescription(p.description);
    const issues = mlIssues({ shortened, photos, description, naturaSku: p.natura_sku });
    if (issues) withIssues++;
    const price = mlPrice(Number(p.sale_price), commission, costs);
    return [
      title,
      "Natura",
      p.category?.name ?? "",
      "Nuevo",
      "Clásica",
      price,
      Number(p.sale_price),
      mlFixedFee(price, fixedTiers),
      mlShippingCost(price, costs),
      mlNet(price, commission, costs),
      p.stock,
      description,
      photos[0] ?? "",
      photos[1] ?? "",
      photos[2] ?? "",
      p.size ?? "",
      p.line ?? "",
      p.natura_sku ?? "",
      site ? `${site}/productos/${p.slug}` : "",
      issues,
    ];
  });

  const sheets: Sheet[] = [
    {
      name: "Productos",
      rows: [
        ["Título (hasta 60 letras)", "Marca", "Tu categoría", "Condición", "Tipo de publicación", "Precio para Mercado Libre", "Tu precio en la tienda", "Costo fijo de Mercado Libre", "Envío que pagás", "Te queda por venta", "Stock", "Descripción", "Foto 1", "Foto 2", "Foto 3", "Tamaño", "Línea", "Código Natura", "Enlace en tu tienda", "Para revisar"],
        ...rows,
      ],
    },
    {
      name: "Cómo usarla",
      rows: [
        ["Cómo usar esta planilla"],
        ["Esta planilla NO se sube directo: Mercado Libre pide su propia planilla de carga masiva, que cambia según la categoría. Esta es tu base con todo ya armado para copiar y pegar."],
        ["1. En Mercado Libre: Vendé → Publicaciones → Carga masiva (Excel). Elegí la categoría y descargá su planilla."],
        ["2. Copiá de esta planilla: Título, Precio para Mercado Libre, Stock, Descripción y las fotos (los enlaces de Foto 1, 2 y 3)."],
        ["3. Revisá la columna «Para revisar»: títulos acortados, productos sin fotos o sin descripción."],
        ["4. Muchos productos de perfumería y cuidado personal se publican asociados al catálogo de Mercado Libre. Fijate que el producto coincida con la ficha del catálogo (marca, tamaño, versión). Para encontrarlo, usá el Código Natura."],
        [
          `5. El precio está calculado para que, después de que Mercado Libre te descuente ${commission}% de comisión${fixedTiers.length ? ", el costo fijo por unidad" : ""}${freeShipping.cost ? ` y, desde $${freeShipping.from}, $${freeShipping.cost} de envío gratis` : ""}, te quede al menos tu precio de la tienda (redondeado hacia arriba a $10). La columna «Te queda por venta» muestra cuánto te queda en cada uno.`,
        ],
        [
          fixedTiers.length
            ? `Costo fijo usado: ${fixedTiers.map((t, i) => `${i === 0 ? "hasta" : `de $${fixedTiers[i - 1].upTo} a`} $${t.upTo}: $${t.fee}`).join(" · ")} · más caro: sin costo fijo. Mercado Libre lo cambia seguido: si al publicar te muestra otro, cambialo en la página «Planilla para Mercado Libre» y bajá la planilla de nuevo.`
            : "No se sumó costo fijo por unidad.",
        ],
        ["Si al publicar Mercado Libre te muestra una comisión o un envío distintos, cambialos en la página «Planilla para Mercado Libre» y bajá la planilla de nuevo. Además pueden descontarte impuestos (Ingresos Brutos), que dependen de tu situación."],
        ["6. Antes de empezar, confirmá con Natura que podés vender en Mercado Libre."],
        ["7. Si vendés en los dos lados, acordate de bajar el stock en la tienda y en Mercado Libre cuando se venda algo."],
        [`Productos incluidos: ${rows.length}${onlyStock ? " (solo con stock)" : ""}. Con algo para revisar: ${withIssues}.`],
      ],
    },
  ];

  const stamp = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
  const file = buildXlsx(sheets);
  return new Response(Buffer.from(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mercado-libre-natu-mariel-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
