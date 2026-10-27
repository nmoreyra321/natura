import { getAdminContext } from "@/lib/auth";
import { buildXlsx, type Sheet } from "@/lib/xlsx";

/** Copia de seguridad: un Excel con productos, pedidos, clientas y reseñas. Solo para administradoras. */
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "Pendiente", confirmed: "Confirmado", delivered: "Entregado", cancelled: "Cancelado" };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }) : "");

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx) return new Response("No autorizado", { status: 401 });
  const { supabase } = ctx;

  const [products, orders, items, reviews, categories] = await Promise.all([
    supabase
      .from("products")
      .select("name, size, line, natura_sku, magazine_price, sale_price, stock, status, is_offer, category_id, created_at")
      .order("name")
      .limit(20000),
    supabase
      .from("orders")
      .select("id, code, created_at, customer_name, customer_phone, total, amount_paid, status, payment_method, payment_status, delivery_method, shipping_cost, channel")
      .order("created_at", { ascending: false })
      .limit(20000),
    supabase.from("order_items").select("order_id, name, size, quantity, unit_price, magazine_price").limit(100000),
    supabase.from("reviews").select("name, rating, comment, reply, created_at").order("created_at", { ascending: false }).limit(5000),
    supabase.from("categories").select("id, name"),
  ]);
  if (products.error || orders.error || items.error || reviews.error) {
    return new Response("No pudimos armar la copia. Probá de nuevo.", { status: 503 });
  }

  const catName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
  const codeOf = new Map((orders.data ?? []).map((o) => [o.id, o.code]));

  const clientas = new Map<string, { name: string; phone: string; pedidos: number; total: number; ultima: string }>();
  for (const o of orders.data ?? []) {
    if (o.status === "cancelled" || !o.customer_phone) continue;
    const prev = clientas.get(o.customer_phone);
    clientas.set(o.customer_phone, {
      name: prev?.name || o.customer_name || "",
      phone: o.customer_phone,
      pedidos: (prev?.pedidos ?? 0) + 1,
      total: (prev?.total ?? 0) + Number(o.total),
      ultima: prev && prev.ultima > o.created_at ? prev.ultima : o.created_at,
    });
  }

  const sheets: Sheet[] = [
    {
      name: "Productos",
      rows: [
        ["Nombre", "Tamaño", "Categoría", "Línea", "Código Natura", "Precio de revista", "Tu precio de venta", "Stock", "Estado", "Oferta", "Creado"],
        ...(products.data ?? []).map((p) => [
          p.name, p.size, p.category_id ? catName.get(p.category_id) : "", p.line, p.natura_sku,
          Number(p.magazine_price), Number(p.sale_price), p.stock, p.status === "published" ? "Publicado" : "Borrador", p.is_offer, day(p.created_at),
        ]),
      ],
    },
    {
      name: "Pedidos",
      rows: [
        ["Código", "Fecha", "Clienta", "WhatsApp", "Total", "Pagado", "Estado", "Forma de pago", "Entrega", "Envío", "Canal"],
        ...(orders.data ?? []).map((o) => [
          o.code, day(o.created_at), o.customer_name, o.customer_phone, Number(o.total), Number(o.amount_paid),
          STATUS[o.status] ?? o.status, o.payment_method, o.delivery_method, Number(o.shipping_cost), o.channel,
        ]),
      ],
    },
    {
      name: "Detalle de pedidos",
      rows: [
        ["Pedido", "Producto", "Tamaño", "Cantidad", "Precio unitario", "Precio de revista"],
        ...(items.data ?? []).map((i) => [codeOf.get(i.order_id) ?? "", i.name, i.size, i.quantity, Number(i.unit_price), Number(i.magazine_price)]),
      ],
    },
    {
      name: "Clientas",
      rows: [
        ["Nombre", "WhatsApp", "Pedidos", "Total comprado", "Última compra"],
        ...[...clientas.values()].sort((a, b) => b.total - a.total).map((c) => [c.name, c.phone, c.pedidos, c.total, day(c.ultima)]),
      ],
    },
    {
      name: "Reseñas",
      rows: [
        ["Nombre", "Estrellas", "Reseña", "Respuesta", "Fecha"],
        ...(reviews.data ?? []).map((r) => [r.name, r.rating, r.comment, r.reply, day(r.created_at)]),
      ],
    },
  ];

  const stamp = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
  const file = buildXlsx(sheets);
  return new Response(Buffer.from(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="copia-natu-mariel-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
