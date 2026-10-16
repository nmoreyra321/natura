import { Gift, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccountLogin } from "@/components/store/account-login";
import { buttonClasses } from "@/components/ui/button";
import { getLoginProviders } from "@/lib/config";
import { accountClub, getCustomer } from "@/lib/customer";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";
import { getLoyaltyMinTotal } from "@/lib/store-settings";

// Depende de la sesión de la clienta: nunca se prerenderiza.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Club Natu Mariel",
  description: "Cada 5 compras, un regalo. Sumá tus compras con tu cuenta.",
};

export default async function ClubPage() {
  const [customer, minTotal] = await Promise.all([getCustomer(), getLoyaltyMinTotal()]);
  const minCents = Math.round(minTotal * 100);
  const club = customer?.phone ? await accountClub(customer.phone) : null;
  const providers = getLoginProviders();
  const done = club ? (club.pending > 0 ? GIFT_EVERY : club.progress) : 0;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-coral-deep shadow-soft">
        <Gift className="size-4" aria-hidden="true" /> Club Natu Mariel
      </p>
      <h1 className="mt-3 font-display text-3xl leading-tight font-bold sm:text-4xl">
        Cada {GIFT_EVERY} compras, <span className="text-coral-deep">¡un regalo!</span>
      </h1>
      <p className="mt-2 text-muted">
        Suman las compras que hacés en la tienda con tu cuenta{minCents > 0 ? `, de ${formatARS(minCents)} o más` : ""}.
      </p>

      <section className="mt-6 rounded-3xl bg-gradient-to-br from-blush to-sun/40 p-5">
        <h2 className="font-display text-lg font-bold">{customer ? "Tu avance" : "Tu tarjeta del Club"}</h2>
        <span className="mt-3 flex gap-2" aria-label={`${done} de ${GIFT_EVERY} compras`}>
          {Array.from({ length: GIFT_EVERY }, (_, i) => (
            <span
              key={i}
              className={`flex size-10 items-center justify-center rounded-full text-sm font-bold ${i < done ? "bg-coral-deep text-white" : "border-2 border-dashed border-coral-deep/40 bg-white text-coral-deep/60"}`}
            >
              {i === GIFT_EVERY - 1 ? <Gift className="size-5" aria-hidden="true" /> : i + 1}
            </span>
          ))}
        </span>
        {club && club.pending > 0 ? (
          <p className="mt-3 font-display text-lg font-bold text-coral-deep">¡Te ganaste un regalo! 🎉 Natu Mariel te lo entrega con tu próximo pedido.</p>
        ) : club ? (
          <p className="mt-3 font-semibold">
            Llevás {club.progress} de {GIFT_EVERY}: {club.left === 1 ? "¡te falta solo 1 compra!" : `te faltan ${club.left} compras.`}
          </p>
        ) : customer ? (
          <p className="mt-3 text-sm">
            Te falta un paso:{" "}
            <Link href="/cuenta" className="font-semibold text-coral-deep underline">
              cargá tu WhatsApp en Mi cuenta
            </Link>{" "}
            para empezar a sumar.
          </p>
        ) : (
          <p className="mt-3 text-sm">Entrá con tu cuenta y tu primera compra ya cuenta.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-display text-xl font-bold">Cómo funciona</h2>
        <ol className="mt-3 flex flex-col gap-2.5 font-semibold">
          {[
            "Entrá con tu cuenta (la personita de arriba) y cargá tu WhatsApp.",
            minCents > 0
              ? `Comprá en la tienda con la sesión iniciada: cada pedido de ${formatARS(minCents)} o más, pagado completo, suma una compra.`
              : "Comprá en la tienda con la sesión iniciada: cada pedido pagado completo suma una compra.",
            `En tu compra número ${GIFT_EVERY}, Mariel te regala algo especial 💝`,
          ].map((t, i) => (
            <li key={t} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs text-white">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      {!customer ? (
        <section className="mt-6 rounded-3xl bg-warm-white p-5 shadow-soft ring-1 ring-line/70">
          <h2 className="font-display text-xl font-bold">Entrá en un toque</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Sin contraseña: usás tu cuenta de Google o de Facebook.</p>
          {providers.length > 0 ? (
            <AccountLogin next="/club" providers={providers} />
          ) : (
            <p className="rounded-2xl bg-cream p-3 text-sm font-semibold">Muy pronto vas a poder entrar con tu cuenta. 💖</p>
          )}
          <p className="mt-3 text-center text-xs text-muted">¿No querés cuenta? Podés comprar igual, solo que esas compras no suman al Club.</p>
        </section>
      ) : null}

      <Link href="/productos" className={buttonClasses("primary", "lg", "mt-6 w-full")}>
        <ShoppingBag className="size-5" aria-hidden="true" /> Ir a comprar
      </Link>
    </div>
  );
}
