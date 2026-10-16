import { ChevronRight, Gift } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { myOrdersStatus } from "@/app/(tienda)/pedido/actions";
import { AccountLogin } from "@/components/store/account-login";
import { AccountProfile, SignOutButton } from "@/components/store/account-profile";
import { getLoginProviders } from "@/lib/config";
import { accountClub, getCustomer } from "@/lib/customer";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: true },
};

const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });
const TONE = { good: "bg-sage text-botanical-deep", wait: "bg-sun text-forest", bad: "bg-coral-soft text-coral-deep" } as const;

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/cuenta";
  const customer = await getCustomer();

  if (!customer) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 sm:py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Mi cuenta</h1>
        <div className="mt-6 rounded-3xl bg-gradient-to-br from-blush to-sun/40 p-5">
          <p className="flex items-center gap-2 font-display text-lg font-bold">
            <Gift className="size-5 text-coral-deep" aria-hidden="true" /> Club Natu Mariel
          </p>
          <p className="mt-1 text-sm">
            Con tu cuenta, cada {GIFT_EVERY} compras te ganás un regalo. Además ves todos tus pedidos desde cualquier celular.
          </p>
        </div>
        <section className="mt-6 rounded-3xl bg-warm-white p-5 shadow-soft ring-1 ring-line/70">
          <h2 className="font-display text-xl font-bold">Entrá en un toque</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Sin contraseña: usás tu cuenta de Google o de Facebook.</p>
          {sp.error ? (
            <p className="mb-3 text-sm font-semibold text-coral-deep" role="alert">
              No pudimos completar el ingreso. Probá de nuevo.
            </p>
          ) : null}
          {getLoginProviders().length > 0 ? (
            <AccountLogin next={next} providers={getLoginProviders()} />
          ) : (
            <p className="rounded-2xl bg-cream p-3 text-sm font-semibold">Muy pronto vas a poder entrar con Google o Facebook. 💖</p>
          )}
        </section>
        <p className="mt-4 text-center text-sm text-muted">
          ¿No querés cuenta? Podés comprar igual, solo que esas compras no suman al Club.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: rows } = admin
    ? await admin.from("orders").select("id, code, created_at").eq("customer_user_id", customer.id).order("created_at", { ascending: false }).limit(20)
    : { data: [] };
  const orders = rows ?? [];
  const [statuses, club] = await Promise.all([
    orders.length ? myOrdersStatus(orders.map((o) => o.id)) : Promise.resolve([]),
    customer.phone ? accountClub(customer.phone) : Promise.resolve(null),
  ]);
  const status = new Map(statuses.map((s) => [s.id, s]));

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Hola{customer.name ? `, ${customer.name.split(" ")[0]}` : ""} 👋</h1>
      {customer.email ? <p className="mt-1 text-sm text-muted">{customer.email}</p> : null}

      {next !== "/cuenta" && customer.phone ? (
        <Link href={next} className="mt-4 inline-flex items-center gap-1 font-semibold text-coral-deep underline">
          Volver a donde estabas <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}

      <section className="mt-6 rounded-3xl bg-gradient-to-br from-blush to-sun/40 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <Gift className="size-5 text-coral-deep" aria-hidden="true" /> Club Natu Mariel
        </h2>
        {!club ? (
          <p className="mt-1 text-sm">Cargá tu WhatsApp abajo para empezar a sumar compras.</p>
        ) : club.pending > 0 ? (
          <p className="mt-1 font-semibold">¡Te ganaste un regalo! 🎉 Natu Mariel te lo entrega con tu próximo pedido.</p>
        ) : (
          <>
            <p className="mt-1 text-sm">
              Cada {GIFT_EVERY} compras{club.minCents > 0 ? ` de ${formatARS(club.minCents)} o más` : ""} te ganás un regalo. Llevás{" "}
              <b>{club.progress}</b> de {GIFT_EVERY}
              {club.left === 1 ? ": ¡te falta solo 1!" : `: te faltan ${club.left}.`}
            </p>
            <span className="mt-2 flex gap-1.5" aria-hidden="true">
              {Array.from({ length: GIFT_EVERY }, (_, i) => (
                <span key={i} className={`size-3.5 rounded-full ${i < club.progress ? "bg-coral-deep" : "bg-white"}`} />
              ))}
            </span>
            <p className="mt-2 text-xs text-muted">Suman los pedidos hechos con tu cuenta, pagados y confirmados.</p>
          </>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-display text-xl font-bold">Mis pedidos</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Todavía no hiciste pedidos con tu cuenta.{" "}
            <Link href="/productos" className="font-semibold text-coral-deep underline">
              Ver productos
            </Link>
          </p>
        ) : (
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
        )}
      </section>

      <section className="mt-6 rounded-3xl bg-warm-white p-5 shadow-soft ring-1 ring-line/70">
        <h2 className="mb-3 font-display text-xl font-bold">Mis datos</h2>
        <AccountProfile name={customer.name ?? ""} phone={customer.phone ?? ""} />
      </section>

      <div className="mt-6 text-center">
        <SignOutButton />
      </div>
    </div>
  );
}
