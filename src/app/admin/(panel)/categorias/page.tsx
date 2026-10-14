import { CategoryEditor } from "@/components/admin/category-editor";
import { ProductsHeader } from "@/components/admin/product-tabs";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, description, position, is_visible").order("position"),
    supabase.from("products").select("category_id, status"),
  ]);
  const counts = new Map<string, { total: number; published: number }>();
  for (const p of products ?? []) {
    if (!p.category_id) continue;
    const c = counts.get(p.category_id) ?? { total: 0, published: 0 };
    c.total++;
    if (p.status === "published") c.published++;
    counts.set(p.category_id, c);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <ProductsHeader active="categorias" />
      <div className="mx-auto mt-5 max-w-3xl">
      <p className="text-muted">
        Una categoría aparece en la tienda solo si está visible y tiene al menos un producto publicado.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {(categories ?? []).map((c) => (
          <CategoryEditor key={`${c.id}-${c.name}-${c.position}-${c.is_visible}`} category={c} counts={counts.get(c.id) ?? { total: 0, published: 0 }} />
        ))}
        <CategoryEditor category={null} counts={{ total: 0, published: 0 }} />
      </div>
      </div>
    </div>
  );
}
