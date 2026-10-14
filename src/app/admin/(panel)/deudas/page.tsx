import { HandCoins } from "lucide-react";
import Link from "next/link";

import { DebtCard } from "@/components/admin/debt-card";
import { requireAdmin } from "@/lib/auth";
import { groupDebts } from "@/lib/debts";
import { formatARS } from "@/lib/format";

export const metadata = { title: "Quién me debe" };

export default async function DebtsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, code, customer_name, customer_phone, total, amount_paid, created_at, payment_note, payment_method, payment_status, status",
    )
    .neq("status", "cancelled")
    .neq("payment_method", "mercadopago")
    .or("payment_status.is.null,payment_status.neq.approved")
    .order("created_at")
    .limit(1000);
  const debts = groupDebts(data ?? []);
  const totalCents = debts.reduce((sum, d) => sum + d.owedCents, 0);
  // eslint-disable-next-line react-hooks/purity -- fecha de hoy para calcular hace cuántos días debe
  const today = Date.now();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Quién me debe</h1>
      <p className="text-muted">
        Clientas con pedidos sin cobrar o pagados en parte. Para anotar un pago, entrá a{" "}
        <Link href="/admin/pedidos?estado=sin-cobrar" className="font-semibold text-coral-deep underline">
          Pedidos → Sin cobrar
        </Link>
        .
      </p>

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar las deudas.</p>
      ) : debts.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
          <HandCoins className="mx-auto size-10 text-botanical" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">¡Nadie te debe nada!</p>
          <p className="mt-1 text-muted">Todos los pedidos están cobrados.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 rounded-3xl border-2 border-forest bg-sun/60 p-4 shadow-[3px_3px_0_var(--forest)]">
            <span className="font-semibold">
              {debts.length} {debts.length === 1 ? "clienta te debe" : "clientas te deben"} en total
            </span>
            <span className="text-3xl font-extrabold text-coral-deep tabular">{formatARS(totalCents)}</span>
          </div>
          <ul className="mt-5 flex flex-col gap-3">
            {debts.map((d) => (
              <DebtCard key={d.key} debt={d} today={today} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
