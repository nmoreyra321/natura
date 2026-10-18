import { CircleCheck, Gift, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccountLogin } from "@/components/store/account-login";
import { ClubCard } from "@/components/store/club-card";
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
      {customer ? (
        <>
          <h1 className="mt-3 font-display text-3xl leading-tight font-bold sm:text-4xl">
            Cada {GIFT_EVERY} compras, <span className="text-coral-deep">¡un regalo!</span>
          </h1>
          <p className="mt-2 text-muted">
            Suman las compras que hacés en la tienda con tu cuenta{minCents > 0 ? `, de ${formatARS(minCents)} o más` : ""}.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-display text-3xl leading-tight font-bold sm:text-4xl">
            Creá tu cuenta y <span className="text-coral-deep">obtené tu tarjeta</span>
          </h1>
          <p className="mt-2 text-muted">
            Para tener tu tarjeta del club tenés que crear tu cuenta. Es gratis y sin contraseña: entrás con tu cuenta de Google en un toque.
            Cada {GIFT_EVERY} compras{minCents > 0 ? ` de ${formatARS(minCents)} o más` : ""}, Mariel te regala algo especial.
          </p>

          <section id="crear" className="mt-6 scroll-mt-24 rounded-3xl bg-warm-white p-5 shadow-soft ring-2 ring-coral-deep/30">
            <h2 className="font-display text-xl font-bold">Paso 1: creá tu cuenta</h2>
            <p className="mt-1 mb-4 text-sm text-muted">Tocá el botón, elegí tu cuenta y listo: ya tenés tu tarjeta.</p>
            {providers.length > 0 ? (
              <AccountLogin next="/club" providers={providers} />
            ) : (
              <p className="rounded-2xl bg-cream p-3 text-sm font-semibold">Muy pronto vas a poder crear tu cuenta. 💖</p>
            )}
            <p className="mt-3 text-center text-xs text-muted">¿No querés cuenta? Podés comprar igual, solo que esas compras no suman al Club.</p>
          </section>
        </>
      )}

      <section className="mt-6" aria-label={customer ? "Tu avance" : "Tu tarjeta del Club"}>
        {!customer ? <h2 className="mb-2 font-display text-lg font-bold">Así va a ser tu tarjeta</h2> : null}
        <ClubCard done={done} name={customer?.name ?? null} />
        {club && club.pending > 0 ? (
          <p className="mt-3 text-center font-display text-lg font-bold text-coral-deep">¡Te ganaste un regalo! 🎉 Natu Mariel te lo entrega con tu próximo pedido.</p>
        ) : club ? (
          <p className="mt-3 text-center font-semibold">
            Llevás {club.progress} de {GIFT_EVERY}: {club.left === 1 ? "¡te falta solo 1 compra!" : `te faltan ${club.left} compras.`}
          </p>
        ) : customer ? (
          <p className="mt-3 text-center text-sm">
            Te falta un paso:{" "}
            <Link href="/cuenta" className="font-semibold text-coral-deep underline">
              cargá tu WhatsApp en Mi cuenta
            </Link>{" "}
            para empezar a sumar.
          </p>
        ) : (
          <p className="mt-3 text-center text-sm">Cuando crees tu cuenta, tu primera compra ya cuenta.</p>
        )}
      </section>

      {!customer ? (
      <section className="mt-6 rounded-3xl bg-warm-white p-5 shadow-soft ring-1 ring-line/70">
        <h2 className="font-display text-xl font-bold">¿Por qué crear tu cuenta?</h2>
        <ul className="mt-3 flex flex-col gap-2.5 font-semibold">
          {[
            `Cada ${GIFT_EVERY} compras, Mariel te regala algo especial 💝`,
            "Cada compra pagada y confirmada suma un sello a tu tarjeta",
            "Los pedidos que hagas con tu cuenta quedan juntos para seguirlos cuando quieras",
            "Es gratis y entrás en un toque, sin contraseña",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2.5">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-botanical-deep" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </section>
      ) : null}

      <section className="mt-6">
        <h2 className="font-display text-xl font-bold">Cómo funciona</h2>
        <ol className="mt-3 flex flex-col gap-2.5 font-semibold">
          {[
            ...(customer ? [] : ["Creá tu cuenta con Google (arriba) y cargá tu WhatsApp."]),
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

      <Link href="/productos" className={buttonClasses("primary", "lg", "mt-6 w-full")}>
        <ShoppingBag className="size-5" aria-hidden="true" /> Ir a comprar
      </Link>
    </div>
  );
}
