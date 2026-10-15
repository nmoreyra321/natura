import { AlertTriangle, CalendarClock, Tag } from "lucide-react";
import Link from "next/link";

import { LotActions } from "@/components/admin/lot-actions";
import { SelectBox, SelectToDelete } from "@/components/admin/select-to-delete";
import { LotQuickEntry } from "@/components/admin/lot-quick-entry";
import { requireAdmin } from "@/lib/auth";
import { EXPIRY_WARNING_MONTHS, expiryState, expiryWarningLimit, formatExpiry, monthsLeft } from "@/lib/lots";

export const metadata = { title: "Vencimientos" };

type LotRow = {
  id: string;
  expires_on: string;
  quantity: number;
  product: { id: string; name: string; size: string | null; status: string; is_offer: boolean } | null;
};

function whenText(expiresOn: string): string {
  const left = monthsLeft(expiresOn);
  if (expiryState(expiresOn) === "expired") return "Vencido";
  if (left <= 0) return "Vence este mes";
  return `Faltan ${left} ${left === 1 ? "mes" : "meses"}`;
}

function LotList({ lots, emphasize }: { lots: LotRow[]; emphasize: boolean }) {
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {lots.map((lot) => {
        const state = expiryState(lot.expires_on);
        const name = lot.product?.name ?? "Producto eliminado";
        return (
          <li
            key={lot.id}
            className={`flex flex-col gap-2 rounded-2xl p-3 sm:flex-row sm:items-center ${
              emphasize && state === "expired" ? "bg-coral-soft" : "bg-cream/60"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SelectBox id={lot.id} label={name} />
              <span
                className={`flex w-16 shrink-0 flex-col items-center rounded-xl px-2 py-1 text-center ${
                  state === "expired" ? "bg-coral-deep text-white" : state === "soon" ? "bg-sun" : "bg-white"
                }`}
              >
                <span className="font-display text-lg leading-tight font-bold tabular">{formatExpiry(lot.expires_on)}</span>
                <span className="text-[0.65rem] font-bold uppercase">{lot.quantity} u.</span>
              </span>
              <div className="min-w-0">
                {lot.product ? (
                  <Link href={`/admin/productos/${lot.product.id}`} className="font-semibold hover:text-coral-deep">
                    {name}
                  </Link>
                ) : (
                  <span className="font-semibold">{name}</span>
                )}
                <p className="text-sm text-muted">
                  {whenText(lot.expires_on)}
                  {lot.product?.size ? ` · ${lot.product.size}` : ""}
                  {lot.product?.is_offer ? " · en oferta" : ""}
                  {lot.product?.status === "draft" ? " · borrador" : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {emphasize && lot.product && !lot.product.is_offer && state !== "expired" ? (
                <Link
                  href={`/admin/productos/${lot.product.id}`}
                  className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold hover:bg-sun"
                >
                  <Tag className="size-4" aria-hidden="true" /> Poner en oferta
                </Link>
              ) : null}
              <LotActions id={lot.id} name={name} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function ExpiryPage() {
  const { supabase } = await requireAdmin();
  const limit = expiryWarningLimit();

  const { data, error } = await supabase
    .from("product_lots")
    .select("id, expires_on, quantity, product:products(id, name, size, status, is_offer)")
    .order("expires_on")
    .order("created_at")
    .limit(2000);
  const lots = (data ?? []) as unknown as LotRow[];
  const soon = lots.filter((l) => l.expires_on <= limit);
  const later = lots.filter((l) => l.expires_on > limit);
  const expiredCount = soon.filter((l) => expiryState(l.expires_on) === "expired").length;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-bold">Vencimientos</h1>
      <p className="text-muted">
        Lo que vence en los próximos {EXPIRY_WARNING_MONTHS} meses aparece en «Por vencer». Los vencimientos se cargan cuando
        te llega la mercadería, en{" "}
        <Link href="/admin/productos?vista=llego" className="font-semibold text-coral-deep underline">
          Me llegó mercadería
        </Link>
        .
      </p>

      <details className="group mt-6">
        <summary className="cursor-pointer list-none rounded-full bg-warm-white px-4 py-2.5 text-sm font-bold shadow-soft hover:bg-sun group-open:mb-3 [&::-webkit-details-marker]:hidden">
          + Anotar el vencimiento de algo que ya tenés en el stock
        </summary>
        <LotQuickEntry />
      </details>

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar los vencimientos.</p>
      ) : (
        <SelectToDelete kind="lots" ids={lots.map((l) => l.id)}>
          <section aria-labelledby="por-vencer" className="mt-8 rounded-3xl bg-warm-white p-5 shadow-soft">
            <h2 id="por-vencer" className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
              <AlertTriangle className="size-5 text-coral-deep" aria-hidden="true" />
              Por vencer ({soon.length})
              {expiredCount > 0 ? (
                <span className="rounded-full bg-coral-deep px-2.5 py-0.5 text-xs font-bold text-white">
                  {expiredCount} {expiredCount === 1 ? "vencido" : "vencidos"}
                </span>
              ) : null}
            </h2>
            {soon.length === 0 ? (
              <p className="mt-2 text-muted">Nada vence en los próximos {EXPIRY_WARNING_MONTHS} meses. ¡Bien!</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted">
                  Ordenados del más próximo al más lejano. Ponelos en oferta para venderlos antes, y cuando ya no los tengas
                  tocá «Ya no lo tengo».
                </p>
                <LotList lots={soon} emphasize />
              </>
            )}
          </section>

          <details className="mt-6 rounded-3xl bg-warm-white p-5 shadow-soft">
            <summary className="flex cursor-pointer items-center gap-2 font-display text-xl font-bold">
              <CalendarClock className="size-5" aria-hidden="true" />
              Más adelante ({later.length})
            </summary>
            {later.length === 0 ? (
              <p className="mt-2 text-muted">Todavía no cargaste vencimientos más lejanos.</p>
            ) : (
              <LotList lots={later} emphasize={false} />
            )}
          </details>
        </SelectToDelete>
      )}
    </div>
  );
}
