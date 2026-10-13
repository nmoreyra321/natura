import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  const { supabase } = await requireAdmin();
  const { data: categories } = await supabase.from("categories").select("id, name").order("position");
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/productos" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-forest">
        <ArrowLeft className="size-4" aria-hidden="true" /> Productos
      </Link>
      <h1 className="mt-2 mb-1 font-display text-3xl font-semibold">Nuevo producto</h1>
      <p className="mb-6 text-muted">Después de crearlo vas a poder agregar las fotos.</p>
      <ProductForm
        productId={null}
        categories={categories ?? []}
        defaults={{
          name: "",
          slug: "",
          description: "",
          category_id: "",
          size: "",
          magazine_price: "",
          sale_price: "",
          stock: "0",
          status: "draft",
          is_featured: false,
          is_offer: false,
        }}
      />
    </div>
  );
}
