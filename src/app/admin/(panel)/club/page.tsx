import { Gift, MessageCircle, Users } from "lucide-react";

import { GiftActions, UndoGift } from "@/components/admin/gift-actions";
import { requireAdmin } from "@/lib/auth";
import { formatPhone } from "@/lib/debts";
import { GIFT_EVERY, PURCHASE_STATUSES, summarizeClub, type ClubMember } from "@/lib/loyalty";

export const metadata = { title: "Club de clientas" };

/** ●●●○○: compras hechas hacia el próximo regalo. */
function Progress({ done }: { done: number }) {
  return (
    <span className="flex gap-1" aria-label={`${done} de ${GIFT_EVERY} compras`}>
      {Array.from({ length: GIFT_EVERY }, (_, i) => (
        <span key={i} className={`size-3 rounded-full ${i < done ? "bg-botanical-deep" : "bg-line"}`} />
      ))}
    </span>
  );
}

function giftMessage(m: ClubMember): string {
  const first = m.name === "Sin nombre" ? "" : ` ${m.name.split(" ")[0]}`;
  return `¡Hola${first}! Ya hiciste ${m.purchases} compras en Natu Mariel y te ganaste un regalo 🎁 ¡Gracias por elegirnos! Coordinemos para que te lo lleve.`;
}

export default async function ClubPage() {
  const { supabase } = await requireAdmin();
  const [{ data: orders, error }, { data: gifts }] = await Promise.all([
    supabase
      .from("orders")
      .select("customer_name, customer_phone, status, created_at")
      .in("status", [...PURCHASE_STATUSES])
      .not("customer_phone", "is", null)
      .limit(20000),
    supabase.from("loyalty_gifts").select("phone").limit(20000),
  ]);
  const club = summarizeClub(orders ?? [], gifts ?? []);
  const winners = club.filter((m) => m.pending > 0);
  const onTheWay = club.filter((m) => m.pending === 0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Club de clientas</h1>
      <p className="mt-1 text-muted">
        Cada <b className="text-forest">{GIFT_EVERY} compras</b>, la clienta se gana <b className="text-forest">un regalo</b>. Las compras
        se cuentan solas por número de WhatsApp (tienda web y Venta rápida), cuando el pedido está confirmado o entregado.
      </p>

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar el club.</p>
      ) : club.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
          <Users className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">Todavía no hay compras con teléfono.</p>
          <p className="mt-1 text-muted">Cuando confirmes pedidos, acá vas a ver cuánto le falta a cada clienta para su regalo.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="toca" className="mt-6">
            <h2 id="toca" className="flex items-center gap-2 font-display text-xl font-bold">
              <Gift className="size-5 text-coral-deep" aria-hidden="true" /> Les toca regalo
            </h2>
            {winners.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Por ahora a nadie. Cuando una clienta llegue a {GIFT_EVERY} compras, aparece acá.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {winners.map((m) => (
                  <li key={m.phone} className="flex flex-wrap items-center gap-3 rounded-3xl border-2 border-coral-deep/40 bg-coral-soft/40 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{m.name}</span>
                      <span className="block text-sm text-muted">
                        {m.purchases} compras · {formatPhone(m.phone)}
                        {m.pending > 1 ? ` · ${m.pending} regalos pendientes` : ""}
                      </span>
                    </span>
                    <a
                      href={`https://wa.me/${m.phone}?text=${encodeURIComponent(giftMessage(m))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-bold text-botanical-deep ring-1 ring-line hover:bg-sage"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" /> Avisarle
                    </a>
                    <GiftActions phone={m.phone} name={m.name} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="camino" className="mt-8">
            <h2 id="camino" className="font-display text-xl font-bold">
              Camino al regalo
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {onTheWay.map((m) => (
                <li key={m.phone} className="flex flex-wrap items-center gap-3 rounded-3xl bg-warm-white p-4 shadow-soft">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{m.name}</span>
                    <span className="block text-sm text-muted">
                      {m.purchases} {m.purchases === 1 ? "compra" : "compras"} · {formatPhone(m.phone)}
                      {m.given > 0 ? ` · ${m.given} ${m.given === 1 ? "regalo entregado" : "regalos entregados"}` : ""}
                    </span>
                    {m.given > 0 ? <UndoGift phone={m.phone} /> : null}
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Progress done={m.progress} />
                    <span className="text-xs font-semibold text-muted">
                      {m.left === 1 ? "Le falta 1 compra" : `Le faltan ${m.left} compras`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
