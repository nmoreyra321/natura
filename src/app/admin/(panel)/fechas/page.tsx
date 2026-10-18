import { CampaignEditor } from "@/components/admin/campaign-editor";
import { requireAdmin } from "@/lib/auth";
import { todayAR, type Campaign } from "@/lib/campaigns";

export const metadata = { title: "Fechas especiales" };

export default async function CampaignsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, title, slug, message, starts_on, ends_on, product_ids")
    .order("starts_on", { ascending: false })
    .limit(100);
  const campaigns = (data ?? []) as Campaign[];
  const ids = [...new Set(campaigns.flatMap((c) => c.product_ids))];
  const { data: products } = ids.length
    ? await supabase.from("products").select("id, name, images:product_images(storage_path, position)").in("id", ids)
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Fechas especiales</h1>
      <p className="mt-1 text-muted">
        Elegís productos y fechas: la tienda muestra un cartel con esos regalos y, al terminar, desaparece sola.
      </p>
      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar las fechas especiales.</p>
      ) : (
        <CampaignEditor
          campaigns={campaigns}
          today={todayAR()}
          products={(products ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            image: [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null,
          }))}
        />
      )}
    </div>
  );
}
