import type { NextRequest } from "next/server";

import { getAdminContext } from "@/lib/auth";
import { getSiteUrl } from "@/lib/config";
import { productImageUrl } from "@/lib/images";
import { mlDescription, mlIssues, mlPrice, mlTitle } from "@/lib/mercadolibre";
import { buildXlsx, type Sheet } from "@/lib/xlsx";

/** Planilla para cargar productos en Mercado Libre. Solo para administradoras. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getAdminContext();
  if (!ctx) return new Response("No autorizado", { status: 401 });
  const { supabase } = ctx;

  const params = request.nextUrl.searchParams;
  const commission = Math.min(Math.max(Number(params.get("comision")) || 0, 0), 60);
  const onlyStock = params.get("stock") !== "0";

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
    return [
      title,
      "Natura",
      p.category?.name ?? "",
      "Nuevo",
      "Clásica",
      mlPrice(Number(p.sale_price), commission),
      Number(p.sale_price),
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
        ["Título (hasta 60 letras)", "Marca", "Tu categoría", "Condición", "Tipo de publicación", "Precio para Mercado Libre", "Tu precio en la tienda", "Stock", "Descripción", "Foto 1", "Foto 2", "Foto 3", "Tamaño", "Línea", "Código Natura", "Enlace en tu tienda", "Para revisar"],
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
        [`5. El precio está calculado para que, si Mercado Libre te descuenta ${commission}% de comisión, te quede tu precio de la tienda (redondeado hacia arriba a $10). Aparte, Mercado Libre puede cobrar un costo fijo por venta y el envío: mirá lo que te dice al publicar. Si no coincide, generá la planilla de nuevo con otro porcentaje.`],
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
