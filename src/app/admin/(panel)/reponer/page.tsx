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
const WEEKS = [1, 2, 4, 6, 8] as const;

/** Un número con su etiqueta chiquita arriba (para la cuenta necesitás − te queda = pedí). */
function Figure({ label, value, tone = "plain" }: { label: string; value: number; tone?: "plain" | "alert" | "result" }) {
  return (
    <span
      className={`flex min-w-16 flex-col items-center rounded-2xl px-2.5 py-1.5 leading-tight ${tone === "result" ? "bg-sun" : "bg-white"}`}
    >
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <span className={`font-display text-xl font-bold tabular ${tone === "alert" ? "text-coral-deep" : ""}`}>{value}</span>
    </span>
  );
}

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

  // Base: desde la primera venta (si la tienda es nueva) hasta 3 meses atrás.
  const firstSale = (sales ?? []).reduce<string | null>((min, s) => {
    const at = (s.order as unknown as { created_at: string } | null)?.created_at ?? null;
    return at && (!min || at < min) ? at : min;
  }, null);
  const history = historyDays(firstSale);
  const past = salesPeriodText(salesDays(history));
  const next = weeks === 1 ? "1 semana" : `${weeks} semanas`;
  const sold = new Map<string, number>();
  for (const s of sales ?? []) if (s.product_id) sold.set(s.product_id, (sold.get(s.product_id) ?? 0) + s.quantity);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const list = suggestReorder(
    (products ?? []).map((p) => ({ id: p.id, name: p.name, stock: p.stock, sold: sold.get(p.id) ?? 0 })),
    weeks,
    history,
  );
  const units = list.reduce((s, r) => s + r.order, 0);
  const text = reorderText(list.map((r) => ({ name: r.name, order: r.order, sku: byId.get(r.id)?.natura_sku ?? null })));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Qué pedirle a Natura</h1>
      <p className="mt-1 text-muted">Sugerencia de compra para tu próximo pedido, según lo que vendiste y lo que te queda.</p>

      <section aria-labelledby="periodo" className="mt-5 rounded-3xl bg-warm-white p-4 shadow-soft">
        <h2 id="periodo" className="text-sm font-bold">
          Quiero que me alcance para:
        </h2>
        <nav aria-label="Para cuántas semanas" className="mt-2 flex flex-wrap gap-2">
          {WEEKS.map((w) => (
            <Link
              key={w}
              href={`/admin/reponer?semanas=${w}`}
              aria-current={w === weeks ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${w === weeks ? "bg-forest text-white" : "bg-white ring-1 ring-line hover:bg-sun"}`}
            >
              {w === 1 ? "1 semana" : `${w} semanas`}
            </Link>
          ))}
        </nav>
        <p className="mt-3 text-sm text-muted">
          Miramos cuánto vendiste de cada producto en <b className="text-forest">{past}</b>, calculamos cuántos vas a
          necesitar para <b className="text-forest">{next}</b> (si elegís el doble de semanas, necesitás el doble) y le
          restamos lo que te queda:
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm font-bold" aria-label="Necesitás menos te queda igual a pedí">
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-line">Necesitás</span>
          <span aria-hidden="true">−</span>
          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-line">Te queda</span>
          <span aria-hidden="true">=</span>
          <span className="rounded-full bg-sun px-3 py-1">Pedí</span>
        </p>
      </section>

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos calcular la lista.</p>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
          <ShoppingBasket className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">Por ahora no hace falta pedir nada.</p>
          <p className="mt-1 text-muted">
            {sold.size === 0
              ? "Todavía no hay ventas confirmadas para calcular. Cuando vendas, acá vas a ver qué reponer."
              : `Con lo que tenés te alcanza para ${next}.`}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-forest p-4 text-white shadow-soft">
            <p>
              <span className="block text-sm opacity-80">Tu pedido sugerido</span>
              <span className="font-display text-xl font-bold">
                {units} {units === 1 ? "unidad" : "unidades"} · {list.length} {list.length === 1 ? "producto" : "productos"}
              </span>
            </p>
            <CopyOrderButtons text={text} />
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {list.map((r) => {
              const p = byId.get(r.id);
              const img = [...(p?.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path;
              const src = img ? productImageUrl(img) : null;
              const left = Math.max(0, r.stock);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-3xl bg-warm-white p-3 shadow-soft">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white">
                    {src ? <Image src={src} alt="" fill sizes="56px" className="object-cover" /> : <ProductImageFallback className="size-full" />}
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <Link href={`/admin/productos/${r.id}`} className="line-clamp-2 font-semibold leading-snug hover:text-coral-deep">
                      {r.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      Vendiste {r.sold} en {past}
                    </p>
                    {left === 0 ? <span className="mt-1 inline-block rounded-full bg-coral-soft px-2 py-0.5 text-xs font-bold text-coral-deep">Agotado</span> : null}
                  </div>
                  <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto" aria-label={`Necesitás ${r.need}, te quedan ${left}, pedí ${r.order}`}>
                    <Figure label="Necesitás" value={r.need} />
                    <span className="font-bold text-muted" aria-hidden="true">−</span>
                    <Figure label="Te queda" value={left} tone={left === 0 ? "alert" : "plain"} />
                    <span className="font-bold text-muted" aria-hidden="true">=</span>
                    <Figure label="Pedí" value={r.order} tone="result" />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-muted">
            Es una sugerencia: cambiala con lo que sabés vos. Las clientas que pidieron aviso cuando vuelva un producto están en{" "}
            <Link href="/admin/avisos" className="font-semibold text-coral-deep underline">
              Lista de espera de stock
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
