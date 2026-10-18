import { ChevronDown, Handshake, MessageCircle, PackageCheck, ShoppingBag } from "lucide-react";
import { DELIVERY_TEXT } from "@/lib/delivery";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";
import { isMercadoPagoEnabled } from "@/lib/mercadopago";
import { getShippingMinTotal } from "@/lib/shipping";
import { getLoyaltyMinTotal, getMercadoPagoSurcharge } from "@/lib/store-settings";
import type { Metadata } from "next";
import Link from "next/link";

import { LinkButton, buttonClasses } from "@/components/ui/button";
import { buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Cómo comprar",
  description:
    "Cómo hacer tu pedido de productos Natura en Natu Mariel: armá tu carrito, hacé el pedido en la tienda y coordiná la entrega con Mariel por WhatsApp.",
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
    title: "Hacé el pedido",
    text: "Elegí cómo recibirlo y cómo pagar, y tocá «Hacer pedido». Si elegiste Mercado Pago, en el paso siguiente pagás ahí mismo.",
  },
  {
    icon: PackageCheck,
    title: "Se confirma tu pedido",
    text: "Con Mercado Pago, se confirma solo cuando se aprueba el pago. En efectivo, Mariel te escribe por WhatsApp para confirmar la disponibilidad.",
  },
  {
    icon: Handshake,
    title: "Recibís tu pedido",
    text: `Coordinan juntas el día y la entrega: en la estación (${DELIVERY_TEXT}) o en tu casa si elegiste envío. ¡Y a disfrutar!`,
  },
];

type FaqInfo = { clubMin: string | null; shippingMin: string | null; mpSurcharge: number };

const faqsFor = ({ clubMin, shippingMin, mpSurcharge }: FaqInfo) => [
  {
    q: "¿Tengo que crear una cuenta?",
    a: "No. Armás el carrito y hacés el pedido acá mismo, sin registrarte: solo te pedimos tu nombre y tu WhatsApp para coordinar la entrega. Si querés sumar compras al Club Natu Mariel, entrá con tu cuenta antes de pedir (un toque, sin contraseña).",
  },
  {
    q: "¿El pedido queda confirmado al enviarlo?",
    a: "Depende de cómo pagues. Con Mercado Pago se confirma solo, apenas se aprueba el pago, y tus productos quedan reservados. En efectivo queda pendiente hasta que Mariel te confirme por WhatsApp: hasta ese momento no se reservan los productos.",
  },
  {
    q: "¿Cómo pago y cómo recibo el pedido?",
    a: "En el carrito elegís cómo pagar: en efectivo (al recibir) o con Mercado Pago. Con Mercado Pago pagás en la página segura de Mercado Pago, con tarjeta (en una sola cuota), dinero en cuenta o efectivo en puntos de pago, y volvés a la tienda: el pago se verifica solo y ves tu pedido confirmado ahí mismo. La entrega la coordinan por WhatsApp.",
  },
  ...(mpSurcharge > 0
    ? [
        {
          q: "¿Por qué Mercado Pago tiene un recargo?",
          a: `Mercado Pago le cobra una comisión a Natu Mariel por cada pago. Por eso, si pagás con Mercado Pago se suma un ${mpSurcharge.toLocaleString("es-AR", { maximumFractionDigits: 2 })} % a tu compra, y antes de pagar ves el total exacto. En efectivo no hay recargo.`,
        },
      ]
    : []),
  {
    q: "¿Dónde entregan?",
    a: `De dos formas: gratis en punto de encuentro en las estaciones del Roca de ${DELIVERY_TEXT} (más que nada los sábados), o con envío a domicilio en zona sur${shippingMin ? `, para compras desde ${shippingMin}` : ""}. En el carrito ves si llega tu localidad y cuánto cuesta (es un porcentaje de la compra) antes de pedir. Si estás en otra zona, escribinos y lo vemos.`,
  },
  {
    q: "¿Cómo sé en qué está mi pedido?",
    a: "Después de hacer el pedido pasás a su página: ahí ves si el pago está aprobado, si el pedido está confirmado y cuándo se entrega. Para volver a verla, entrá a «Seguir mi pedido» (al pie de la página) con tu código y tu WhatsApp.",
  },
  {
    q: "¿Cómo funciona el Club Natu Mariel?",
    a: `Cada ${GIFT_EVERY} compras${clubMin ? ` de ${clubMin} o más` : ""} te ganás un regalo. Suman las compras que hacés en la tienda con tu cuenta (entrás con Google en un toque): cada pedido${clubMin ? ` de ${clubMin} o más` : ""}, pagado completo, suma una compra. En la página del Club ves cuánto te falta.`,
  },
  {
    q: "¿Qué es el precio de revista?",
    a: "Es el precio oficial de Natura. Al lado ves el precio especial de Natu Mariel; si es más bajo, te mostramos cuánto ahorrás.",
  },
  {
    q: "¿Los precios del carrito pueden cambiar?",
    a: "Antes de enviar el pedido, el carrito vuelve a consultar los precios y la disponibilidad. Si algo cambió, te avisamos en pantalla.",
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
  const [min, shippingMin, mpSurcharge] = await Promise.all([
    getLoyaltyMinTotal(),
    getShippingMinTotal(),
    isMercadoPagoEnabled() ? getMercadoPagoSurcharge() : 0,
  ]);
  const faqs = faqsFor({
    clubMin: min > 0 ? formatARS(Math.round(min * 100)) : null,
    shippingMin: shippingMin > 0 ? formatARS(Math.round(shippingMin * 100)) : null,
    mpSurcharge,
  });
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
        Comprar en Natu Mariel es simple: elegís, hacés el pedido acá y Mariel te atiende personalmente por WhatsApp.
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
