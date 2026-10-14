import { BellRing } from "lucide-react";
import Link from "next/link";

import { RestockRow } from "@/components/admin/restock-row";
import { requireAdmin } from "@/lib/auth";
import { getSiteUrl } from "@/lib/config";

export const metadata = { title: "Avisos de stock" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });

export default async function RestockPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("restock_requests")
    .select("id, name, phone, created_at, product:products(id, name, slug, stock)")
    .is("notified_at", null)
    .order("created_at")
    .limit(500);

  // Agrupar por producto; primero los que ya tienen stock (listos para avisar).
  const groups = new Map<string, { product: { id: string; name: string; slug: string; stock: number }; rows: NonNullable<typeof data> }>();
  for (const r of data ?? []) {
    if (!r.product) continue;
    const g = groups.get(r.product.id) ?? { product: r.product, rows: [] };
    g.rows.push(r);
    groups.set(r.product.id, g);
  }
  const list = [...groups.values()].sort((a, b) => Number(b.product.stock > 0) - Number(a.product.stock > 0) || b.rows.length - a.rows.length);
  const siteUrl = getSiteUrl();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Avisos de stock</h1>
      <p className="text-muted">
        Clientas que pidieron que les avises cuando vuelva un producto. Cuando cargues stock, tocá <strong>Avisar</strong>:
        se abre WhatsApp con el mensaje listo y queda marcada como avisada.
      </p>

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar los avisos.</p>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
          <BellRing className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">No hay avisos pendientes.</p>
          <p className="mt-1 text-muted">En los productos sin stock, las clientas pueden tocar «Avisame cuando vuelva».</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {list.map(({ product, rows }) => (
            <li key={product.id} className="rounded-3xl bg-warm-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/productos/${product.id}`} className="font-display text-lg font-bold hover:text-coral-deep">
                  {product.name}
                </Link>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${product.stock > 0 ? "bg-botanical-deep text-white" : "bg-cream text-muted"}`}
                >
                  {product.stock > 0 ? `¡Ya hay stock (${product.stock})! Avisales` : "Todavía sin stock"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                {rows.length} {rows.length === 1 ? "clienta esperando" : "clientas esperando"}
              </p>
              <ul className="mt-2 divide-y divide-line/70 rounded-2xl border border-line/70">
                {rows.map((r) => (
                  <RestockRow
                    key={r.id}
                    id={r.id}
                    name={r.name}
                    phone={r.phone}
                    date={dateFmt.format(new Date(r.created_at))}
                    productName={product.name}
                    productUrl={`${siteUrl}/productos/${product.slug}`}
                    inStock={product.stock > 0}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
