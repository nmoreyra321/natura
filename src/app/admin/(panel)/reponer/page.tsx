import { ShoppingBasket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CopyOrderButtons } from "@/components/admin/copy-order-button";
import { ProductImageFallback } from "@/components/store/product-card";
import { requireAdmin } from "@/lib/auth";
import { productImageUrl } from "@/lib/images";
import { historyDays, reorderText, salesDays, salesPeriodText, salesWindowStart, suggestReorder } from "@/lib/reorder";

export const metadata = { title: "Qué pedirle a Natura" };

type Search = Record<string, string | string[] | undefined>;
const WEEKS = [2, 4, 6, 8] as const;

export default async function ReorderPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const asked = Number(Array.isArray(sp.semanas) ? sp.semanas[0] : sp.semanas);
  const weeks = WEEKS.find((w) => w === asked) ?? 4;

  const since = salesWindowStart();
  const [{ data: products, error }, { data: sales }] = await Promise.all([
    supabase.from("products").select("id, name, size, stock, natura_sku, images:product_images(storage_path, position)").limit(3000),
    supabase
      .from("order_items")
      .select("product_id, quantity, order:orders!inner(status, created_at)")
      .in("order.status", ["confirmed", "delivered"])
      .gte("order.created_at", since)
      .limit(20000),
  ]);

  // Días con historia de ventas: desde la primera venta de la ventana (la tienda puede ser nueva).
  const firstSale = (sales ?? []).reduce<string | null>((min, s) => {
    const at = (s.order as unknown as { created_at: string } | null)?.created_at ?? null;
    return at && (!min || at < min) ? at : min;
  }, null);
  const history = historyDays(firstSale);
  const period = salesPeriodText(salesDays(history));
  const sold = new Map<string, number>();
  for (const s of sales ?? []) if (s.product_id) sold.set(s.product_id, (sold.get(s.product_id) ?? 0) + s.quantity);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const list = suggestReorder(
    (products ?? []).map((p) => ({ id: p.id, name: p.name, stock: p.stock, sold: sold.get(p.id) ?? 0 })),
    weeks * 7,
    history,
  );
  const units = list.reduce((s, r) => s + r.order, 0);
  const text = reorderText(list.map((r) => ({ name: r.name, order: r.order, sku: byId.get(r.id)?.natura_sku ?? null })));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Qué pedirle a Natura</h1>
      <p className="mt-1 text-muted">
        Te armamos la lista para tu próximo pedido. Para cada producto miramos <b className="text-forest">cuánto vendiste en {period}</b>{" "}
        y <b className="text-forest">cuánto te queda</b>, y calculamos cuántos te faltan para que te alcancen las semanas que elijas.
      </p>

      <nav aria-label="Para cuánto tiempo" className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Quiero que me alcance para:</span>
        {WEEKS.map((w) => (
          <Link
            key={w}
            href={`/admin/reponer?semanas=${w}`}
            aria-current={w === weeks ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${w === weeks ? "bg-forest text-white" : "bg-warm-white shadow-soft hover:bg-sun"}`}
          >
            {w} semanas
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos calcular la lista.</p>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
          <ShoppingBasket className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">Por ahora no hace falta pedir nada.</p>
          <p className="mt-1 text-muted">
            {sold.size === 0
              ? "Todavía no hay ventas confirmadas para calcular. Cuando vendas, acá vas a ver qué reponer."
              : `Con lo que tenés te alcanza para ${weeks} semanas, vendiendo como en ${period}.`}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-warm-white p-4 shadow-soft">
            <p className="font-semibold">
              Pedí {units} {units === 1 ? "unidad" : "unidades"} de {list.length} {list.length === 1 ? "producto" : "productos"}
            </p>
            <CopyOrderButtons text={text} />
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {list.map((r) => {
              const p = byId.get(r.id);
              const img = [...(p?.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path;
              const src = img ? productImageUrl(img) : null;
              return (
                <li key={r.id} className="flex items-center gap-3 rounded-3xl bg-warm-white p-3 shadow-soft">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white">
                    {src ? <Image src={src} alt="" fill sizes="56px" className="object-cover" /> : <ProductImageFallback className="size-full" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/productos/${r.id}`} className="line-clamp-2 font-semibold leading-snug hover:text-coral-deep">
                      {r.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted tabular">
                      Vendiste <b className="text-forest">{r.sold}</b> en {period} · Te {r.stock === 1 ? "queda" : "quedan"}{" "}
                      <b className={r.stock <= 0 ? "text-coral-deep" : "text-forest"}>{Math.max(0, r.stock)}</b>
                    </p>
                    <p className="text-xs text-muted tabular">
                      Para {weeks} semanas necesitás {r.need}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-2xl bg-sun px-3 py-2 text-center leading-tight">
                    <span className="block text-xs font-semibold">Pedí</span>
                    <span className="font-display text-xl font-bold tabular">{r.order}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-muted">
            Es una sugerencia: cambiala con lo que sabés vos. Las clientas que pidieron que les avises cuando vuelva un producto
            están aparte, en{" "}
            <Link href="/admin/avisos" className="font-semibold text-coral-deep underline">
              Avisos de stock
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
