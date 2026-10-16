import { ChevronRight, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { myOrdersStatus } from "@/app/(tienda)/pedido/actions";
import { buttonClasses } from "@/components/ui/button";
import { formatARS } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });
const TONE = { good: "bg-sage text-botanical-deep", wait: "bg-sun text-forest", bad: "bg-coral-soft text-coral-deep" } as const;

/** Los pedidos de la cuenta (con en qué está cada uno), sin buscar nada. */
export async function AccountOrders({ customerId }: { customerId: string }) {
  const admin = createAdminClient();
  const { data: rows } = admin
    ? await admin.from("orders").select("id, code, created_at").eq("customer_user_id", customerId).order("created_at", { ascending: false }).limit(20)
    : { data: [] };
  const orders = rows ?? [];
  const statuses = orders.length ? await myOrdersStatus(orders.map((o) => o.id)) : [];
  const status = new Map(statuses.map((s) => [s.id, s]));

  if (orders.length === 0) {
    return (
      <div className="mt-3 rounded-3xl bg-warm-white p-5 text-center shadow-soft ring-1 ring-line/70">
        <p className="text-sm text-muted">Todavía no hiciste pedidos con tu cuenta.</p>
        <p className="mt-1 text-sm">Lo que compres con la sesión iniciada suma al Club. 🎁</p>
        <Link href="/productos" className={buttonClasses("primary", "lg", "mt-4 w-full")}>
          <ShoppingBag className="size-5" aria-hidden="true" /> Ir a comprar
        </Link>
      </div>
    );
  }
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {orders.map((o) => {
        const s = status.get(o.id);
        return (
          <li key={o.id}>
            <Link
              href={`/pedido/${o.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-warm-white p-4 shadow-soft ring-1 ring-line/70 transition hover:-translate-y-0.5"
            >
              <span className="min-w-0">
                <span className="block font-bold">Pedido {o.code}</span>
                <span className="block text-sm text-muted">
                  {dateFmt.format(new Date(o.created_at))}
                  {s ? ` · ${formatARS(s.totalCents)}` : ""}
                </span>
                {s ? <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${TONE[s.tone]}`}>{s.label}</span> : null}
              </span>
              <ChevronRight className="size-5 shrink-0 text-coral-deep" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
