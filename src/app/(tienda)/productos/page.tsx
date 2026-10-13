import type { Metadata } from "next";

import { CatalogView } from "@/components/store/catalog-view";
import { parseCatalogFilters } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Productos",
  description: "Catálogo de productos Natura a precios especiales: perfumería, cuerpo, rostro, cabello y más.",
  alternates: { canonical: "/productos" },
};

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
