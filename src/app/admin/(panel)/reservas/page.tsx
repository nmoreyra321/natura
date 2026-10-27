import { Clock } from "lucide-react";

import { ReservationRow } from "@/components/admin/reservation-row";
import { requireAdmin } from "@/lib/auth";
import { releaseExpiredReservations } from "@/lib/reservations";

export const metadata = { title: "Reservas de 24 horas" };
export const dynamic = "force-dynamic";

const untilFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});
const dayFmt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});
const LABELS: Record<string, string> = {
  picked_up: "Retirada",
  cancelled: "Cancelada",
  expired: "Venció (volvió al stock)",
};

export default async function ReservationsPage() {
  const { supabase } = await requireAdmin();
  // Las que ya vencieron vuelven al stock antes de mostrar la lista.
  await releaseExpiredReservations();
  const [{ data: active, error }, { data: closed }] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, name, phone, quantity, expires_at, product:products(name)")
      .eq("status", "active")
      .order("expires_at")
      .limit(200),
    supabase
      .from("reservations")
      .select("id, name, quantity, status, closed_at, product:products(name)")
      .neq("status", "active")
      .order("closed_at", { ascending: false })
      .limit(15),
  ]);
  const now = new Date().getTime();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Reservas de 24 horas</h1>
      <p className="mt-1 text-muted">
        Las clientas pueden separar un producto desde la tienda. Mientras está
        reservado se descuenta del stock; si no lo retiran en 24 horas,
        <b className="text-forest"> vuelve solo</b>. Cuando lo retiran, tocá{" "}
        <b className="text-forest">Retiró y pagó</b> o{" "}
        <b className="text-forest">Retiró, paga después</b> y se anota la venta.
      </p>

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">
          No pudimos cargar las reservas.
        </p>
      ) : (active ?? []).length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
          <Clock className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">
            No hay reservas ahora.
          </p>
          <p className="mt-1 text-muted">
            Cuando una clienta reserve algo, te llega un aviso al celular y
            aparece acá.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {(active ?? []).map((r) => (
            <ReservationRow
              key={r.id}
              id={r.id}
              name={r.name}
              phone={r.phone}
              productName={r.product?.name ?? "Producto"}
              quantity={r.quantity}
              until={untilFmt.format(new Date(r.expires_at))}
              hoursLeft={Math.round(
                (new Date(r.expires_at).getTime() - now) / 3_600_000,
              )}
            />
          ))}
        </ul>
      )}

      {(closed ?? []).length > 0 ? (
        <section className="mt-8" aria-label="Últimas reservas cerradas">
          <h2 className="text-sm font-extrabold tracking-wide text-botanical-deep uppercase">
            Últimas cerradas
          </h2>
          <ul className="mt-2 divide-y divide-line/70 rounded-2xl bg-warm-white shadow-soft">
            {(closed ?? []).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <span className="min-w-0">
                  <b>
                    {r.quantity > 1 ? `${r.quantity} × ` : ""}
                    {r.product?.name ?? "Producto"}
                  </b>{" "}
                  · {r.name}
                </span>
                <span className="text-muted">
                  {LABELS[r.status] ?? r.status}
                  {r.closed_at
                    ? ` · ${dayFmt.format(new Date(r.closed_at))}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
