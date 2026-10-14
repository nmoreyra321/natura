import { redirect } from "next/navigation";

/** Inventario ahora es la pestaña "Cargar stock" de Productos. */
export default async function InventoryRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams({ vista: "stock" });
  for (const key of ["q", "categoria", "ver", "pagina"]) {
    const v = sp[key];
    const value = Array.isArray(v) ? v[0] : v;
    if (value) params.set(key, value);
  }
  redirect(`/admin/productos?${params.toString()}`);
}
