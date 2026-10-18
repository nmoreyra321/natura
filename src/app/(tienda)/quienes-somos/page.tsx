import { BadgePercent, CalendarHeart, Heart, MessageCircle, Radio, ShieldCheck, Sparkles, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LeafMark } from "@/components/store/logo";
import { getSocialLinks } from "@/lib/store-settings";
import { buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";
import { DELIVERY_TEXT } from "@/lib/delivery";

export const metadata: Metadata = {
  title: "Quiénes somos",
  description: "Soy Mariel: hace más de 5 años que vendo productos Natura y hago vivos en Facebook. Conocé Natu Mariel.",
  alternates: { canonical: "/quienes-somos" },
};

export const revalidate = 300;

const WHY = [
  { icon: BadgePercent, title: "Precios especiales", text: "Muchos productos con descuento frente al precio de la revista.", tone: "bg-sun" },
  { icon: ShieldCheck, title: "Productos originales", text: "Todo es Natura original, como lo recibo de la marca.", tone: "bg-sage" },
  { icon: Heart, title: "Te asesoro", text: "Te ayudo a elegir el perfume, la crema o el regalo ideal.", tone: "bg-pink" },
  { icon: Truck, title: "Entrega coordinada", text: `En zona sur: punto de encuentro en las estaciones de ${DELIVERY_TEXT} (más que nada los sábados) o envío a domicilio. Arreglamos juntas el día.`, tone: "bg-lilac" },
];

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** «Quiénes somos»: Mariel cuenta en primera persona quién es y cómo vende. */
export default async function AboutPage() {
  const [social, whatsapp] = [await getSocialLinks(), getWhatsAppNumber()];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blush via-pink/70 to-lilac p-6 sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/50 blur-3xl" />
        <p className="relative inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-coral-deep">
          <Sparkles className="size-4" aria-hidden="true" /> Quiénes somos
        </p>
        <h1 className="relative mt-4 font-display text-4xl font-bold sm:text-5xl">Hola, soy Mariel 🌸</h1>
        <div className="relative mt-4 flex max-w-2xl flex-col gap-3 text-lg text-forest/85">
          <p>
            Hace <strong>más de 5 años</strong> que vendo productos Natura, y lo que más disfruto es acompañar a cada
            clienta para que encuentre lo que busca: ese perfume que la representa, la crema justa para su piel o el regalo
            perfecto.
          </p>
          <p>
            <strong>Natu Mariel</strong> es mi tienda: acá tenés tus productos favoritos a precios especiales y la misma
            atención cercana de siempre.
          </p>
        </div>
        <LeafMark className="absolute right-6 bottom-6 hidden size-16 rotate-12 opacity-40 sm:block" />
      </section>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        <li className="flex items-center gap-3 rounded-3xl bg-warm-white p-4 shadow-soft">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sun text-forest">
            <CalendarHeart className="size-5" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <strong className="block font-display text-xl">+5 años</strong>
            <span className="text-sm text-muted">vendiendo Natura</span>
          </span>
        </li>
        <li className="flex items-center gap-3 rounded-3xl bg-warm-white p-4 shadow-soft">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-pink text-forest">
            <Radio className="size-5" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <strong className="block font-display text-xl">Vivos</strong>
            <span className="text-sm text-muted">en Facebook</span>
          </span>
        </li>
        <li className="flex items-center gap-3 rounded-3xl bg-warm-white p-4 shadow-soft">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage text-forest">
            <Heart className="size-5" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <strong className="block font-display text-xl">Atención</strong>
            <span className="text-sm text-muted">personalizada</span>
          </span>
        </li>
      </ul>

      <section aria-labelledby="vivos" className="mt-10 rounded-3xl border-2 border-forest bg-warm-white p-6 shadow-[4px_4px_0_var(--forest)] sm:p-8">
        <h2 id="vivos" className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
          <span className="relative flex size-3" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-coral-deep/60" />
            <span className="relative inline-flex size-3 rounded-full bg-coral-deep" />
          </span>
          Mis vivos en Facebook
        </h2>
        <p className="mt-3 text-lg text-forest/85">
          En mis vivos te muestro los productos de cerca, te cuento las novedades y las ofertas, y respondo todas tus
          preguntas en el momento. ¡Sumate, que siempre hay sorpresas!
        </p>
        {social.facebook || social.instagram ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {social.facebook ? (
              <a
                href={social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#1877f2] px-6 font-bold text-white shadow-soft transition hover:-translate-y-0.5"
              >
                <FacebookIcon className="size-5" /> Seguime en Facebook
              </a>
            ) : null}
            {social.instagram ? (
              <a
                href={social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-6 font-bold text-white shadow-soft transition hover:-translate-y-0.5"
              >
                <InstagramIcon className="size-5" /> Seguime en Instagram
              </a>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="por-que" className="mt-10">
        <h2 id="por-que" className="font-display text-2xl font-bold sm:text-3xl">
          ¿Por qué comprarme?
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {WHY.map((w) => (
            <li key={w.title} className="flex gap-3 rounded-3xl bg-warm-white p-4 shadow-soft">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${w.tone} text-forest`}>
                <w.icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <strong className="block">{w.title}</strong>
                <span className="text-sm text-muted">{w.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 flex flex-col items-start gap-4 rounded-[2rem] bg-gradient-to-br from-forest via-grape to-coral-deep p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <p className="font-display text-2xl font-bold">¿Te ayudo a elegir?</p>
          <p className="mt-1 text-white/85">Escribime por WhatsApp o mirá todos los productos de la tienda.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {whatsapp ? (
            <a
              href={buildWhatsAppUrl(whatsapp, "¡Hola Mariel! Te escribo desde la tienda 😊")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-forest shadow-lift transition hover:-translate-y-0.5"
            >
              <MessageCircle className="size-5 text-botanical-deep" aria-hidden="true" /> Escribime
            </a>
          ) : null}
          <Link
            href="/productos"
            className="inline-flex min-h-12 items-center rounded-full border-2 border-white px-6 font-bold text-white transition hover:bg-white/10"
          >
            Ver productos
          </Link>
        </div>
      </section>
    </div>
  );
}
