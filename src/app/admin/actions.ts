"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdmin, UnauthorizedError } from "@/lib/auth";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/config";
import { isValidProductImagePath, MAX_IMAGES_PER_PRODUCT } from "@/lib/images";
import type { NaturaLookup } from "@/lib/natura";
import { parseExpiry } from "@/lib/lots";
import { isValidPrice, planMagazinePriceUpdate, salePriceFromDiscount } from "@/lib/pricing";
import { nameSearchPatterns } from "@/lib/search";
import { slugify } from "@/lib/slug";
import { createSessionClient, CATALOG_TAG } from "@/lib/supabase/server";
import { categorySchema, fieldErrors, loginSchema, productSchema } from "@/lib/validation";

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
    for (const pattern of patterns) query = query.ilike("name", pattern);
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
