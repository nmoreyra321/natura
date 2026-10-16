import type { Metadata } from "next";

import { CatalogView } from "@/components/store/catalog-view";
import { parseCatalogFilters } from "@/lib/catalog";

/** El título de la pestaña (y de Google) dice «Ofertas» cuando se están mirando las ofertas. */
export async function generateMetadata({ searchParams }: PageProps<"/productos">): Promise<Metadata> {
  const offers = parseCatalogFilters(await searchParams).offers;
  return {
    title: offers ? "Ofertas" : "Todos los productos",
    description: offers
      ? "Ofertas de productos Natura más baratos que en la revista."
      : "Catálogo de productos Natura a precios especiales: perfumería, cuerpo, rostro, cabello y más.",
    alternates: { canonical: offers ? "/productos?ofertas=1" : "/productos" },
  };
}

export default async function ProductsPage({ searchParams }: PageProps<"/productos">) {
  const filters = parseCatalogFilters(await searchParams);
  return (
    <CatalogView
      title={filters.offers ? "Ofertas" : "Todos los productos"}
      basePath="/productos"
      filters={filters}
    />
  );
}
