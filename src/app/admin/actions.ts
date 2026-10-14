"use server";

import { ApiError, createPartFromBase64, GoogleGenAI, type Part } from "@google/genai";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdmin, UnauthorizedError } from "@/lib/auth";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/config";
import { isValidProductImagePath, MAX_IMAGES_PER_PRODUCT } from "@/lib/images";
import type { NaturaLookup } from "@/lib/natura";
import { parseExpiry } from "@/lib/lots";
import { toWhatsAppPhone } from "@/lib/debts";
import { formatARS } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPrice, planMagazinePriceUpdate, salePriceFromDiscount, toCents } from "@/lib/pricing";
import { codeKey, mergeReceiptItems, skuFromCode, skuVariants } from "@/lib/receipt";
import { nameSearchPatterns } from "@/lib/search";
import { slugify } from "@/lib/slug";
import { createSessionClient, CATALOG_TAG } from "@/lib/supabase/server";
import { categorySchema, fieldErrors, loginSchema, productSchema, surchargeSchema, transferSettingsSchema } from "@/lib/validation";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fields?: Record<string, string> };

function refreshCatalog() {
  updateTag(CATALOG_TAG);
  revalidatePath("/", "layout");
}

function fail(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof UnauthorizedError) {
    return { ok: false, error: "Tu sesión venció o no tenés permisos. Volvé a iniciar sesión." };
  }
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505" && String((error as { message?: string }).message).includes("natura_sku")) {
    return { ok: false, error: "Ese código de Natura ya está cargado en otro producto.", fields: { natura_sku: "Código repetido." } };
  }
  if (code === "23505") return { ok: false, error: "Ya existe otro registro con esa URL (slug).", fields: { slug: "Esta URL ya está en uso." } };
  if (code === "23514") return { ok: false, error: "Algún dato no cumple las reglas (precios, stock u oferta)." };
  if (code === "42501") return { ok: false, error: "No tenés permisos para esta acción." };
  console.error("[admin]", fallback, (error as Error)?.message ?? error);
  return { ok: false, error: fallback };
}

/* ------------------------------ Sesión ------------------------------ */

export async function signIn(_: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: "Revisá los datos.", fields: fieldErrors(parsed.error) };

  const supabase = await createSessionClient();
  if (!supabase) return { ok: false, error: "Falta configurar Supabase en el servidor." };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Mensaje genérico: no revela si el correo existe.
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { ok: false, error: "Esta cuenta no tiene permisos de administradora." };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

/* ----------------------------- Productos ----------------------------- */

export async function saveProduct(
  productId: string | null,
  input: Record<string, unknown>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const { supabase } = await assertAdmin();
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Revisá los campos marcados.", fields: fieldErrors(parsed.error) };
    }
    const data = parsed.data;
    const slug = data.slug || slugify(data.name);
    if (!slug) return { ok: false, error: "No pudimos generar la URL.", fields: { slug: "Escribí una URL válida." } };

    const row = { ...data, slug };
    const query = productId
      ? supabase.from("products").update(row).eq("id", productId).select("id, slug").single()
      : supabase.from("products").insert(row).select("id, slug").single();
    const { data: saved, error } = await query;
    if (error) return fail(error, "No pudimos guardar el producto.");

    refreshCatalog();
    return { ok: true, data: saved, message: productId ? "Cambios guardados." : "Producto creado." };
  } catch (e) {
    return fail(e, "No pudimos guardar el producto.");
  }
}

export async function updateProductQuick(
  productId: string,
  patch: { status?: "draft" | "published"; stock?: number; is_featured?: boolean },
): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const clean: typeof patch = {};
    if (patch.status === "draft" || patch.status === "published") clean.status = patch.status;
    if (patch.stock !== undefined) {
      if (!Number.isInteger(patch.stock) || patch.stock < 0 || patch.stock > 100_000) {
        return { ok: false, error: "El stock tiene que ser un número entero entre 0 y 100000." };
      }
      clean.stock = patch.stock;
    }
    if (typeof patch.is_featured === "boolean") clean.is_featured = patch.is_featured;
    if (Object.keys(clean).length === 0) return { ok: false, error: "Nada para actualizar." };

    const { error } = await supabase.from("products").update(clean).eq("id", productId);
    if (error) return fail(error, "No pudimos actualizar el producto.");
    refreshCatalog();
    return { ok: true };
  } catch (e) {
    return fail(e, "No pudimos actualizar el producto.");
  }
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const { data: images } = await supabase
      .from("product_images")
      .select("storage_path")
      .eq("product_id", productId);
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return fail(error, "No pudimos eliminar el producto.");
    const paths = (images ?? []).map((i) => i.storage_path);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
      if (storageError) console.error("[admin] Fotos huérfanas:", storageError.message);
    }
    refreshCatalog();
    return { ok: true, message: "Producto eliminado." };
  } catch (e) {
    return fail(e, "No pudimos eliminar el producto.");
  }
}

/* ------------------------------- Fotos ------------------------------- */

/** Registra una foto ya subida a Storage por el navegador (con la sesión de la administradora). */
export async function addProductImage(productId: string, storagePath: string, alt?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await assertAdmin();
    if (!isValidProductImagePath(storagePath, productId)) {
      return { ok: false, error: "Ruta de foto inválida." };
    }
    const { count } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    if ((count ?? 0) >= MAX_IMAGES_PER_PRODUCT) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([storagePath]);
      return { ok: false, error: `Cada producto puede tener hasta ${MAX_IMAGES_PER_PRODUCT} fotos.` };
    }
    const { data, error } = await supabase
      .from("product_images")
      .insert({ product_id: productId, storage_path: storagePath, alt: alt?.slice(0, 200) || null, position: count ?? 0 })
      .select("id")
      .single();
    if (error) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([storagePath]);
      return fail(error, "No pudimos guardar la foto.");
    }
    refreshCatalog();
    return { ok: true, data };
  } catch (e) {
    return fail(e, "No pudimos guardar la foto.");
  }
}

export async function replaceProductImage(imageId: string, newPath: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const { data: image, error: readError } = await supabase
      .from("product_images")
      .select("id, product_id, storage_path")
      .eq("id", imageId)
      .single();
    if (readError || !image) return { ok: false, error: "La foto ya no existe." };
    if (!isValidProductImagePath(newPath, image.product_id)) return { ok: false, error: "Ruta de foto inválida." };

    const { error } = await supabase.from("product_images").update({ storage_path: newPath }).eq("id", imageId);
    if (error) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([newPath]);
      return fail(error, "No pudimos reemplazar la foto.");
    }
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.storage_path]);
    refreshCatalog();
    return { ok: true, message: "Foto reemplazada." };
  } catch (e) {
    return fail(e, "No pudimos reemplazar la foto.");
  }
}

export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const { data: image } = await supabase
      .from("product_images")
      .select("storage_path")
      .eq("id", imageId)
      .single();
    if (!image) return { ok: false, error: "La foto ya no existe." };
    const { error } = await supabase.from("product_images").delete().eq("id", imageId);
    if (error) return fail(error, "No pudimos eliminar la foto.");
    await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.storage_path]);
    refreshCatalog();
    return { ok: true, message: "Foto eliminada." };
  } catch (e) {
    return fail(e, "No pudimos eliminar la foto.");
  }
}

export async function reorderProductImages(productId: string, orderedIds: string[]): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (orderedIds.length > MAX_IMAGES_PER_PRODUCT) return { ok: false, error: "Demasiadas fotos." };
    for (const [position, id] of orderedIds.entries()) {
      const { error } = await supabase
        .from("product_images")
        .update({ position })
        .eq("id", id)
        .eq("product_id", productId);
      if (error) return fail(error, "No pudimos ordenar las fotos.");
    }
    refreshCatalog();
    return { ok: true };
  } catch (e) {
    return fail(e, "No pudimos ordenar las fotos.");
  }
}

/* ----------------------------- Categorías ----------------------------- */

export async function saveCategory(categoryId: string | null, _: unknown, formData: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const parsed = categorySchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug") ?? "",
      description: formData.get("description") ?? "",
      position: formData.get("position") || 0,
      is_visible: formData.get("is_visible") === "on",
    });
    if (!parsed.success) return { ok: false, error: "Revisá los campos.", fields: fieldErrors(parsed.error) };
    const row = { ...parsed.data, slug: parsed.data.slug || slugify(parsed.data.name, 80) };
    const { error } = categoryId
      ? await supabase.from("categories").update(row).eq("id", categoryId)
      : await supabase.from("categories").insert(row);
    if (error) return fail(error, "No pudimos guardar la categoría.");
    refreshCatalog();
    revalidatePath("/admin/categorias");
    return { ok: true, message: categoryId ? "Categoría actualizada." : "Categoría creada." };
  } catch (e) {
    return fail(e, "No pudimos guardar la categoría.");
  }
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const { error } = await supabase.from("categories").delete().eq("id", categoryId);
    if (error) return fail(error, "No pudimos eliminar la categoría.");
    refreshCatalog();
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Categoría eliminada. Sus productos quedaron sin categoría." };
  } catch (e) {
    return fail(e, "No pudimos eliminar la categoría.");
  }
}

/* ------------------------------ Pedidos ------------------------------ */

const ORDER_STATUSES = ["pending", "confirmed", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Cambia el estado de un pedido. Confirmar/entregar descuenta stock; cancelar lo devuelve. */
export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!ORDER_STATUSES.includes(status) || !/^[0-9a-f-]{36}$/.test(orderId)) {
      return { ok: false, error: "Datos inválidos." };
    }
    const { error } = await supabase.rpc("set_order_status", { order_id: orderId, new_status: status });
    if (error) return fail(error, "No pudimos actualizar el pedido.");
    refreshCatalog();
    revalidatePath("/admin/pedidos");
    return { ok: true };
  } catch (e) {
    return fail(e, "No pudimos actualizar el pedido.");
  }
}

/**
 * Anota un pago (total o parcial) de un pedido en efectivo o por transferencia.
 * Suma el monto a lo ya pagado; cuando cubre el total, el pedido queda "Pagado".
 */
export async function registerOrderPayment(orderId: string, amount: number, note?: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(orderId) || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
      return { ok: false, error: "Escribí un monto válido." };
    }
    const { data: order, error: readError } = await supabase
      .from("orders")
      .select("total, amount_paid, payment_method")
      .eq("id", orderId)
      .maybeSingle();
    if (readError) return fail(readError, "No pudimos leer el pedido.");
    // Los pagos de Mercado Pago los confirma Mercado Pago, no se tocan a mano.
    if (!order || order.payment_method === "mercadopago") return { ok: false, error: "No encontramos ese pedido." };

    const totalCents = toCents(order.total);
    const paidCents = toCents(order.amount_paid) + toCents(amount);
    const complete = paidCents >= totalCents;
    const { error } = await supabase
      .from("orders")
      .update({
        amount_paid: paidCents / 100,
        payment_status: complete ? "approved" : null,
        paid_at: complete ? new Date().toISOString() : null,
        payment_note: complete ? null : note?.trim().slice(0, 120) || null,
      })
      .eq("id", orderId);
    if (error) return fail(error, "No pudimos anotar el pago.");
    revalidatePath("/admin/pedidos");
    return {
      ok: true,
      message: complete ? "Pedido pagado por completo." : `Pago anotado. Falta ${formatARS(totalCents - paidCents)}.`,
    };
  } catch (e) {
    return fail(e, "No pudimos anotar el pago.");
  }
}

/** Borra los pagos anotados de un pedido (por si se cargó mal). */
export async function resetOrderPayment(orderId: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(orderId)) return { ok: false, error: "Datos inválidos." };
    const { data, error } = await supabase
      .from("orders")
      .update({ amount_paid: 0, payment_status: null, paid_at: null, payment_note: null })
      .eq("id", orderId)
      .neq("payment_method", "mercadopago")
      .select("id");
    if (error) return fail(error, "No pudimos actualizar el pago.");
    if (!data?.length) return { ok: false, error: "No encontramos ese pedido." };
    revalidatePath("/admin/pedidos");
    return { ok: true, message: "Pagos borrados: el pedido quedó sin cobrar." };
  } catch (e) {
    return fail(e, "No pudimos actualizar el pago.");
  }
}

/**
 * Borra pedidos cancelados (con sus productos). Solo cancelados: el stock ya se devolvió
 * al cancelarlos, así que borrarlos no cambia el inventario.
 */
export async function deleteCancelledOrders(orderIds: string[]): Promise<ActionResult<{ deleted: number }>> {
  try {
    const { supabase } = await assertAdmin();
    const ids = [...new Set(orderIds)].filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 200);
    if (ids.length === 0) return { ok: false, error: "No elegiste pedidos." };
    const { data, error } = await supabase
      .from("orders")
      .delete()
      .in("id", ids)
      .eq("status", "cancelled")
      .eq("stock_applied", false)
      .select("id");
    if (error) return fail(error, "No pudimos borrar los pedidos.");
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ventas");
    const deleted = data?.length ?? 0;
    return {
      ok: true,
      data: { deleted },
      message: `${deleted} ${deleted === 1 ? "pedido cancelado borrado" : "pedidos cancelados borrados"}.`,
    };
  } catch (e) {
    return fail(e, "No pudimos borrar los pedidos.");
  }
}

/* --------------------------- Precios de Natura --------------------------- */

export type NaturaPriceCheck = {
  id: string;
  name: string;
  sku: string;
  magazinePrice: number;
  salePrice: number;
  isOffer: boolean;
  result: NaturaLookup;
};

const UUID_RE = /^[0-9a-f-]{36}$/;
const MAX_CHECK_BATCH = 20;

/** Consulta en Natura el precio de revista vigente de un grupo de productos (no cambia nada). */
export async function checkNaturaPrices(productIds: string[]): Promise<ActionResult<NaturaPriceCheck[]>> {
  try {
    const { supabase } = await assertAdmin();
    const ids = [...new Set(productIds)].filter((id) => UUID_RE.test(id)).slice(0, MAX_CHECK_BATCH);
    if (ids.length === 0) return { ok: true, data: [] };
    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, natura_sku, magazine_price, sale_price, is_offer")
      .in("id", ids)
      .not("natura_sku", "is", null);
    if (error) return fail(error, "No pudimos leer los productos.");

    const list = products ?? [];
    if (list.length === 0) return { ok: true, data: [] };

    // Natura rechaza los pedidos desde Vercel: la consulta la hace la función de Supabase,
    // que vuelve a verificar que quien llama es administradora.
    const { data: lookup, error: fnError } = await supabase.functions.invoke<{ results: Record<string, NaturaLookup> }>(
      "precios-natura",
      { body: { skus: list.map((p) => p.natura_sku) } },
    );
    if (fnError || !lookup) {
      console.error("[admin] precios-natura:", fnError?.message);
      return { ok: false, error: "No pudimos consultar los precios de Natura. Probá de nuevo en un rato." };
    }

    const results: NaturaPriceCheck[] = list.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.natura_sku!,
      magazinePrice: Number(p.magazine_price),
      salePrice: Number(p.sale_price),
      isOffer: p.is_offer,
      result: lookup.results[p.natura_sku!] ?? { status: "error", message: "Sin respuesta" },
    }));
    return { ok: true, data: results };
  } catch (e) {
    return fail(e, "No pudimos consultar los precios de Natura.");
  }
}

/** Aplica los precios de revista nuevos que eligió la administradora. */
export async function applyNaturaPrices(
  changes: { id: string; magazinePrice: number }[],
): Promise<ActionResult<{ updated: number }>> {
  try {
    const { supabase } = await assertAdmin();
    const valid = changes
      .filter((c) => UUID_RE.test(c.id) && isValidPrice(c.magazinePrice))
      .slice(0, 1000);
    if (valid.length === 0) return { ok: false, error: "No hay cambios para aplicar." };

    const { data: products, error } = await supabase
      .from("products")
      .select("id, magazine_price, sale_price, is_offer")
      .in("id", valid.map((c) => c.id));
    if (error) return fail(error, "No pudimos leer los productos.");

    const byId = new Map((products ?? []).map((p) => [p.id, p]));
    let updated = 0;
    for (const change of valid) {
      const product = byId.get(change.id);
      if (!product) continue;
      const patch = planMagazinePriceUpdate(product, change.magazinePrice);
      const { error: updateError } = await supabase.from("products").update(patch).eq("id", change.id);
      if (updateError) return fail(updateError, `No pudimos actualizar todos los precios (se aplicaron ${updated}).`);
      updated++;
    }
    refreshCatalog();
    return { ok: true, data: { updated }, message: `Actualizamos ${updated} ${updated === 1 ? "precio" : "precios"}.` };
  } catch (e) {
    return fail(e, "No pudimos aplicar los precios.");
  }
}

/* ------------------------- Acciones en grupo ------------------------- */

const MAX_BULK = 200;

function cleanIds(ids: string[]): string[] {
  return [...new Set(ids)].filter((id) => UUID_RE.test(id)).slice(0, MAX_BULK);
}

/** Publica, pasa a borrador o cambia la categoría de varios productos a la vez. */
export async function bulkUpdateProducts(
  productIds: string[],
  patch: { status?: "draft" | "published"; category_id?: string | null },
): Promise<ActionResult<{ updated: number }>> {
  try {
    const { supabase } = await assertAdmin();
    const ids = cleanIds(productIds);
    if (ids.length === 0) return { ok: false, error: "No elegiste productos." };

    const clean: { status?: "draft" | "published"; category_id?: string | null } = {};
    if (patch.status === "draft" || patch.status === "published") clean.status = patch.status;
    if (patch.category_id === null || (typeof patch.category_id === "string" && UUID_RE.test(patch.category_id))) {
      clean.category_id = patch.category_id;
    }
    if (Object.keys(clean).length === 0) return { ok: false, error: "Nada para actualizar." };

    const { data, error } = await supabase.from("products").update(clean).in("id", ids).select("id");
    if (error) return fail(error, "No pudimos actualizar los productos.");
    refreshCatalog();
    const updated = data?.length ?? 0;
    return { ok: true, data: { updated }, message: `${updated} ${updated === 1 ? "producto actualizado" : "productos actualizados"}.` };
  } catch (e) {
    return fail(e, "No pudimos actualizar los productos.");
  }
}

/** Pone el precio especial de varios productos como la revista menos un % de descuento. */
export async function bulkApplyDiscount(
  productIds: string[],
  percent: number,
): Promise<ActionResult<{ updated: number }>> {
  try {
    const { supabase } = await assertAdmin();
    const ids = cleanIds(productIds);
    if (ids.length === 0) return { ok: false, error: "No elegiste productos." };
    if (!Number.isFinite(percent) || percent < 0 || percent >= 100) {
      return { ok: false, error: "El descuento tiene que ser un número entre 0 y 99." };
    }

    const { data: rows, error: readError } = await supabase
      .from("products")
      .select("id, magazine_price, is_offer")
      .in("id", ids);
    if (readError) return fail(readError, "No pudimos leer los productos.");

    const results = await Promise.all(
      (rows ?? []).map((p) => {
        const sale_price = salePriceFromDiscount(p.magazine_price, percent);
        if (!Number.isFinite(sale_price)) return Promise.resolve({ error: null, skipped: true });
        // Sin descuento no puede seguir marcado como oferta.
        const is_offer = p.is_offer && sale_price < Number(p.magazine_price);
        return supabase
          .from("products")
          .update({ sale_price, is_offer })
          .eq("id", p.id)
          .then(({ error }) => ({ error, skipped: false }));
      }),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return fail(failed.error, "No pudimos actualizar algunos precios.");
    refreshCatalog();
    const updated = results.filter((r) => !r.skipped).length;
    return {
      ok: true,
      data: { updated },
      message: `${updated} ${updated === 1 ? "precio actualizado" : "precios actualizados"} con ${percent}% de descuento.`,
    };
  } catch (e) {
    return fail(e, "No pudimos actualizar los precios.");
  }
}

/** Elimina varios productos con sus fotos. */
export async function bulkDeleteProducts(productIds: string[]): Promise<ActionResult<{ deleted: number }>> {
  try {
    const { supabase } = await assertAdmin();
    const ids = cleanIds(productIds);
    if (ids.length === 0) return { ok: false, error: "No elegiste productos." };

    const { data: images } = await supabase.from("product_images").select("storage_path").in("product_id", ids);
    const { data, error } = await supabase.from("products").delete().in("id", ids).select("id");
    if (error) return fail(error, "No pudimos eliminar los productos.");
    const paths = (images ?? []).map((i) => i.storage_path);
    for (let i = 0; i < paths.length; i += 100) {
      const { error: storageError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths.slice(i, i + 100));
      if (storageError) console.error("[admin] Fotos huérfanas:", storageError.message);
    }
    refreshCatalog();
    const deleted = data?.length ?? 0;
    return { ok: true, data: { deleted }, message: `${deleted} ${deleted === 1 ? "producto eliminado" : "productos eliminados"}.` };
  } catch (e) {
    return fail(e, "No pudimos eliminar los productos.");
  }
}

/* ---------------------------- Vencimientos ---------------------------- */

export type LotProductOption = { id: string; name: string; size: string | null; image: string | null };

/** Productos (publicados o borradores) para el buscador de la carga de vencimientos. */
export async function searchProductsForLots(q: string): Promise<LotProductOption[]> {
  try {
    const { supabase } = await assertAdmin();
    const patterns = nameSearchPatterns(String(q).slice(0, 80));
    if (patterns.length === 0) return [];
    let query = supabase.from("products").select("id, name, size, images:product_images(storage_path, position)");
    for (const pattern of patterns) query = query.filter("name", "imatch", pattern);
    const { data } = await query.order("status", { ascending: false }).order("name").limit(8);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      size: p.size,
      image: [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null,
    }));
  } catch {
    return [];
  }
}

/** Carga un lote: producto, vencimiento como en el envase ("01/29") y cantidad. */
export async function addProductLot(productId: string, expiry: string, quantity: number): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(productId)) return { ok: false, error: "Elegí un producto de la lista." };
    const expiresOn = parseExpiry(String(expiry));
    if (!expiresOn) return { ok: false, error: "Escribí el vencimiento como en el envase, por ejemplo 01/29." };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return { ok: false, error: "La cantidad tiene que ser un número entero, 1 o más." };
    }
    // Si ya hay un lote del mismo producto con el mismo vencimiento, se suman las unidades.
    const { data: existing } = await supabase
      .from("product_lots")
      .select("id, quantity")
      .eq("product_id", productId)
      .eq("expires_on", expiresOn)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("product_lots").update({ quantity: Math.min(existing.quantity + quantity, 10000) }).eq("id", existing.id)
      : await supabase.from("product_lots").insert({ product_id: productId, expires_on: expiresOn, quantity });
    if (error) return fail(error, "No pudimos guardar el vencimiento.");
    revalidatePath("/admin/vencimientos");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e, "No pudimos guardar el vencimiento.");
  }
}

/** Resta (o suma) unidades de un lote; si llega a 0 se borra. */
export async function changeLotQuantity(lotId: string, delta: number): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(lotId) || !Number.isInteger(delta) || delta === 0) return { ok: false, error: "Datos inválidos." };
    const { data: lot } = await supabase.from("product_lots").select("quantity").eq("id", lotId).maybeSingle();
    if (!lot) return { ok: false, error: "Ese lote ya no existe." };
    const next = lot.quantity + delta;
    const { error } =
      next <= 0
        ? await supabase.from("product_lots").delete().eq("id", lotId)
        : await supabase.from("product_lots").update({ quantity: Math.min(next, 10000) }).eq("id", lotId);
    if (error) return fail(error, "No pudimos actualizar el lote.");
    revalidatePath("/admin/vencimientos");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e, "No pudimos actualizar el lote.");
  }
}

/** Borra un lote ("ya no lo tengo"). */
export async function deleteLot(lotId: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(lotId)) return { ok: false, error: "Datos inválidos." };
    const { error } = await supabase.from("product_lots").delete().eq("id", lotId);
    if (error) return fail(error, "No pudimos borrar el lote.");
    revalidatePath("/admin/vencimientos");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e, "No pudimos borrar el lote.");
  }
}

/* ----------------------------- Inventario ----------------------------- */

/**
 * Guarda el stock desde la pantalla de Inventario. Si `publishIfStock` está activo y el
 * producto queda con stock, se publica (los que quedan en 0 no cambian de estado).
 */
export async function setInventoryStock(
  productId: string,
  stock: number,
  publishIfStock: boolean,
): Promise<ActionResult<{ status: "draft" | "published" }>> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(productId)) return { ok: false, error: "Datos inválidos." };
    if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) {
      return { ok: false, error: "La cantidad tiene que ser un número entero, 0 o más." };
    }
    const patch: { stock: number; status?: "published" } = { stock };
    if (publishIfStock && stock > 0) patch.status = "published";
    const { data, error } = await supabase.from("products").update(patch).eq("id", productId).select("status").single();
    if (error) return fail(error, "No pudimos guardar la cantidad.");
    refreshCatalog();
    return { ok: true, data: { status: data.status === "published" ? "published" : "draft" } };
  } catch (e) {
    return fail(e, "No pudimos guardar la cantidad.");
  }
}

/** Guarda el alias / CBU para que las clientas paguen por transferencia (sin comisión). */
export async function saveTransferSettings(input: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const parsed = transferSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Revisá los campos marcados.", fields: fieldErrors(parsed.error) };
    }
    const d = parsed.data;
    const { error } = await supabase
      .from("store_settings")
      .update({
        transfer_alias: d.alias,
        transfer_cbu: d.cbu,
        transfer_holder: d.holder,
        transfer_bank: d.bank,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) return fail(error, "No pudimos guardar los datos.");
    refreshCatalog();
    return {
      ok: true,
      message: d.alias || d.cbu ? "Listo: las clientas ya pueden elegir Transferencia." : "Transferencia desactivada.",
    };
  } catch (e) {
    return fail(e, "No pudimos guardar los datos.");
  }
}

/** % de recargo que se le suma a la clienta si paga con Mercado Pago. */
export async function saveMercadoPagoSurcharge(percent: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const parsed = surchargeSchema.safeParse(typeof percent === "string" ? percent.replace(",", ".") : percent);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Número inválido." };
    const { error } = await supabase
      .from("store_settings")
      .update({ mp_surcharge_percent: parsed.data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return fail(error, "No pudimos guardar el recargo.");
    refreshCatalog();
    return {
      ok: true,
      message: parsed.data > 0 ? `Listo: con Mercado Pago se suma ${parsed.data}%.` : "Mercado Pago sin recargo.",
    };
  } catch (e) {
    return fail(e, "No pudimos guardar el recargo.");
  }
}

/* ------------------------------ Venta rápida ------------------------------ */

export type SaleProductOption = {
  id: string;
  name: string;
  size: string | null;
  image: string | null;
  salePrice: number;
  stock: number;
};

/** Búsqueda para la venta rápida: incluye borradores (en los vivos se vende de todo). */
export async function searchProductsForSale(q: string): Promise<SaleProductOption[]> {
  try {
    const { supabase } = await assertAdmin();
    const patterns = nameSearchPatterns(String(q).slice(0, 80));
    if (patterns.length === 0) return [];
    let query = supabase
      .from("products")
      .select("id, name, size, sale_price, stock, images:product_images(storage_path, position)");
    for (const pattern of patterns) query = query.filter("name", "imatch", pattern);
    const { data } = await query.order("stock", { ascending: false }).order("name").limit(10);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      size: p.size,
      image: [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null,
      salePrice: toCents(p.sale_price) / 100,
      stock: p.stock,
    }));
  } catch {
    return [];
  }
}

export type ManualSaleInput = {
  items: { productId: string; quantity: number; unitPrice: number }[];
  customerName?: string;
  customerPhone?: string;
  channel: "facebook" | "presencial" | "whatsapp" | "otro";
  paymentMethod: "efectivo" | "transferencia";
  amountPaid: number;
  paymentNote?: string;
  delivered: boolean;
};

const SALE_CHANNELS = ["facebook", "presencial", "whatsapp", "otro"] as const;

/**
 * Registra una venta hecha por fuera de la tienda (vivo de Facebook, en persona…).
 * Queda como pedido confirmado (o entregado) y descuenta stock y vencimientos.
 */
export async function registerManualSale(input: ManualSaleInput): Promise<ActionResult<{ code: string }>> {
  try {
    const { supabase } = await assertAdmin();
    const admin = createAdminClient();
    if (!admin) return { ok: false, error: "Falta configurar la clave secreta de la base (SUPABASE_SECRET_KEY)." };

    const lines = new Map<string, { quantity: number; unitCents: number }>();
    for (const it of Array.isArray(input?.items) ? input.items.slice(0, 50) : []) {
      const qty = Number(it?.quantity);
      const unitCents = toCents(it?.unitPrice);
      if (!UUID_RE.test(String(it?.productId)) || !Number.isInteger(qty) || qty < 1 || qty > 1000) continue;
      if (!Number.isFinite(unitCents) || unitCents <= 0 || unitCents > 10_000_000_000) {
        return { ok: false, error: "Revisá los precios: tienen que ser mayores a cero." };
      }
      const prev = lines.get(it.productId);
      lines.set(it.productId, { quantity: (prev?.quantity ?? 0) + qty, unitCents });
    }
    if (lines.size === 0) return { ok: false, error: "Agregá al menos un producto." };
    const channel = SALE_CHANNELS.includes(input.channel) ? input.channel : "otro";
    const method = input.paymentMethod === "transferencia" ? "transferencia" : "efectivo";

    const { data: products, error: readError } = await supabase
      .from("products")
      .select("id, name, size, magazine_price")
      .in("id", [...lines.keys()]);
    if (readError) return fail(readError, "No pudimos leer los productos.");
    if (!products || products.length !== lines.size) return { ok: false, error: "Algún producto ya no existe." };

    let totalCents = 0;
    let savingsCents = 0;
    const items = products.map((p) => {
      const l = lines.get(p.id)!;
      const magCents = toCents(p.magazine_price);
      totalCents += l.unitCents * l.quantity;
      savingsCents += Math.max(magCents - l.unitCents, 0) * l.quantity;
      return {
        product_id: p.id,
        name: p.name,
        size: p.size,
        quantity: l.quantity,
        unit_price: l.unitCents / 100,
        magazine_price: magCents / 100,
      };
    });

    const paidCents = Math.min(Math.max(toCents(input.amountPaid) || 0, 0), totalCents);
    const complete = paidCents >= totalCents;
    const { data: order, error: insertError } = await admin
      .from("orders")
      .insert({
        customer_name: input.customerName?.trim().slice(0, 80) || null,
        customer_phone: toWhatsAppPhone(input.customerPhone),
        total: totalCents / 100,
        savings: savingsCents / 100,
        channel,
        payment_method: method,
        amount_paid: paidCents / 100,
        payment_status: complete ? "approved" : null,
        paid_at: complete ? new Date().toISOString() : null,
        payment_note: complete ? null : input.paymentNote?.trim().slice(0, 120) || null,
      })
      .select("id, code")
      .single();
    if (insertError || !order) return fail(insertError, "No pudimos registrar la venta.");

    const { error: itemsError } = await admin.from("order_items").insert(items.map((i) => ({ ...i, order_id: order.id })));
    // Descuenta stock y vencimientos (el que vence antes primero), igual que al confirmar un pedido.
    const { error: statusError } = itemsError
      ? { error: itemsError }
      : await supabase.rpc("set_order_status", { order_id: order.id, new_status: input.delivered ? "delivered" : "confirmed" });
    if (statusError) {
      await admin.from("orders").delete().eq("id", order.id);
      return fail(statusError, "No pudimos registrar la venta.");
    }

    refreshCatalog();
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ventas");
    return { ok: true, data: { code: order.code }, message: `Venta ${order.code} registrada. Ya descontamos el stock.` };
  } catch (e) {
    return fail(e, "No pudimos registrar la venta.");
  }
}

/* ----------------------- Deudas y avisos de reposición ----------------------- */

/** Guarda el WhatsApp de una clienta en sus pedidos (para mandarle recordatorios). */
export async function setCustomerPhone(orderIds: string[], phone: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const ids = [...new Set(orderIds)].filter((id) => UUID_RE.test(id)).slice(0, 200);
    const normalized = toWhatsAppPhone(phone);
    if (!normalized) return { ok: false, error: "Escribí el celular con código de área, por ejemplo 11 2345-6789." };
    if (ids.length === 0) return { ok: false, error: "No hay pedidos." };
    const { error } = await supabase.from("orders").update({ customer_phone: normalized }).in("id", ids);
    if (error) return fail(error, "No pudimos guardar el teléfono.");
    revalidatePath("/admin/deudas");
    return { ok: true, message: "WhatsApp guardado." };
  } catch (e) {
    return fail(e, "No pudimos guardar el teléfono.");
  }
}

/** Marca que ya se le avisó a la clienta que el producto volvió. */
export async function markRestockNotified(requestId: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(requestId)) return { ok: false, error: "Datos inválidos." };
    const { error } = await supabase
      .from("restock_requests")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error) return fail(error, "No pudimos actualizar el aviso.");
    revalidatePath("/admin/avisos");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e, "No pudimos actualizar el aviso.");
  }
}

/** Borra un pedido de aviso (por ejemplo, si la clienta ya no lo quiere). */
export async function deleteRestockRequest(requestId: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(requestId)) return { ok: false, error: "Datos inválidos." };
    const { error } = await supabase.from("restock_requests").delete().eq("id", requestId);
    if (error) return fail(error, "No pudimos borrar el aviso.");
    revalidatePath("/admin/avisos");
    revalidatePath("/admin");
    return { ok: true, message: "Aviso borrado." };
  } catch (e) {
    return fail(e, "No pudimos borrar el aviso.");
  }
}

/* ------------------------- Boleta de Natura (foto) ------------------------- */

export type ReceiptMatch = { id: string; name: string; size: string | null; stock: number; image: string | null; status: string };
export type ReceiptLine = {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  match: ReceiptMatch | null;
};

const RECEIPT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_RECEIPT_PHOTOS = 3;

/** Lo que se espera de la respuesta (se valida antes de usarla). */
const ReceiptSchema = z.object({
  items: z.array(
    z.object({
      code: z.string().catch(""),
      description: z.string(),
      quantity: z.number(),
      unit_price: z.number().nullable().catch(null),
    }),
  ),
});

/** El mismo formato en JSON Schema simple, para pedírselo a Gemini. */
const RECEIPT_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          code: { type: "string", description: "Código de producto de Natura tal como figura (solo números). Vacío si no hay." },
          description: { type: "string", description: "Descripción del producto tal como figura en la boleta." },
          quantity: { type: "integer", description: "Cantidad de unidades." },
          unit_price: { type: ["number", "null"], description: "Precio de lista (revista) por unidad, sin descuentos. Null si no figura." },
        },
        required: ["code", "description", "quantity", "unit_price"],
      },
    },
  },
  required: ["items"],
};

/**
 * Modelos de Google que leen la boleta (con uso gratis), en orden. Si el primero está saturado
 * se prueba con el de repuesto. El principal se puede cambiar con GEMINI_MODEL.
 */
const RECEIPT_MODELS = [process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-flash-lite-latest"];

const RECEIPT_PROMPT = `Estas fotos son de una boleta, factura o remito de un pedido de Natura (Argentina) hecho por una consultora. Si hay varias fotos son partes de la misma boleta.
Extraé cada renglón que sea un producto (perfumes, cremas, maquillaje, kits, repuestos, etc.):
- code: el código de producto de Natura (normalmente de 4 a 6 números). Vacío si no se ve.
- description: la descripción tal como está escrita.
- quantity: cuántas unidades llegaron de ese producto.
- unit_price: el precio de lista o de revista por unidad (antes de descuentos), si figura; si no, null.
No incluyas totales, subtotales, impuestos, envío, descuentos, puntos, folletos ni revistas. Si un renglón está borroso, igual incluilo con lo que se pueda leer; no inventes renglones.`;

/** Lee la foto de la boleta con la inteligencia artificial de Google (Gemini) y la cruza con los productos de la tienda. */
export async function readReceipt(formData: FormData): Promise<ActionResult<ReceiptLine[]>> {
  try {
    const { supabase } = await assertAdmin();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Falta activar la lectura de boletas (clave de Google). Pedile a quien te armó la página que la configure." };
    }
    const files = formData.getAll("foto").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { ok: false, error: "Sacá o elegí una foto de la boleta." };
    if (files.length > MAX_RECEIPT_PHOTOS) return { ok: false, error: `Podés subir hasta ${MAX_RECEIPT_PHOTOS} fotos por boleta.` };

    const images: Part[] = [];
    for (const file of files) {
      const type = RECEIPT_IMAGE_TYPES.find((t) => t === file.type);
      if (!type || file.size > 4_000_000) return { ok: false, error: "La foto tiene que ser JPG, PNG o WEBP de menos de 4 MB." };
      images.push(createPartFromBase64(Buffer.from(await file.arrayBuffer()).toString("base64"), type));
    }

    const ai = new GoogleGenAI({ apiKey });
    const ask = (model: string) =>
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [...images, { text: RECEIPT_PROMPT }] }],
        config: { responseMimeType: "application/json", responseJsonSchema: RECEIPT_JSON_SCHEMA },
      });
    let response;
    try {
      response = await ask(RECEIPT_MODELS[0]);
    } catch (e) {
      // Saturado o con límite: se prueba una vez con el modelo de repuesto.
      if (!(e instanceof ApiError) || ![429, 500, 503, 504].includes(e.status)) throw e;
      console.warn("[admin] readReceipt: modelo principal no disponible, uso el de repuesto", e.status);
      response = await ask(RECEIPT_MODELS[1]);
    }
    let parsed: z.infer<typeof ReceiptSchema> | null = null;
    try {
      const result = ReceiptSchema.safeParse(JSON.parse(response.text ?? ""));
      if (result.success) parsed = result.data;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      return { ok: false, error: "No pudimos leer la boleta. Probá con otra foto, con más luz y derecha." };
    }

    const items = mergeReceiptItems(
      parsed.items.map((i) => ({ code: i.code, description: i.description, quantity: i.quantity, unitPrice: i.unit_price })),
    );
    if (items.length === 0) return { ok: false, error: "No encontramos productos en la foto. Probá con otra, que se vea toda la lista." };

    // Cruce por código de Natura.
    const keys = [...new Set(items.map((i) => codeKey(i.code)).filter((k): k is string => k !== null))];
    const bySku = new Map<string, ReceiptMatch>();
    if (keys.length > 0) {
      const { data } = await supabase
        .from("products")
        .select("id, name, size, stock, status, natura_sku, images:product_images(storage_path, position)")
        .in("natura_sku", keys.flatMap(skuVariants));
      for (const p of data ?? []) {
        const key = codeKey(p.natura_sku);
        if (!key || bySku.has(key)) continue;
        bySku.set(key, {
          id: p.id,
          name: p.name,
          size: p.size,
          stock: p.stock,
          status: p.status,
          image: [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null,
        });
      }
    }

    return {
      ok: true,
      data: items.map((i) => ({ ...i, match: bySku.get(codeKey(i.code) ?? "") ?? null })),
    };
  } catch (e) {
    if (e instanceof ApiError) {
      console.error("[admin] readReceipt:", e.status, e.message);
      if (e.status === 401 || e.status === 403 || (e.status === 400 && /api key/i.test(e.message))) {
        return { ok: false, error: "La clave de Google no es válida. Hay que revisarla en la configuración de Vercel." };
      }
      if (e.status === 429) {
        return { ok: false, error: "Se usó mucho el lector gratis en poco tiempo. Probá de nuevo en un rato." };
      }
      return { ok: false, error: "El lector de boletas no respondió. Probá de nuevo en un minuto." };
    }
    return fail(e, "No pudimos leer la boleta.");
  }
}

export type ReceiptApplyInput = {
  lines: (
    | { kind: "existing"; productId: string; quantity: number }
    | { kind: "new"; name: string; code: string; price: number; quantity: number }
  )[];
  publish: boolean;
};

/** Suma al stock lo confirmado de la boleta y crea (como borrador) los productos que no estaban. */
export async function applyReceipt(
  input: ReceiptApplyInput,
): Promise<ActionResult<{ units: number; updated: number; created: { id: string; name: string }[] }>> {
  try {
    const { supabase } = await assertAdmin();
    const lines = Array.isArray(input?.lines) ? input.lines.slice(0, 200) : [];

    const adds = new Map<string, number>();
    const news: { name: string; sku: string | null; price: number; quantity: number }[] = [];
    for (const l of lines) {
      const qty = Number(l?.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 1000) return { ok: false, error: "Revisá las cantidades: tienen que ser 1 o más." };
      if (l.kind === "existing") {
        if (!UUID_RE.test(String(l.productId))) return { ok: false, error: "Hay un producto inválido en la lista." };
        adds.set(l.productId, (adds.get(l.productId) ?? 0) + qty);
      } else if (l.kind === "new") {
        const name = String(l.name ?? "").trim().replace(/\s+/g, " ");
        if (name.length < 2 || name.length > 120) return { ok: false, error: "Poné un nombre (de 2 a 120 letras) a cada producto nuevo." };
        if (!isValidPrice(l.price)) return { ok: false, error: `Poné el precio de revista de «${name}».` };
        news.push({ name, sku: skuFromCode(l.code), price: toCents(l.price) / 100, quantity: qty });
      }
    }
    if (adds.size === 0 && news.length === 0) return { ok: false, error: "La lista está vacía." };

    let updated = 0;
    let units = 0;
    if (adds.size > 0) {
      const { data: current, error } = await supabase.from("products").select("id, stock, status").in("id", [...adds.keys()]);
      if (error) return fail(error, "No pudimos leer los productos.");
      for (const p of current ?? []) {
        const qty = adds.get(p.id) ?? 0;
        const patch: { stock: number; status?: "published" } = { stock: Math.min(p.stock + qty, 100_000) };
        if (input.publish && p.status !== "published") patch.status = "published";
        const { error: upError } = await supabase.from("products").update(patch).eq("id", p.id);
        if (upError) {
          refreshCatalog();
          return fail(upError, `Se cargaron ${updated} productos y después hubo un error. Revisá el stock antes de volver a confirmar.`);
        }
        updated++;
        units += qty;
      }
    }

    const created: { id: string; name: string }[] = [];
    for (const n of news) {
      const base = slugify(n.name) || "producto";
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: n.name,
          slug: `${base.slice(0, 120)}-${Math.random().toString(36).slice(2, 7)}`,
          natura_sku: n.sku,
          magazine_price: n.price,
          sale_price: n.price,
          stock: n.quantity,
          status: "draft",
        })
        .select("id, name")
        .single();
      if (error) {
        refreshCatalog();
        const res = fail(error, "No pudimos crear un producto nuevo.");
        return {
          ok: false,
          error: `Se sumó el stock de ${updated} productos y se crearon ${created.length} nuevos, pero «${n.name}» dio error: ${res.ok ? "" : res.error}`,
        };
      }
      created.push(data);
      units += n.quantity;
    }

    refreshCatalog();
    revalidatePath("/admin");
    return { ok: true, data: { units, updated, created } };
  } catch (e) {
    return fail(e, "No pudimos cargar la boleta.");
  }
}
