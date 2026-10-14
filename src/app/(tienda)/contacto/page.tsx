import { MessageCircle, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escribile a Mariel por WhatsApp para consultas y pedidos de productos Natura.",
  alternates: { canonical: "/contacto" },
};

export default function ContactPage() {
  const number = getWhatsAppNumber();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="inline-flex items-center gap-2 rounded-full bg-blush px-3 py-1 text-sm font-bold text-coral-deep">
        <Sparkles className="size-4" aria-hidden="true" /> Atención personalizada
      </p>
      <h1 className="mt-4 font-display text-4xl font-bold sm:text-5xl">¡Hablemos!</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        ¿Tenés dudas sobre un producto, querés una recomendación o armar un regalo? Escribime y te ayudo.
      </p>

      <div className="mt-8 rounded-3xl border-2 border-forest bg-warm-white p-6 shadow-[4px_4px_0_var(--forest)]">
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

      <section id="como-comprar" className="mt-14 scroll-mt-24 rounded-3xl bg-sun p-6" aria-labelledby="como">
        <h2 id="como" className="font-display text-2xl font-bold">¿Primera vez que comprás?</h2>
        <p className="mt-1 font-semibold text-forest/80">Te contamos paso a paso cómo hacer tu pedido y respondemos las dudas más comunes.</p>
        <Link href="/como-comprar" className={buttonClasses("outline", "md", "mt-4")}>
          Ver cómo comprar
        </Link>
      </section>
    </div>
  );
}
