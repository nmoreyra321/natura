import { ChevronDown, Handshake, MessageCircle, PackageCheck, ShoppingBag } from "lucide-react";
import { formatARS } from "@/lib/format";
import { getLoyaltyMinTotal } from "@/lib/store-settings";
import type { Metadata } from "next";
import Link from "next/link";

import { LinkButton, buttonClasses } from "@/components/ui/button";
import { buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Cómo comprar",
  description:
    "Cómo hacer tu pedido de productos Natura en Natu Mariel: armá tu carrito, envialo por WhatsApp y coordiná pago y entrega.",
  alternates: { canonical: "/como-comprar" },
};

const STEP_COLORS = ["bg-pink", "bg-sun", "bg-sage", "bg-lilac"];

const steps = [
  {
    icon: ShoppingBag,
    title: "Armá tu carrito",
    text: "Elegí tus productos y cantidades. No hace falta crear una cuenta: el carrito queda guardado en tu celular.",
  },
  {
    icon: MessageCircle,
    title: "Enviá el pedido por WhatsApp",
    text: "Antes de enviarlo verificamos precios y stock. Se abre WhatsApp con el detalle, los precios y el total.",
  },
  {
    icon: PackageCheck,
    title: "Mariel te confirma",
    text: "Te responde con la disponibilidad y te cuenta las formas de pago y de entrega.",
  },
  {
    icon: Handshake,
    title: "Pagás y recibís",
    text: "Coordinan juntas el pago y la entrega. ¡Y a disfrutar tus productos!",
  },
];

const faqsFor = (clubMin: string | null) => [
  {
    q: "¿Tengo que crear una cuenta?",
    a: "No. Armás el carrito y hacés el pedido acá mismo, sin registrarte: solo te pedimos tu nombre y tu WhatsApp para coordinar la entrega (con ese número también sumás compras en el Club Natu Mariel).",
  },
  {
    q: "¿El pedido queda confirmado al enviarlo?",
    a: "Todavía no. El pedido queda pendiente hasta que Mariel te confirme por WhatsApp. Hasta ese momento no se reserva stock.",
  },
  {
    q: "¿Cómo pago y cómo recibo el pedido?",
    a: "En el carrito elegís cómo pagar: en efectivo o con Mercado Pago (sin recargo: en la página de tu pedido tocás «Pagar con Mercado Pago», pagás con tarjeta o dinero en cuenta y después tocás «Ya pagué»). Cuando Mariel aprueba el pago lo ves ahí mismo, y la entrega la coordinan por WhatsApp.",
  },
  {
    q: "¿Cómo sé en qué está mi pedido?",
    a: "Después de hacer el pedido pasás a su página: ahí ves si el pago está aprobado, si el pedido está confirmado y cuándo se entrega. Para volver a verla, entrá a «Seguir mi pedido» (al pie de la página) con tu código y tu WhatsApp.",
  },
  {
    q: "¿Cómo funciona el Club Natu Mariel?",
    a: `Cada 5 compras${clubMin ? ` de ${clubMin} o más` : ""} te ganás un regalo. Se cuentan solas con tu número de WhatsApp, sin anotarte en ningún lado: cada pedido${clubMin ? ` de ${clubMin} o más` : ""}, pagado completo, suma una compra (también las que hacés en los vivos o por WhatsApp). En la página de tu pedido ves cuánto te falta.`,
  },
  {
    q: "¿Qué es el precio de revista?",
    a: "Es el precio oficial de Natura. Al lado ves el precio especial de Natu Mariel; si es más bajo, te mostramos cuánto ahorrás.",
  },
  {
    q: "¿Los precios del carrito pueden cambiar?",
    a: "Antes de enviar el pedido, el carrito vuelve a consultar los precios y el stock vigentes. Si algo cambió, te avisamos en pantalla.",
  },
  {
    q: "¿Puedo pedir un producto que no está en la tienda?",
    a: "Sí, escribile a Mariel por WhatsApp y consultale por el producto que buscás.",
  },
  {
    q: "¿Puedo tener la tienda como app en el celular?",
    a: "Sí. En Android tocá «Instalar app» en el menú o al pie de la página. En iPhone, abrí la tienda en Safari, tocá Compartir y elegí «Agregar a inicio».",
  },
];

export default async function HowToBuyPage() {
  const number = getWhatsAppNumber();
  const min = await getLoyaltyMinTotal();
  const faqs = faqsFor(min > 0 ? formatARS(Math.round(min * 100)) : null);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <h1 className="font-display text-4xl font-bold text-balance sm:text-5xl">Cómo comprar</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Comprar en Natu Mariel es simple: elegís, enviás el pedido por WhatsApp y Mariel te atiende personalmente.
      </p>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className={`rounded-3xl border-2 border-forest p-5 shadow-[4px_4px_0_var(--forest)] ${STEP_COLORS[i % STEP_COLORS.length]}`}
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-white text-coral-deep">
              <s.icon className="size-5" aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-extrabold text-forest/70">Paso {i + 1}</p>
            <h2 className="font-display text-lg font-bold">{s.title}</h2>
            <p className="mt-1 font-semibold text-forest/80">{s.text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        <LinkButton href="/productos" size="lg">
          <ShoppingBag className="size-5" aria-hidden="true" /> Ver productos
        </LinkButton>
        {number ? (
          <a
            href={buildWhatsAppUrl(number, "¡Hola Mariel! Tengo una consulta sobre cómo comprar.")}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("whatsapp", "lg")}
          >
            <MessageCircle className="size-5" aria-hidden="true" /> Consultar por WhatsApp
          </a>
        ) : null}
      </div>

      <section className="mt-16" aria-labelledby="preguntas">
        <h2 id="preguntas" className="font-display text-3xl font-bold">
          Preguntas frecuentes
        </h2>
        <div className="mt-6 flex flex-col gap-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-3xl border-2 border-forest bg-warm-white shadow-[3px_3px_0_var(--forest)] open:bg-blush/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-display text-lg font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown
                  className="size-5 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="-mt-1 px-5 pb-5 text-forest/85">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-muted">
          ¿Te quedó alguna duda?{" "}
          <Link href="/contacto" className="font-semibold text-coral-deep underline">
            Escribinos
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
