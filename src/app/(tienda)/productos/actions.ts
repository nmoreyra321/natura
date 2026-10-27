"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";

import { toWhatsAppPhone } from "@/lib/debts";
import { notifyAdmins } from "@/lib/push";
import { allowRequest } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATALOG_TAG } from "@/lib/supabase/server";

export type RestockResult = { ok: true; message: string } | { ok: false; error: string };

/** La clienta deja su WhatsApp para que le avisen cuando vuelva a haber stock de un producto. */
export async function requestRestock(productId: string, name: string, phone: string): Promise<RestockResult> {
  if (!/^[0-9a-f-]{36}$/.test(String(productId))) return { ok: false, error: "Producto inválido." };
  const normalized = toWhatsAppPhone(String(phone));
  if (!normalized) return { ok: false, error: "Revisá tu WhatsApp: con código de área, por ejemplo 11 2345-6789." };
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
  return { ok: true, message: "¡Listo! Te avisamos por WhatsApp cuando vuelva a haber." };
}

export type ReserveResult = { ok: true; expiresAt: string; message: string } | { ok: false; error: string };

/**
 * «Reservar 24 horas»: la clienta separa uno o más productos; se descuentan del stock para que nadie más los compre
 * y, si no pasa a buscarlos, vuelven solos. Se anota desde el servidor y con freno de intentos.
 */
export async function reserveProduct(productId: string, quantity: number, name: string, phone: string): Promise<ReserveResult> {
  if (!/^[0-9a-f-]{36}$/.test(String(productId))) return { ok: false, error: "Producto inválido." };
  const qty = Math.floor(Number(quantity));
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) return { ok: false, error: "Elegí cuántas unidades querés separar (hasta 10)." };
  const cleanName = String(name ?? "").trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 60) return { ok: false, error: "Escribí tu nombre." };
  const normalized = toWhatsAppPhone(String(phone));
  if (!normalized) return { ok: false, error: "Revisá tu WhatsApp: con código de área, por ejemplo 11 2345-6789." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está disponible ahora." };
  if (!(await allowRequest("reserva", 6, 3600))) return { ok: false, error: "Probaste muchas veces seguidas. Intentá de nuevo más tarde." };

  const { data: id, error } = await admin.rpc("reserve_product", { p_product: productId, p_quantity: qty, p_name: cleanName, p_phone: normalized });
  if (error || !id) {
    const message = error?.message ?? "";
    if (message.includes("sin stock suficiente")) return { ok: false, error: "Ya no quedan tantas unidades. Probá con menos o fijate en la tienda." };
    if (message.includes("demasiadas reservas")) return { ok: false, error: "Ya tenés 3 reservas activas con este WhatsApp. Cuando retires alguna, podés reservar de nuevo." };
    if (message.includes("producto no disponible")) return { ok: false, error: "Ese producto ya no está disponible." };
    console.error("[reserva] No se pudo reservar:", message);
    return { ok: false, error: "No pudimos reservarlo. Probá de nuevo en un rato." };
  }
  const { data: row } = await admin.from("reservations").select("expires_at, product:products(name)").eq("id", id).maybeSingle();
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
  revalidatePath("/admin/reservas");
  const productName = row?.product?.name ?? "un producto";
  after(() =>
    notifyAdmins({
      title: "⏳ Nueva reserva",
      body: `${cleanName} separó ${qty} × ${productName} por 24 horas.`,
      url: "/admin/reservas",
      tag: `reserva-${id}`,
    }),
  );
  return {
    ok: true,
    expiresAt: row?.expires_at ?? new Date(Date.now() + 24 * 3_600_000).toISOString(),
    message: "¡Listo! Te lo guardamos 24 horas.",
  };
}
