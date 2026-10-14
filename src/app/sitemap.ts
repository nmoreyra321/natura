import type { MetadataRoute } from "next";

import { getActiveCategories } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/config";
import { createPublicClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/productos`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/como-comprar`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contacto`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const supabase = createPublicClient();
  if (!supabase) return entries;

  const [categories, { data: products }] = await Promise.all([
    getActiveCategories(),
    supabase.from("products").select("slug, updated_at").eq("status", "published").limit(5000),
  ]);
  for (const c of categories) {
    entries.push({ url: `${base}/categorias/${c.slug}`, changeFrequency: "weekly", priority: 0.7 });
  }
  for (const p of products ?? []) {
    entries.push({
      url: `${base}/productos/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
  return entries;
}
