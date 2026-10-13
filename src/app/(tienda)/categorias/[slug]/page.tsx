import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogView } from "@/components/store/catalog-view";
import { getActiveCategories, getCategoryBySlug, parseCatalogFilters } from "@/lib/catalog";

export async function generateMetadata({ params }: PageProps<"/categorias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Categoría no encontrada" };
  return {
    title: category.name,
    description: category.description ?? `${category.name} de Natura a precios especiales.`,
    alternates: { canonical: `/categorias/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categorias/[slug]">) {
  const { slug } = await params;
  const [category, active] = await Promise.all([getCategoryBySlug(slug), getActiveCategories()]);
  // Una categoría sin productos publicados no se muestra como si tuviera catálogo.
  if (!category || !active.some((c) => c.id === category.id)) notFound();

  const filters = { ...parseCatalogFilters(await searchParams), category: category.slug };
  return (
    <CatalogView
      title={category.name}
      description={category.description}
      basePath={`/categorias/${category.slug}`}
      filters={filters}
      fixedCategory
    />
  );
}
