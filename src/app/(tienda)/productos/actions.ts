"use server";

import { toWhatsAppPhone } from "@/lib/debts";
import { allowRequest } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export type RestockResult = { ok: true; message: string } | { ok: false; error: string };

/** La clienta deja su WhatsApp para que le avisen cuando vuelva a haber stock de un producto. */
export async function requestRestock(productId: string, name: string, phone: string): Promise<RestockResult> {
  if (!/^[0-9a-f-]{36}$/.test(String(productId))) return { ok: false, error: "Producto inválido." };
  const normalized = toWhatsAppPhone(String(phone));
  if (!normalized) return { ok: false, error: "Escribí tu celular con código de área, por ejemplo 11 2345-6789." };
  // Se anota desde el servidor (no directo desde el navegador) y con freno de intentos.
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "La tienda no está disponible ahora." };
  if (!(await allowRequest("aviso-stock", 10, 3600))) {
    return { ok: false, error: "Te anotaste muchas veces seguidas. Probá de nuevo más tarde." };
  }
  const { data: product } = await supabase.from("products").select("id").eq("id", productId).eq("status", "published").maybeSingle();
  if (!product) return { ok: false, error: "Producto inválido." };

  const { error } = await supabase.from("restock_requests").insert({
    product_id: productId,
    name: String(name ?? "").trim().slice(0, 80) || null,
    phone: normalized,
  });
  // 23505: ya estaba anotada para este producto.
  if (error && error.code !== "23505") {
    console.error("[aviso] No se pudo anotar:", error.message);
    return { ok: false, error: "No pudimos anotarte. Probá de nuevo en un rato." };
  }
  return { ok: true, message: "¡Listo! Te avisamos por WhatsApp cuando vuelva a haber stock." };
}
