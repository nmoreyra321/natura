import { MessageSquareHeart } from "lucide-react";
import Link from "next/link";

import { ReviewDelete } from "@/components/admin/review-delete";
import { ReviewReply } from "@/components/admin/review-reply";
import { Stars } from "@/components/store/stars";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Reseñas" };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

export default async function ReviewsPage() {
  const { supabase } = await requireAdmin();
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, name, rating, comment, reply, created_at, order:orders(code)")
    .order("created_at", { ascending: false })
    .limit(500);
  const list = reviews ?? [];
  const average = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Reseñas</h1>
      <p className="mt-1 text-muted">
        Las clientas pueden dejar una reseña desde la página de su pedido. Se publican solas en el inicio de la tienda; podés
        <b className="text-forest"> Contestar</b> cada una (tu respuesta se ve debajo) y, si alguna no te gusta, tocá <b className="text-forest">Sacar</b>.
      </p>

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar las reseñas.</p>
      ) : list.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
          <MessageSquareHeart className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">Todavía no hay reseñas.</p>
          <p className="mt-1 text-muted">Cuando una clienta deje una, te llega un aviso y aparece acá.</p>
        </div>
      ) : (
        <>
          <p className="mt-5 flex flex-wrap items-center gap-2 font-semibold">
            <span className="font-display text-2xl font-bold tabular">{average.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</span>
            <Stars value={average} className="size-5" />
            <span className="text-muted">
              · {list.length} {list.length === 1 ? "reseña" : "reseñas"}
            </span>
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {list.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-start gap-3 rounded-3xl p-4 shadow-soft ${r.rating <= 2 ? "bg-coral-soft/50" : "bg-warm-white"}`}>
                <div className="min-w-0 flex-1">
                  <Stars value={r.rating} />
                  {r.comment ? <p className="mt-1.5 break-words">“{r.comment}”</p> : null}
                  <p className="mt-1.5 text-sm text-muted">
                    <b className="text-forest">{r.name}</b> · {dateFmt.format(new Date(r.created_at))}
                    {r.order ? (
                      <>
                        {" · "}
                        <Link href={`/admin/pedidos?estado=todos&q=${encodeURIComponent(r.order.code)}`} className="font-semibold text-coral-deep hover:underline">
                          Pedido {r.order.code}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <ReviewReply id={r.id} reply={r.reply} />
                </div>
                <ReviewDelete id={r.id} name={r.name} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
