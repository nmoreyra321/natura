import { ChevronRight, Gift } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccountOrders } from "@/components/store/account-orders";
import { AccountLogin } from "@/components/store/account-login";
import { AccountProfile, SignOutButton } from "@/components/store/account-profile";
import { getLoginProviders } from "@/lib/config";
import { accountClub, getCustomer } from "@/lib/customer";
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

      <Link
        href="/club"
        className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-blush to-sun/40 p-4 transition hover:-translate-y-0.5"
      >
        <span>
          <span className="flex items-center gap-2 font-display text-lg font-bold">
            <Gift className="size-5 text-coral-deep" aria-hidden="true" /> Club Natu Mariel
          </span>
          <span className="block text-sm">
            {!club
              ? "Cargá tu WhatsApp abajo para empezar a sumar."
              : club.pending > 0
                ? "¡Te ganaste un regalo! 🎉"
                : `Llevás ${club.progress} de ${GIFT_EVERY}. Ver mi Club`}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-coral-deep" aria-hidden="true" />
      </Link>

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
