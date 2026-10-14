import { FileText } from "lucide-react";
import Link from "next/link";

import type { AdminContext } from "@/lib/auth";
import { formatARS } from "@/lib/format";
import { toCents } from "@/lib/pricing";

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const dayFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "UTC" });

/** Historial de facturas de Natura cargadas: qué llegó en cada una. */
export async function ReceiptHistory({ supabase }: { supabase: AdminContext["supabase"] }) {
  const { data, error } = await supabase
    .from("receipts")
    .select("id, invoice_number, invoice_date, due_date, total, units, created_at, items:receipt_items(id, product_id, product_name, quantity)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return <p className="rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar el historial de facturas.</p>;
  if (!data || data.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line bg-warm-white p-6 text-center text-muted">
        Todavía no cargaste ninguna factura. Cuando cargues una, va a aparecer acá con todo lo que llegó.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {data.map((r) => {
        const items = [...(r.items ?? [])].sort((a, b) => a.product_name.localeCompare(b.product_name, "es"));
        return (
          <li key={r.id} className="rounded-3xl bg-warm-white shadow-soft">
            <details>
              <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                <FileText className="mt-0.5 size-5 shrink-0 text-coral-deep" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {r.invoice_number ? `Factura N° ${r.invoice_number}` : "Factura sin número"}
                    {r.invoice_date ? ` · ${dayFmt.format(new Date(`${r.invoice_date}T12:00:00Z`))}` : ""}
                  </span>
                  <span className="block text-sm text-muted tabular">
                    Cargada el {dateFmt.format(new Date(r.created_at))} · {r.units} {r.units === 1 ? "unidad" : "unidades"}
                    {r.total ? ` · total ${formatARS(toCents(r.total))}` : ""}
                    {r.due_date ? ` · vencía el ${dayFmt.format(new Date(`${r.due_date}T12:00:00Z`))}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-coral-deep">Ver</span>
              </summary>
              <ul className="border-t border-line px-4 py-3 text-sm">
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 py-1">
                    {i.product_id ? (
                      <Link href={`/admin/productos/${i.product_id}`} className="hover:text-coral-deep hover:underline">
                        {i.product_name}
                      </Link>
                    ) : (
                      <span>{i.product_name}</span>
                    )}
                    <span className="shrink-0 font-semibold tabular">× {i.quantity}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
