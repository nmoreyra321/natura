import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductGrid } from "@/components/store/product-card";
import { getCampaignBySlug, getProductsByIds } from "@/lib/catalog";

export const revalidate = 300;

const untilFmt = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export async function generateMetadata({ params }: PageProps<"/especial/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCampaignBySlug(slug);
  return c ? { title: c.title, description: c.message ?? `Regalos de Natura para ${c.title}.` } : {};
}

/** Página de una fecha especial (Día de la Madre…) con los productos que eligió Natu Mariel. */
export default async function CampaignPage({ params }: PageProps<"/especial/[slug]">) {
  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug);
  if (!campaign) notFound();
  const products = await getProductsByIds(campaign.productIds);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="rounded-[2rem] bg-gradient-to-br from-blush via-pink/70 to-lilac px-5 py-8 sm:px-10">
        <h1 className="font-display text-3xl font-bold sm:text-5xl">{campaign.title}</h1>
        {campaign.message ? <p className="mt-2 max-w-2xl text-lg font-semibold text-muted">{campaign.message}</p> : null}
        <p className="mt-3 inline-block rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-coral-deep">
          Hasta el {untilFmt.format(new Date(`${campaign.endsOn}T12:00:00Z`))}
        </p>
      </div>
      <div className="mt-8">
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <p className="text-muted">
            Pronto vas a ver acá los regalos. Mientras tanto, mirá{" "}
            <Link href="/productos" className="font-semibold text-coral-deep underline">
              todos los productos
            </Link>
            .
          </p>
        )}
      </div>
      <p className="mt-8 text-sm text-muted">
        🎁 ¿Es para regalo? Marcá «Es para regalo» en el carrito y Natu Mariel lo prepara.
      </p>
    </div>
  );
}
