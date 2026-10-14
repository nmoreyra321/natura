import { PhotoUpdater } from "@/components/admin/photo-updater";
import { ProductsHeader } from "@/components/admin/product-tabs";
import { PriceUpdater } from "@/components/admin/price-updater";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Precios y fotos de Natura" };

export default async function NaturaPricesPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, images:product_images(id)")
    .not("natura_sku", "is", null)
    .order("status", { ascending: false }) // primero los publicados
    .order("name")
    .limit(5000);

  return (
    <div className="mx-auto max-w-6xl">
      <ProductsHeader active="natura" />
      <h2 className="mt-5 font-display text-xl font-bold">Precios de Natura</h2>
      <p className="mt-1 max-w-2xl text-muted">
        Cuando sale una revista nueva, buscá acá los precios vigentes en naturacosmeticos.com.ar. Te mostramos qué
        cambió y vos elegís qué aplicar. Nada se modifica hasta que tocás «Aplicar».
      </p>
      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar los productos.</p>
      ) : (
        <div className="mt-6">
          <PriceUpdater productIds={(data ?? []).map((p) => p.id)} />
        </div>
      )}
      {!error ? (
        <div className="mt-8">
          <PhotoUpdater
            all={(data ?? []).map((p) => ({ id: p.id, name: p.name }))}
            withoutPhoto={(data ?? []).filter((p) => (p.images ?? []).length === 0).map((p) => ({ id: p.id, name: p.name }))}
          />
        </div>
      ) : null}
      <p className="mt-6 text-sm text-muted">
        Solo se revisan los productos que tienen código de Natura (los importados del catálogo). Podés cargar el código
        en cualquier producto desde su edición.
      </p>
    </div>
  );
}
