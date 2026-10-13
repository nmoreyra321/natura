import { MessageCircle, PackageCheck, ShoppingBag, Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { buttonClasses } from "@/components/ui/button";
import { buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escribile a Mariel por WhatsApp para consultas y pedidos de productos Natura.",
  alternates: { canonical: "/contacto" },
};

const steps = [
  { icon: ShoppingBag, title: "Armá tu carrito", text: "Elegí tus productos y cantidades. No hace falta crear una cuenta." },
  { icon: MessageCircle, title: "Enviá el pedido por WhatsApp", text: "Se abre un mensaje con el detalle, los precios y el total." },
  { icon: PackageCheck, title: "Mariel te confirma", text: "Te responde con la disponibilidad, la forma de pago y la entrega." },
];

export default function ContactPage() {
  const number = getWhatsAppNumber();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="inline-flex items-center gap-2 rounded-full bg-blush px-3 py-1 text-sm font-bold text-coral-deep">
        <Sparkles className="size-4" aria-hidden="true" /> Atención personalizada
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">¡Hablemos!</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        ¿Tenés dudas sobre un producto, querés una recomendación o armar un regalo? Escribime y te ayudo.
      </p>

      <div className="mt-8 rounded-3xl bg-warm-white p-6 shadow-soft">
        {number ? (
          <a
            href={buildWhatsAppUrl(number, "¡Hola Mariel! Tengo una consulta.")}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("whatsapp", "lg")}
          >
            <MessageCircle className="size-5" aria-hidden="true" />
            Escribir por WhatsApp
          </a>
        ) : (
          <p className="text-muted">
            Muy pronto vas a poder escribirnos por WhatsApp desde acá. ¡Gracias por la paciencia!
          </p>
        )}
      </div>

      <section id="como-comprar" className="mt-14 scroll-mt-24" aria-labelledby="como">
        <h2 id="como" className="font-display text-3xl font-semibold">Cómo comprar</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-3xl border border-line bg-warm-white p-5">
              <div className="flex size-11 items-center justify-center rounded-full bg-sage text-botanical-deep">
                <s.icon className="size-5" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm font-bold text-muted">Paso {i + 1}</p>
              <h3 className="font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
