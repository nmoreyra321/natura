"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdmin, UnauthorizedError } from "@/lib/auth";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/config";
import { isValidProductImagePath, MAX_IMAGES_PER_PRODUCT } from "@/lib/images";
import { fetchNaturaMagazinePrice, type NaturaLookup } from "@/lib/natura";
import { isValidPrice, planMagazinePriceUpdate } from "@/lib/pricing";
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

    const results: NaturaPriceCheck[] = [];
    // De a 4 consultas a la vez, para no saturar el sitio de Natura.
    const queue = [...(products ?? [])];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let p = queue.shift(); p; p = queue.shift()) {
          results.push({
            id: p.id,
            name: p.name,
            sku: p.natura_sku!,
            magazinePrice: Number(p.magazine_price),
            salePrice: Number(p.sale_price),
            isOffer: p.is_offer,
            result: await fetchNaturaMagazinePrice(p.natura_sku!),
          });
        }
      }),
    );
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
