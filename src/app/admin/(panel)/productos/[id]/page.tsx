import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ImageManager } from "@/components/admin/image-manager";
import { NaturaPhoto } from "@/components/admin/natura-photo";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Editar producto" };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { nuevo } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const [{ data: product }, { data: categories }, { data: images }, { data: lineRows }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("id, name").order("position"),
    supabase.from("product_images").select("id, storage_path, alt, position").eq("product_id", id).order("position"),
    supabase.from("products").select("line").not("line", "is", null),
  ]);
  if (!product) notFound();
  const lines = [...new Set((lineRows ?? []).map((r) => r.line!))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/productos" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-forest">
        <ArrowLeft className="size-4" aria-hidden="true" /> Productos
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{product.name}</h1>
          <p className="text-sm text-muted">
            Creado el {formatDate(product.created_at)} · Actualizado el {formatDate(product.updated_at)}
          </p>
        </div>
        {product.status === "published" ? (
          <Link href={`/productos/${product.slug}`} target="_blank" className="inline-flex items-center gap-1 font-semibold text-coral-deep hover:underline">
            Ver en la tienda <ExternalLink className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className="rounded-full bg-cream px-3 py-1 text-sm font-semibold text-muted">Borrador: no visible en la tienda</span>
        )}
      </div>

      {nuevo ? (
        <p className="mb-6 rounded-2xl bg-sage p-4 font-semibold text-botanical-deep" role="status">
          ¡Producto creado! Ahora agregale fotos y, cuando esté listo, cambiá el estado a “Publicado”.
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        <ImageManager productId={product.id} productName={product.name} images={images ?? []} />
        <section className="rounded-3xl bg-warm-white p-4 shadow-soft">
          <h2 className="font-display text-lg font-bold">Traer foto de Natura</h2>
          <p className="mb-3 text-sm text-muted">
            {(images ?? []).length === 0 ? "Este producto todavía no tiene foto. " : ""}Con el código de Natura (o el enlace del
            producto en naturacosmeticos.com.ar) se ponen las fotos oficiales actuales. Reemplaza solo las fotos que vinieron de
            Natura: las que subiste vos quedan.
          </p>
          <NaturaPhoto productId={product.id} sku={product.natura_sku} />
        </section>
        <ProductForm
          key={product.updated_at}
          productId={product.id}
          categories={categories ?? []}
          lines={lines}
          defaults={{
            name: product.name,
            slug: product.slug,
            description: product.description,
            category_id: product.category_id ?? "",
            size: product.size ?? "",
            line: product.line ?? "",
            natura_sku: product.natura_sku ?? "",
            magazine_price: String(product.magazine_price),
            sale_price: String(product.sale_price),
            stock: String(product.stock),
            status: product.status as "draft" | "published",
            is_featured: product.is_featured,
            is_offer: product.is_offer,
            gender: product.gender === "femenino" || product.gender === "masculino" ? product.gender : "",
          }}
        />
      </div>
    </div>
  );
}
