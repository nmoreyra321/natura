import { ChevronRight, Gift } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccountOrders } from "@/components/store/account-orders";
import { AccountLogin } from "@/components/store/account-login";
import { AccountProfile, SignOutButton } from "@/components/store/account-profile";
import { getLoginProviders } from "@/lib/config";
import { accountClub, getCustomer } from "@/lib/customer";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";

export const metadata: Metadata = {
  title: "Mi cuenta",
  robots: { index: false, follow: true },
};


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
        <p className="mt-2 text-center text-sm">
          ¿Hiciste un pedido sin cuenta?{" "}
          <Link href="/mi-pedido" className="font-semibold text-coral-deep underline">
            Seguir mi pedido
          </Link>
        </p>
      </div>
    );
  }

  const club = customer.phone ? await accountClub(customer.phone) : null;

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

      <section id="pedidos" className="mt-6 scroll-mt-28">
        <h2 className="font-display text-xl font-bold">Mis pedidos</h2>
        <AccountOrders customerId={customer.id} />
      </section>

      <section className="mt-6 rounded-3xl bg-warm-white p-5 shadow-soft ring-1 ring-line/70">
        <h2 className="mb-3 font-display text-xl font-bold">Mis datos</h2>
        <AccountProfile name={customer.name ?? ""} phone={customer.phone ?? ""} saved={Boolean(customer.phone && customer.name)} />
      </section>

      <div className="mt-6 text-center">
        <SignOutButton />
      </div>
    </div>
  );
}
