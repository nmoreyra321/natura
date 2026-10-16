import { CategoryDiscount } from "@/components/admin/category-discount";
import { CategoryEditor } from "@/components/admin/category-editor";
import { ProductsHeader } from "@/components/admin/product-tabs";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  const { supabase } = await requireAdmin();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, name, slug, description, position, is_visible, discount_percent, discount_offer").order("position"),
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
      <CategoryDiscount
        categories={(categories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          total: counts.get(c.id)?.total ?? 0,
          percent: Number(c.discount_percent),
          offer: c.discount_offer,
        }))}
      />
      <p className="mt-6 text-muted">
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
