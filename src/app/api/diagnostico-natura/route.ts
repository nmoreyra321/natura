import { fetchNaturaMagazinePrice } from "@/lib/natura";

/** TEMPORAL: verifica desde Vercel que se puede leer el precio de Natura. Solo en despliegues de prueba. */
export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") return new Response("Not found", { status: 404 });
  const sku = new URL(request.url).searchParams.get("sku") ?? "NATARG-2821";
  if (!/^NATARG-\d{1,12}$/.test(sku)) return new Response("Bad request", { status: 400 });
  return Response.json(await fetchNaturaMagazinePrice(sku));
}
