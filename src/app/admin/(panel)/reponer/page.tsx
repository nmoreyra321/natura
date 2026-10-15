import { ShoppingBasket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CopyOrderButtons } from "@/components/admin/copy-order-button";
import { ProductImageFallback } from "@/components/store/product-card";
import { requireAdmin } from "@/lib/auth";
import { productImageUrl } from "@/lib/images";
import { reorderText, salesWindowStart, historyDays, suggestReorder } from "@/lib/reorder";

export const metadata = { title: "Qué pedir" };

type Search = Record<string, string | string[] | undefined>;
const WEEKS = [2, 4, 6, 8] as const;

export default async function ReorderPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const asked = Number(Array.isArray(sp.semanas) ? sp.semanas[0] : sp.semanas);
  const weeks = WEEKS.find((w) => w === asked) ?? 4;

  const since = salesWindowStart();
  const [{ data: products, error }, { data: sales }, { data: waiting }] = await Promise.all([
    supabase.from("products").select("id, name, size, stock, natura_sku, images:product_images(storage_path, position)").limit(3000),
    supabase
      .from("order_items")
      .select("product_id, quantity, order:orders!inner(status, created_at)")
      .in("order.status", ["confirmed", "delivered"])
      .gte("order.created_at", since)
      .limit(20000),
    supabase.from("restock_requests").select("product_id").is("notified_at", null).limit(5000),
  ]);

  // Días con historia de ventas: desde la primera venta de la ventana (la tienda puede ser nueva).
  const firstSale = (sales ?? []).reduce<string | null>((min, s) => {
    const at = (s.order as unknown as { created_at: string } | null)?.created_at ?? null;
    return at && (!min || at < min) ? at : min;
  }, null);
  const windowDays = historyDays(firstSale);
  const sold = new Map<string, number>();
  for (const s of sales ?? []) if (s.product_id) sold.set(s.product_id, (sold.get(s.product_id) ?? 0) + s.quantity);
  const wait = new Map<string, number>();
  for (const w of waiting ?? []) wait.set(w.product_id, (wait.get(w.product_id) ?? 0) + 1);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const list = suggestReorder(
    (products ?? []).map((p) => ({ id: p.id, name: p.name, stock: p.stock, sold: sold.get(p.id) ?? 0, waiting: wait.get(p.id) ?? 0 })),
    weeks * 7,
    windowDays,
  );
  const units = list.reduce((s, r) => s + r.order, 0);
  const text = reorderText(list.map((r) => ({ name: r.name, order: r.order, sku: byId.get(r.id)?.natura_sku ?? null })));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Qué pedir</h1>
      <p className="text-muted">
        Según lo que vendiste en los últimos 3 meses (tienda, venta rápida y vivos) y las clientas que esperan un aviso de
        stock. Es una sugerencia: ajustala con lo que sabés vos.
      </p>

      <nav aria-label="Para cuánto tiempo" className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Que me alcance para:</span>
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
          <p className="mt-1 text-muted">Con el stock que tenés alcanza para {weeks} semanas al ritmo de ventas actual.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-warm-white p-4 shadow-soft">
            <p className="font-semibold">
              {list.length} {list.length === 1 ? "producto" : "productos"} · {units} {units === 1 ? "unidad" : "unidades"}
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
                    <p className="text-xs text-muted tabular">
                      Tenés {r.stock}
                      {r.perMonth > 0 ? ` · vendés unos ${String(r.perMonth).replace(".", ",")} por mes` : ""}
                      {r.daysLeft !== null ? (r.stock === 0 ? " · ya no te queda" : ` · te alcanza para ${r.daysLeft} días`) : ""}
                      {r.waiting > 0 ? ` · ${r.waiting} ${r.waiting === 1 ? "clienta espera" : "clientas esperan"}` : ""}
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
        </>
      )}
    </div>
  );
}
