"use server";

import { ApiError, createPartFromBase64, GoogleGenAI, type Part } from "@google/genai";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdmin, UnauthorizedError, type AdminContext } from "@/lib/auth";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/config";
import { isValidProductImagePath, MAX_IMAGES_PER_PRODUCT } from "@/lib/images";
import { BLOCKED_MESSAGE, downloadRemoteImage, RemoteImageError, type RemoteImage } from "@/lib/remote-image";
import type { NaturaLookup } from "@/lib/natura";
import { parseExpiry } from "@/lib/lots";
import { toWhatsAppPhone } from "@/lib/debts";
import { campaignSlug } from "@/lib/campaigns";
import { guessGender } from "@/lib/gender";
import { getLoyaltyMinTotal } from "@/lib/store-settings";
import { notifyAdmins } from "@/lib/push";
import { formatARS } from "@/lib/format";
import { loyaltyStatus, PURCHASE_STATUSES } from "@/lib/loyalty";
import { recommendedPercent, summarizeMpFees } from "@/lib/mp-fees";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPrice, planMagazinePriceUpdate, salePriceFromDiscount, toCents } from "@/lib/pricing";
import { aliasKey, cleanInvoiceNumber, codeKey, mergeReceiptItems, parseArDate, skuFromCode } from "@/lib/receipt";
import { nameSearchPatterns } from "@/lib/search";
import { allowRequest } from "@/lib/rate-limit";
import { slugify } from "@/lib/slug";
import { createSessionClient, CATALOG_TAG } from "@/lib/supabase/server";
import {
  categorySchema,
  fieldErrors,
  loginSchema,
  parseMoney,
  productSchema,
  socialLinksSchema,
  surchargeSchema,
  transferSettingsSchema,
} from "@/lib/validation";

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
  if (code === "23505") return { ok: false, error: "Ya hay otro producto o categoría con ese nombre de dirección.", fields: { slug: "Esta URL ya está en uso." } };
  if (code === "23514") return { ok: false, error: "Revisá los precios, el stock y la oferta: algún número no es válido." };
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
  if (!supabase) return { ok: false, error: "El panel todavía no está conectado. Avisale a quien armó la página." };
  // Freno contra quien prueba contraseñas: 10 intentos cada 15 minutos por conexión.
  if (!(await allowRequest("login", 10, 900))) {
    return { ok: false, error: "Probaste muchas veces. Esperá 15 minutos y volvé a intentar." };
  }

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
    if (!slug) return { ok: false, error: "No pudimos generar la dirección.", fields: { slug: "Escribí una dirección válida." } };

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

/**
 * Crear un producto al vuelo (desde «Cargar caja de Natura» o «Stock») cuando no está en la tienda.
 * Queda como borrador con el stock que llegó; se publica cuando se le agrega la foto.
 */
export async function quickCreateProduct(input: {
  name: string;
  magazinePrice: string;
  salePrice: string;
  categoryId: string;
  stock: number;
}): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const { supabase } = await assertAdmin();
    const name = String(input?.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 120) return { ok: false, error: "Escribí el nombre del producto (de 2 a 120 letras)." };
    const magazine = parseMoney(String(input?.magazinePrice ?? ""));
    if (!isValidPrice(magazine)) return { ok: false, error: "Escribí el precio de revista." };
    const sale = String(input?.salePrice ?? "").trim() ? parseMoney(String(input.salePrice)) : magazine;
    if (!isValidPrice(sale)) return { ok: false, error: "Revisá tu precio de venta." };
    if (sale > magazine) return { ok: false, error: "Tu precio no puede ser mayor que el de revista." };
    const stock = Number(input?.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 10_000) return { ok: false, error: "Revisá la cantidad." };
    const categoryId = UUID_RE.test(String(input?.categoryId ?? "")) ? String(input.categoryId) : null;
    const base = slugify(name) || "producto";
    const { data, error } = await supabase
      .from("products")
      .insert({
        name,
        slug: `${base.slice(0, 120)}-${Math.random().toString(36).slice(2, 7)}`,
        magazine_price: magazine,
        sale_price: sale,
        stock,
        category_id: categoryId,
        status: "draft",
        gender: guessGender(name),
      })
      .select("id, name")
      .single();
    if (error) return fail(error, "No pudimos crear el producto.");
    refreshCatalog();
    return { ok: true, data, message: "Producto creado." };
  } catch (e) {
    return fail(e, "No pudimos crear el producto.");
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
    if (Object.keys(clean).length === 0) return { ok: false, error: "No hay cambios para guardar." };

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

/** Agrega una foto bajándola desde cualquier enlace (de la foto misma o de una página que la tenga). */
export async function addProductImageFromUrl(productId: string, link: string): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(String(productId))) return { ok: false, error: "Producto inválido." };
    const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
    if ((count ?? 0) >= MAX_IMAGES_PER_PRODUCT) return { ok: false, error: `Cada producto puede tener hasta ${MAX_IMAGES_PER_PRODUCT} fotos.` };

    let image: RemoteImage;
    try {
      image = await downloadRemoteImage(String(link ?? ""));
    } catch (e) {
      if (!(e instanceof RemoteImageError) || !e.blocked) throw e;
      // La página no deja que Vercel la lea: se prueba desde Supabase, que a veces sí puede.
      const { data } = await supabase.functions.invoke<{ status: string; image?: string }>("imagen-de-pagina", { body: { url: String(link) } });
      if (!data?.image) throw e;
      try {
        image = await downloadRemoteImage(data.image);
      } catch {
        throw new RemoteImageError(BLOCKED_MESSAGE, true);
      }
    }
    const path = `products/${productId}/${crypto.randomUUID()}.${image.ext}`;
    const { error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(path, image.bytes, { contentType: image.type, cacheControl: "31536000", upsert: false });
    if (error) return fail(error, "No pudimos guardar la foto.");
    return await addProductImage(productId, path);
  } catch (e) {
    if (e instanceof RemoteImageError) return { ok: false, error: e.message };
    return fail(e, "No pudimos traer la foto de ese enlace.");
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
    const owedCents = totalCents - toCents(order.amount_paid);
    if (toCents(amount) > owedCents) {
      return { ok: false, error: `Ese monto es mayor a lo que falta cobrar (${formatARS(Math.max(owedCents, 0))}).` };
    }
    const paidCents = toCents(order.amount_paid) + toCents(amount);
    const complete = paidCents >= totalCents;
    const { error } = await supabase
      .from("orders")
      .update({
        amount_paid: paidCents / 100,
        payment_status: complete ? "approved" : null,
        paid_at: complete ? new Date().toISOString() : null,
        payment_note: complete ? null : note?.trim().slice(0, 120) || null,
        // Anotar un pago cuenta como revisar el aviso de la clienta.
        payment_reported_at: null,
        payment_rejection: null,
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

/**
 * Aprueba la transferencia que avisó la clienta: el pedido queda pagado por completo y,
 * si estaba pendiente, se confirma (se descuenta el stock).
 */
export async function approveTransferPayment(orderId: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(orderId)) return { ok: false, error: "Datos inválidos." };
    const { data: order, error: readError } = await supabase
      .from("orders")
      .select("total, status, payment_method")
      .eq("id", orderId)
      .maybeSingle();
    if (readError) return fail(readError, "No pudimos leer el pedido.");
    if (!order || order.payment_method !== "transferencia" || order.status === "cancelled") {
      return { ok: false, error: "No encontramos ese pedido." };
    }
    const { error } = await supabase
      .from("orders")
      .update({
        amount_paid: toCents(order.total) / 100,
        payment_status: "approved",
        paid_at: new Date().toISOString(),
        payment_note: null,
        payment_reported_at: null,
        payment_rejection: null,
      })
      .eq("id", orderId);
    if (error) return fail(error, "No pudimos aprobar el pago.");
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin");
    revalidatePath(`/pedido/${orderId}`);
    if (order.status === "pending") {
      const { error: confirmError } = await supabase.rpc("set_order_status", { order_id: orderId, new_status: "confirmed" });
      if (confirmError) {
        console.error("[pagos] Pago aprobado pero no se pudo confirmar el pedido:", confirmError.message);
        // Se deshace la aprobación para que la clienta no vea «Pago confirmado» con el pedido sin confirmar.
        await supabase
          .from("orders")
          .update({ amount_paid: 0, payment_status: null, paid_at: null })
          .eq("id", orderId);
        return fail(confirmError, "No pudimos confirmar el pedido. Probá de nuevo en un rato.");
      }
      refreshCatalog();
      return { ok: true, message: "Pago aprobado y pedido confirmado (se descontó el stock)." };
    }
    return { ok: true, message: "Pago aprobado." };
  } catch (e) {
    return fail(e, "No pudimos aprobar el pago.");
  }
}

/** No se encontró la transferencia: la clienta ve el motivo en la página de su pedido y puede volver a avisar. */
export async function rejectTransferPayment(orderId: string, reason: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const why = reason.trim().slice(0, 200);
    if (!UUID_RE.test(orderId) || why.length < 3) return { ok: false, error: "Escribí el motivo." };
    const { data, error } = await supabase
      .from("orders")
      .update({ payment_reported_at: null, payment_rejection: why })
      .eq("id", orderId)
      .eq("payment_method", "transferencia")
      .select("id");
    if (error) return fail(error, "No pudimos guardar.");
    if (!data?.length) return { ok: false, error: "No encontramos ese pedido." };
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin");
    revalidatePath(`/pedido/${orderId}`);
    return { ok: true, message: "Listo: la clienta va a ver en su pedido que el pago no llegó." };
  } catch (e) {
    return fail(e, "No pudimos guardar.");
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
      .select("id, payment_proof_path");
    if (error) return fail(error, "No pudimos borrar los pedidos.");
    const proofs = (data ?? []).map((o) => o.payment_proof_path).filter((p): p is string => Boolean(p));
    if (proofs.length > 0) await supabase.storage.from("payment-proofs").remove(proofs);
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

export type DeleteKind = "orders" | "restock" | "lots" | "receipts";

/**
 * Borra varios registros elegidos en el panel (con doble confirmación en pantalla).
 * - orders: si el pedido había descontado stock, primero se cancela (devuelve stock y vencimientos)
 *   y después se borra con sus productos y su comprobante.
 * - restock: avisos de «Avisame cuando vuelva».
 * - lots: vencimientos anotados (no cambia el stock).
 * - receipts: facturas del historial (no cambia el stock que ya se sumó).
 */
export async function deleteSelected(kind: DeleteKind, rawIds: string[]): Promise<ActionResult<{ deleted: number }>> {
  try {
    const { supabase } = await assertAdmin();
    const ids = [...new Set(Array.isArray(rawIds) ? rawIds : [])].filter((id) => UUID_RE.test(String(id))).slice(0, 500);
    if (ids.length === 0) return { ok: false, error: "No elegiste nada para borrar." };
    let deleted = 0;

    if (kind === "orders") {
      const { data: orders, error: readError } = await supabase
        .from("orders")
        .select("id, status, stock_applied, payment_proof_path")
        .in("id", ids);
      if (readError) return fail(readError, "No pudimos leer los pedidos.");
      for (const o of orders ?? []) {
        // Un pedido entregado ya está en manos de la clienta: se borra sin devolver stock.
        // Uno confirmado (no entregado) se cancela primero para que los productos vuelvan al stock.
        if (o.status !== "delivered" && (o.status !== "cancelled" || o.stock_applied)) {
          const { error } = await supabase.rpc("set_order_status", { order_id: o.id, new_status: "cancelled" });
          if (error) return fail(error, `No pudimos devolver el stock de un pedido. Se borraron ${deleted}.`);
        }
        const { error } = await supabase.from("orders").delete().eq("id", o.id);
        if (error) return fail(error, `No pudimos borrar un pedido. Se borraron ${deleted}.`);
        deleted++;
      }
      const proofs = (orders ?? []).map((o) => o.payment_proof_path).filter((p): p is string => Boolean(p));
      if (proofs.length > 0) await supabase.storage.from("payment-proofs").remove(proofs);
      refreshCatalog();
      for (const path of ["/admin/pedidos", "/admin/deudas", "/admin/ventas", "/admin", "/admin/vencimientos"]) revalidatePath(path);
    } else {
      const table = kind === "restock" ? "restock_requests" : kind === "lots" ? "product_lots" : kind === "receipts" ? "receipts" : null;
      if (!table) return { ok: false, error: "Datos inválidos." };
      const { data, error } = await supabase.from(table).delete().in("id", ids).select("id");
      if (error) return fail(error, "No pudimos borrar.");
      deleted = data?.length ?? 0;
      const path = { restock: "/admin/avisos", lots: "/admin/vencimientos", receipts: "/admin/productos" }[kind];
      revalidatePath(path);
      revalidatePath("/admin");
    }
    return { ok: true, data: { deleted }, message: `Listo: se ${deleted === 1 ? "borró 1" : `borraron ${deleted}`}.` };
  } catch (e) {
    return fail(e, "No pudimos borrar.");
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
    if (Object.keys(clean).length === 0) return { ok: false, error: "No hay cambios para guardar." };

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

/** Suma unidades a un lote (producto + vencimiento); si no existe, lo crea. Devuelve el error, si hubo. */
async function addLot(supabase: AdminContext["supabase"], productId: string, expiresOn: string, quantity: number) {
  const { data: existing } = await supabase
    .from("product_lots")
    .select("id, quantity")
    .eq("product_id", productId)
    .eq("expires_on", expiresOn)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("product_lots").update({ quantity: Math.min(existing.quantity + quantity, 10000) }).eq("id", existing.id)
    : await supabase.from("product_lots").insert({ product_id: productId, expires_on: expiresOn, quantity });
  return error;
}

/**
 * «Cargar caja de Natura», a mano: suma unidades al stock y, si se escribe el vencimiento,
 * las anota en ese lote. Si el producto era borrador y `publish` está activo, se publica.
 */
export async function receiveStock(
  productId: string,
  quantity: number,
  expiry: string,
  publish: boolean,
): Promise<ActionResult<{ stock: number }>> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(productId)) return { ok: false, error: "Elegí un producto de la lista." };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return { ok: false, error: "La cantidad tiene que ser un número entero, 1 o más." };
    }
    const expiresOn = String(expiry ?? "").trim() ? parseExpiry(String(expiry)) : null;
    if (String(expiry ?? "").trim() && !expiresOn) {
      return { ok: false, error: "Escribí el vencimiento como en el envase, por ejemplo 01/29 (o dejalo vacío)." };
    }
    const { data: product, error: readError } = await supabase.from("products").select("stock, status").eq("id", productId).maybeSingle();
    if (readError) return fail(readError, "No pudimos leer el producto.");
    if (!product) return { ok: false, error: "Ese producto ya no existe." };
    const stock = Math.min(product.stock + quantity, 100_000);
    const patch: { stock: number; status?: "published" } = { stock };
    if (publish && product.status !== "published") patch.status = "published";
    const { error } = await supabase.from("products").update(patch).eq("id", productId);
    if (error) return fail(error, "No pudimos sumar el stock.");
    if (expiresOn) {
      const lotError = await addLot(supabase, productId, expiresOn, quantity);
      if (lotError) {
        refreshCatalog();
        return { ok: false, error: "Se sumó el stock, pero no pudimos guardar el vencimiento. Cargalo en Vencimientos." };
      }
      revalidatePath("/admin/vencimientos");
    }
    refreshCatalog();
    revalidatePath("/admin");
    return { ok: true, data: { stock } };
  } catch (e) {
    return fail(e, "No pudimos sumar el stock.");
  }
}

/** Carga un lote: producto, vencimiento como en el envase ("01/29") y cantidad. No cambia el stock. */
export async function addProductLot(productId: string, expiry: string, quantity: number): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(productId)) return { ok: false, error: "Elegí un producto de la lista." };
    const expiresOn = parseExpiry(String(expiry));
    if (!expiresOn) return { ok: false, error: "Escribí el vencimiento como en el envase, por ejemplo 01/29." };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return { ok: false, error: "La cantidad tiene que ser un número entero, 1 o más." };
    }
    const error = await addLot(supabase, productId, expiresOn, quantity);
    if (error) return fail(error, "No pudimos guardar el vencimiento.");
    revalidatePath("/admin/vencimientos");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return fail(e, "No pudimos guardar el vencimiento.");
  }
}

/**
 * «Vendido» en Próximos a vencer: resta 1 de la lista y 1 del stock del producto.
 * Si era la última unidad anotada, sale de la lista.
 */
export async function sellFromLot(lotId: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(lotId)) return { ok: false, error: "Datos inválidos." };
    const { data: lot } = await supabase.from("product_lots").select("id, product_id, quantity").eq("id", lotId).maybeSingle();
    if (!lot) return { ok: false, error: "Ese producto ya no está en la lista." };
    const { data: product } = await supabase.from("products").select("stock").eq("id", lot.product_id).maybeSingle();
    if (product) {
      const { error } = await supabase
        .from("products")
        .update({ stock: Math.max(product.stock - 1, 0) })
        .eq("id", lot.product_id);
      if (error) return fail(error, "No pudimos descontar el stock.");
    }
    const { error } =
      lot.quantity <= 1
        ? await supabase.from("product_lots").delete().eq("id", lotId)
        : await supabase.from("product_lots").update({ quantity: lot.quantity - 1 }).eq("id", lotId);
    if (error) return fail(error, "No pudimos actualizar la lista.");
    refreshCatalog();
    revalidatePath("/admin/vencimientos");
    revalidatePath("/admin");
    return { ok: true, message: product ? `Vendido: queda${product.stock - 1 === 1 ? "" : "n"} ${Math.max(product.stock - 1, 0)} en stock.` : "Listo." };
  } catch (e) {
    return fail(e, "No pudimos descontar el stock.");
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
        mp_link: d.mpLink,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) return fail(error, "No pudimos guardar los datos.");
    refreshCatalog();
    return {
      ok: true,
      message: d.mpLink
        ? "Listo: las clientas pagan con tu link de Mercado Pago."
        : d.alias || d.cbu
          ? "Listo: las clientas ya pueden elegir Transferencia."
          : "Transferencia desactivada.",
    };
  } catch (e) {
    return fail(e, "No pudimos guardar los datos.");
  }
}

/** Guarda los links de Facebook e Instagram de la tienda («Quiénes somos»). */
export async function saveSocialLinks(input: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const parsed = socialLinksSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Revisá los campos marcados.", fields: fieldErrors(parsed.error) };
    }
    const { error } = await supabase
      .from("store_settings")
      .update({ facebook_url: parsed.data.facebook, instagram_url: parsed.data.instagram, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return fail(error, "No pudimos guardar las redes.");
    refreshCatalog();
    revalidatePath("/quienes-somos");
    return { ok: true, message: "Listo: las redes ya aparecen en «Quiénes somos»." };
  } catch (e) {
    return fail(e, "No pudimos guardar las redes.");
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

/** Meta de ventas del mes que se muestra en el Inicio (0 = sin meta). */
export async function saveMonthlyGoal(value: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const n = parseMoney(typeof value === "string" ? value : String(value ?? ""));
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return { ok: false, error: "Escribí un monto válido, por ejemplo 300000." };
    const { error } = await supabase
      .from("store_settings")
      .update({ monthly_goal: Math.round(n), updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return fail(error, "No pudimos guardar la meta.");
    revalidatePath("/admin");
    return { ok: true, message: n > 0 ? "¡Meta guardada!" : "Sacaste la meta." };
  } catch (e) {
    return fail(e, "No pudimos guardar la meta.");
  }
}

/** Cantidad de pagos recientes con los que se comprueba la comisión real de Mercado Pago. */
const FEE_CHECK_PAYMENTS = 20;
const FEE_CHECK_MIN_PAYMENTS = 3;

/** Mira lo que Mercado Pago cobró de verdad en los últimos pagos y deja el recargo justo para no perder. */
export async function updateSurchargeFromRealFees(): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const [{ data: orders, error: ordersError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase
        .from("orders")
        .select("total, mp_net_received")
        .eq("payment_method", "mercadopago")
        .eq("payment_status", "approved")
        .not("mp_net_received", "is", null)
        .order("created_at", { ascending: false })
        .limit(FEE_CHECK_PAYMENTS),
      supabase.from("store_settings").select("mp_surcharge_percent").eq("id", 1).single(),
    ]);
    if (ordersError || settingsError) return fail(ordersError ?? settingsError, "No pudimos revisar los pagos.");
    const current = Number(settings?.mp_surcharge_percent ?? 0);
    const summary = summarizeMpFees(orders ?? [], current);
    if (summary.count < FEE_CHECK_MIN_PAYMENTS || summary.suggestedPercent === null) {
      return { ok: false, error: `Todavía hay pocos pagos para comprobarlo (hacen falta ${FEE_CHECK_MIN_PAYMENTS} con Mercado Pago).` };
    }
    const next = Math.min(recommendedPercent(summary.suggestedPercent), 25);
    if (Math.abs(next - current) < 0.05) {
      return { ok: true, message: `Está bien: el recargo de ${current}% ya tiene el colchón de 0,5% sobre la comisión (hoy cobran ${summary.feePercent}%).` };
    }
    const { error } = await supabase
      .from("store_settings")
      .update({ mp_surcharge_percent: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return fail(error, "No pudimos guardar el recargo.");
    refreshCatalog();
    revalidatePath("/admin/comision");
    return { ok: true, message: `Listo: el recargo pasó de ${current}% a ${next}% (comisión justa ${summary.suggestedPercent}% + 0,5% de colchón), según los últimos ${summary.count} pagos.` };
  } catch (e) {
    return fail(e, "No pudimos revisar los pagos.");
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

export type AdminSearchOption = SaleProductOption & { status: string };

/** Sugerencias del buscador del panel (incluye borradores), con foto, precio y stock. */
export async function searchAdminProducts(q: string): Promise<AdminSearchOption[]> {
  try {
    const { supabase } = await assertAdmin();
    const patterns = nameSearchPatterns(String(q).slice(0, 80));
    if (patterns.length === 0) return [];
    let query = supabase.from("products").select("id, name, size, sale_price, stock, status, images:product_images(storage_path, position)");
    for (const pattern of patterns) query = query.filter("name", "imatch", pattern);
    const { data } = await query.order("status", { ascending: false }).order("name").limit(30);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      size: p.size,
      status: p.status,
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
    if (!admin) return { ok: false, error: "Falta un dato de configuración del sitio. Avisale a quien armó la página." };

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
    const salePhone = toWhatsAppPhone(input.customerPhone);
    // Si el WhatsApp es de una clienta con cuenta, la venta queda a su nombre y suma al Club.
    const { data: account } = salePhone
      ? await admin.from("customers").select("user_id").eq("phone", salePhone).limit(1).maybeSingle()
      : { data: null };
    const { data: order, error: insertError } = await admin
      .from("orders")
      .insert({
        customer_name: input.customerName?.trim().slice(0, 80) || null,
        customer_phone: salePhone,
        customer_user_id: account?.user_id ?? null,
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
    return { ok: true, data: { code: order.code }, message: `Venta ${order.code} registrada. Ya descontamos el stock.${account ? " Es clienta con cuenta: suma al Club." : ""}` };
  } catch (e) {
    return fail(e, "No pudimos registrar la venta.");
  }
}

/* ----------------------- Deudas y avisos de reposición ----------------------- */

/** Guarda el WhatsApp de una clienta en sus pedidos (para mandarle recordatorios). */
/** Completa o corrige el nombre y el WhatsApp de la clienta de un pedido. */
export async function setOrderContact(orderId: string, name: string, phone: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(orderId)) return { ok: false, error: "Pedido inválido." };
    const cleanName = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    const rawPhone = String(phone ?? "").trim();
    const normalized = rawPhone ? toWhatsAppPhone(rawPhone) : null;
    if (rawPhone && !normalized) return { ok: false, error: "Escribí el celular con código de área, por ejemplo 11 2345-6789." };
    const { error } = await supabase
      .from("orders")
      .update({ customer_name: cleanName || null, customer_phone: normalized })
      .eq("id", orderId);
    if (error) return fail(error, "No pudimos guardar los datos.");
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ventas");
    revalidatePath("/admin/deudas");
    return { ok: true, message: "Datos de la clienta guardados." };
  } catch (e) {
    return fail(e, "No pudimos guardar los datos.");
  }
}

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

export type ReceiptInvoice = { number: string | null; date: string | null; dueDate: string | null; total: number | null };
export type ReceiptRead = {
  lines: ReceiptLine[];
  invoice: ReceiptInvoice;
  /** Si esta factura ya se cargó antes: cuándo y cuántas unidades. */
  previous: { id: string; createdAt: string; units: number } | null;
};

export type ReceiptMatch = { id: string; name: string; size: string | null; stock: number; image: string | null; status: string };
export type ReceiptLine = {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number | null;
  match: ReceiptMatch | null;
  /** true cuando el producto se eligió por parecido del nombre y hay que confirmarlo. */
  unsure: boolean;
  /** Caja o kit de la boleta en el que vino (vacío si vino suelto). */
  kit: string;
};

const RECEIPT_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const MAX_RECEIPT_PHOTOS = 3;

/** Lo que se espera de la respuesta (se valida antes de usarla). */
const ReceiptSchema = z.object({
  items: z.array(
    z.object({
      code: z.string().catch(""),
      description: z.string(),
      quantity: z.number(),
      unit_price: z.number().nullable().catch(null),
      match: z.number().nullable().catch(null),
      match_sure: z.boolean().catch(false),
      kit: z.string().catch(""),
    }),
  ),
  invoice_number: z.string().catch(""),
  invoice_date: z.string().catch(""),
  due_date: z.string().catch(""),
  invoice_total: z.number().nullable().catch(null),
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
          unit_price: { type: ["number", "null"], description: "Precio de lista (revista) por unidad en pesos, sin descuentos. Null si no figura." },
          match: { type: ["integer", "null"], description: "Número del producto del catálogo de la tienda que corresponde a este renglón. Null si ninguno." },
          match_sure: { type: "boolean", description: "true solo si estás segura de que es exactamente ese producto (mismo producto y misma presentación)." },
          kit: { type: "string", description: "Descripción de la caja o kit en el que vino este producto. Vacío si vino suelto." },
        },
        required: ["code", "description", "quantity", "unit_price", "match", "match_sure", "kit"],
      },
    },
    invoice_number: { type: "string", description: "Número de la factura (por ejemplo 0028-32433058). Vacío si no se ve." },
    invoice_date: { type: "string", description: "Fecha de la factura como figura (dd/mm/aaaa). Vacío si no se ve." },
    due_date: { type: "string", description: "Fecha de vencimiento para pagar (Fecha VTO), dd/mm/aaaa. Vacío si no figura." },
    invoice_total: { type: ["number", "null"], description: "Total a pagar de la factura en pesos. Null si no se ve." },
  },
  required: ["items", "invoice_number", "invoice_date", "due_date", "invoice_total"],
};

/**
 * Modelos de Google que leen la boleta (con uso gratis), en orden. Si el primero está saturado
 * se prueba con el de repuesto. El principal se puede cambiar con GEMINI_MODEL.
 */
const RECEIPT_MODELS = [process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-flash-lite-latest"];

function receiptPrompt(catalog: string) {
  return `Esto es una factura (nota fiscal) de un pedido de Natura Argentina hecho por una consultora: un PDF o fotos. Si hay varias páginas o fotos son partes de la misma factura.
Columnas habituales: MARCA, CODIGO, CANT, DESCRIPCION, ORIGEN, ADUANA, DESPACHO, PRECIO UNIT., TOTAL.

Cómo leerla:
- Muchos renglones con CODIGO son CAJAS o KITS de regalo (en la descripción dicen "CJ", por ejemplo "TD CJ FRUTAS ROJAS CP REG 2026"). Debajo vienen sus componentes: renglones SIN código y con precio 0,00. La cantidad de cada componente ya es el total que llegó.
- Lo que interesa para el stock son los PRODUCTOS que llegaron. Si un kit tiene componentes listados debajo, devolvé los componentes (cada uno con kit = la descripción de su caja) y NO devuelvas el renglón de la caja. Si un renglón con código no tiene componentes debajo, es un producto suelto: devolvelo con kit vacío.
- No incluyas bolsas ("BOLSA ..."), "gift", totales, subtotales, impuestos, percepciones, envío, descuentos, puntos, folletos ni revistas.
- Si el mismo producto aparece en varias cajas, devolvelo una vez por cada aparición (después se suman).

Para cada producto:
- code: el código de Natura del renglón (solo números). Vacío si el renglón no tiene código.
- description: la descripción tal como está escrita (viene abreviada).
- quantity: cuántas unidades llegaron.
- unit_price: precio unitario en pesos si es mayor a cero; si no, null. Ojo: en Argentina "13.687,24" son trece mil seiscientos ochenta y siete con 24.
- kit: descripción de la caja en la que vino, o vacío.
- match y match_sure: buscá el producto en el CATÁLOGO DE LA TIENDA de abajo y poné en match el número de renglón del catálogo. Las descripciones vienen abreviadas, por ejemplo: TD o TDIA = Tododia, HID = hidratante o crema hidratante, MAOS = manos, SAB o SAB BAR = jabón en barra, DES = desodorante, PERF = perfumado, FR = frutas, COND = acondicionador, SH = shampoo, CR = crema, EDT/EDP/DEO COL = perfume, REF o REP = repuesto, CJ = caja, REG = regalo, AMS = muestra. match_sure = true solo si es claramente el mismo producto y la misma presentación (tamaño, repuesto o no). Si es parecido pero dudás, poné igual el número con match_sure = false. Si no está en el catálogo, match = null.
Además, del encabezado y del pie: invoice_number (FACTURA N°), invoice_date (FECHA), due_date (Fecha VTO) e invoice_total (el Total final a pagar).
No inventes renglones. Si algo está borroso, incluilo con lo que se pueda leer.

CATÁLOGO DE LA TIENDA (número: nombre · presentación [código]):
${catalog}`;
}

/** Lee la factura (PDF o fotos) con la inteligencia artificial de Google (Gemini) y la cruza con los productos de la tienda. */
export async function readReceipt(formData: FormData): Promise<ActionResult<ReceiptRead>> {
  try {
    const { supabase } = await assertAdmin();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "El lector de facturas no está activado. Pedile a quien armó la página que lo configure. Pedile a quien te armó la página que la configure." };
    }
    const files = formData.getAll("foto").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { ok: false, error: "Subí el PDF de la factura o una foto de la boleta." };
    if (files.length > MAX_RECEIPT_PHOTOS) return { ok: false, error: `Podés subir hasta ${MAX_RECEIPT_PHOTOS} fotos por boleta.` };

    const images: Part[] = [];
    for (const file of files) {
      const type = RECEIPT_FILE_TYPES.find((t) => t === file.type);
      if (!type || file.size > 4_000_000) return { ok: false, error: "Subí el PDF de la factura o fotos (JPG, PNG o WEBP) de menos de 4 MB." };
      images.push(createPartFromBase64(Buffer.from(await file.arrayBuffer()).toString("base64"), type));
    }

    // Catálogo completo (publicados y ocultos) para que la IA reconozca los nombres abreviados.
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, size, stock, status, natura_sku, images:product_images(storage_path, position)")
      .order("name")
      .limit(3000);
    if (productsError) return fail(productsError, "No pudimos leer los productos de la tienda.");
    const catalog: ReceiptMatch[] = (products ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      size: p.size,
      stock: p.stock,
      status: p.status,
      image: [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null,
    }));
    const catalogText = (products ?? [])
      .map((p, i) => `${i + 1}: ${p.name}${p.size ? ` · ${p.size}` : ""}${p.natura_sku ? ` [${p.natura_sku.replace("NATARG-", "")}]` : ""}`)
      .join("\n");
    const bySku = new Map<string, ReceiptMatch>();
    (products ?? []).forEach((p, i) => {
      const key = codeKey(p.natura_sku);
      if (key && !bySku.has(key)) bySku.set(key, catalog[i]);
    });

    const ai = new GoogleGenAI({ apiKey });
    const ask = (model: string) =>
      ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [...images, { text: receiptPrompt(catalogText) }] }],
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

    // Se juntan los renglones repetidos; el producto elegido por la IA viaja junto a cada uno.
    const aiPick = new Map<string, { match: ReceiptMatch; sure: boolean }>();
    const raw = parsed.items.map((i) => {
      const picked = Number.isInteger(i.match) && i.match! >= 1 ? catalog[i.match! - 1] : undefined;
      const key = codeKey(i.code) ?? `sin-codigo:${i.description.trim().slice(0, 160).toLowerCase()}`;
      if (picked && !aiPick.has(key)) aiPick.set(key, { match: picked, sure: i.match_sure });
      // Precios absurdos (menos de $100) se descartan: suele ser un error de lectura.
      const price = i.unit_price !== null && i.unit_price >= 100 ? i.unit_price : null;
      return { code: i.code, description: i.description, quantity: i.quantity, unitPrice: price, kit: i.kit };
    });
    const items = mergeReceiptItems(raw);
    if (items.length === 0) return { ok: false, error: "No encontramos productos en la foto. Probá con otra, que se vea toda la lista." };

    // Lo aprendido de facturas anteriores: descripción abreviada → producto confirmado.
    const byId = new Map(catalog.map((p) => [p.id, p]));
    const { data: aliases } = await supabase
      .from("receipt_aliases")
      .select("description, product_id")
      .in("description", [...new Set(items.map((i) => aliasKey(i.description)))]);
    const learned = new Map((aliases ?? []).map((a) => [a.description, byId.get(a.product_id)]));

    const invoice: ReceiptInvoice = {
      number: cleanInvoiceNumber(parsed.invoice_number),
      date: parseArDate(parsed.invoice_date),
      dueDate: parseArDate(parsed.due_date),
      total: parsed.invoice_total !== null && parsed.invoice_total > 0 ? Math.round(parsed.invoice_total * 100) / 100 : null,
    };
    const { data: previous } = invoice.number
      ? await supabase.from("receipts").select("id, created_at, units").eq("invoice_number", invoice.number).maybeSingle()
      : { data: null };

    const lines: ReceiptLine[] = items.map((i) => {
        const key = codeKey(i.code);
        // 1) Mismo código de Natura. 2) Ya confirmado en otra factura. 3) Elegido por la IA: seguro o "revisar".
        const exact = key ? bySku.get(key) : undefined;
        const base = { ...i, kit: i.kit ?? "" };
        if (exact) return { ...base, match: exact, unsure: false };
        const known = learned.get(aliasKey(i.description));
        if (known) return { ...base, match: known, unsure: false };
        const pick = aiPick.get(key ?? `sin-codigo:${i.description.toLowerCase()}`);
        return { ...base, match: pick?.match ?? null, unsure: pick ? !pick.sure : false };
    });
    return {
      ok: true,
      data: {
        lines,
        invoice,
        previous: previous ? { id: previous.id, createdAt: previous.created_at, units: previous.units } : null,
      },
    };
  } catch (e) {
    if (e instanceof ApiError) {
      console.error("[admin] readReceipt:", e.status, e.message);
      if (e.status === 401 || e.status === 403 || (e.status === 400 && /api key/i.test(e.message))) {
        return { ok: false, error: "El lector de facturas no está funcionando. Avisale a quien armó la página." };
      }
      if (e.status === 429) {
        return { ok: false, error: "Se usó mucho el lector en poco tiempo. Probá de nuevo en un rato. Probá de nuevo en un rato." };
      }
      return { ok: false, error: "El lector de boletas no respondió. Probá de nuevo en un minuto." };
    }
    return fail(e, "No pudimos leer la boleta.");
  }
}

export type ReceiptApplyInput = {
  lines: (
    | { kind: "existing"; productId: string; quantity: number; description?: string; expiry?: string }
    | { kind: "new"; name: string; code: string; price: number; salePrice?: number; quantity: number; description?: string; expiry?: string }
  )[];
  publish: boolean;
  /** Factura a la que pertenecen (para el historial). El id lo genera la pantalla al leerla. */
  receipt?: { id: string } & ReceiptInvoice;
};

/** Suma al stock lo confirmado de la boleta y crea (como borrador) los productos que no estaban. */
export async function applyReceipt(
  input: ReceiptApplyInput,
): Promise<ActionResult<{ units: number; updated: number; created: { id: string; name: string; sku: string | null }[] }>> {
  try {
    const { supabase } = await assertAdmin();
    const lines = Array.isArray(input?.lines) ? input.lines.slice(0, 200) : [];

    const adds = new Map<string, number>();
    const descriptions = new Map<string, string>();
    const history: { product_id: string; product_name: string; quantity: number; description: string | null }[] = [];
    const news: { name: string; sku: string | null; price: number; sale: number; quantity: number; alias: string; expiresOn: string | null }[] = [];
    // Vencimientos escritos en la pantalla (opcionales): se anotan como lotes.
    const lots: { productId: string; expiresOn: string; quantity: number }[] = [];
    // Descripciones de la factura confirmadas por la administradora: se recuerdan para la próxima.
    const learn = new Map<string, string>();
    for (const l of lines) {
      const qty = Number(l?.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 1000) return { ok: false, error: "Revisá las cantidades: tienen que ser 1 o más." };
      const expiryText = String(l?.expiry ?? "").trim();
      const expiresOn = expiryText ? parseExpiry(expiryText) : null;
      if (expiryText && !expiresOn) {
        return { ok: false, error: "Revisá los vencimientos: se escriben como en el envase, por ejemplo 01/29." };
      }
      if (l.kind === "existing") {
        if (!UUID_RE.test(String(l.productId))) return { ok: false, error: "Hay un producto inválido en la lista." };
        adds.set(l.productId, (adds.get(l.productId) ?? 0) + qty);
        if (expiresOn) lots.push({ productId: l.productId, expiresOn, quantity: qty });
        const alias = aliasKey(String(l.description ?? ""));
        if (alias) {
          learn.set(alias, l.productId);
          descriptions.set(l.productId, alias);
        }
      } else if (l.kind === "new") {
        const name = String(l.name ?? "").trim().replace(/\s+/g, " ");
        if (name.length < 2 || name.length > 120) return { ok: false, error: "Poné un nombre (de 2 a 120 letras) a cada producto nuevo." };
        if (!isValidPrice(l.price)) return { ok: false, error: `Poné el precio de revista de «${name}».` };
        // Precio de venta con el descuento elegido (si no hay, el de revista; nunca más caro).
        const sale = isValidPrice(l.salePrice) && Number(l.salePrice) <= Number(l.price) ? toCents(l.salePrice) / 100 : toCents(l.price) / 100;
        news.push({
          name,
          sku: skuFromCode(l.code),
          price: toCents(l.price) / 100,
          sale,
          quantity: qty,
          alias: aliasKey(String(l.description ?? "")),
          expiresOn,
        });
      }
    }
    if (adds.size === 0 && news.length === 0) return { ok: false, error: "La lista está vacía." };

    let updated = 0;
    let units = 0;
    if (adds.size > 0) {
      const { data: current, error } = await supabase.from("products").select("id, name, stock, status").in("id", [...adds.keys()]);
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
        history.push({ product_id: p.id, product_name: p.name, quantity: qty, description: descriptions.get(p.id) ?? null });
      }
    }

    const created: { id: string; name: string; sku: string | null }[] = [];
    for (const n of news) {
      const base = slugify(n.name) || "producto";
      const { data, error } = await supabase
        .from("products")
        .insert({
          name: n.name,
          slug: `${base.slice(0, 120)}-${Math.random().toString(36).slice(2, 7)}`,
          natura_sku: n.sku,
          magazine_price: n.price,
          sale_price: n.sale,
          stock: n.quantity,
          status: "draft",
        })
        .select("id, name, natura_sku")
        .single();
      if (error) {
        refreshCatalog();
        const res = fail(error, "No pudimos crear un producto nuevo.");
        return {
          ok: false,
          error: `Se sumó el stock de ${updated} productos y se crearon ${created.length} nuevos, pero «${n.name}» dio error: ${res.ok ? "" : res.error}`,
        };
      }
      created.push({ id: data.id, name: data.name, sku: data.natura_sku });
      units += n.quantity;
      if (n.expiresOn) lots.push({ productId: data.id, expiresOn: n.expiresOn, quantity: n.quantity });
      if (n.alias) learn.set(n.alias, data.id);
      history.push({ product_id: data.id, product_name: data.name, quantity: n.quantity, description: n.alias || null });
    }

    for (const lot of lots) {
      // Un vencimiento que no se pudo guardar no deshace el stock: se avisa en el registro.
      const lotError = await addLot(supabase, lot.productId, lot.expiresOn, lot.quantity);
      if (lotError) console.error("[admin] vencimiento de factura:", lotError.message);
    }
    if (lots.length > 0) revalidatePath("/admin/vencimientos");

    if (learn.size > 0) {
      const now = new Date().toISOString();
      const { error: learnError } = await supabase
        .from("receipt_aliases")
        .upsert([...learn].map(([description, product_id]) => ({ description, product_id, updated_at: now })));
      // Si no se pudo recordar, el stock igual quedó cargado: solo se avisa en el registro.
      if (learnError) console.error("[admin] receipt_aliases:", learnError.message);
    }

    if (input.receipt && UUID_RE.test(String(input.receipt.id)) && history.length > 0) {
      await recordReceipt(supabase, input.receipt, units, history);
    }

    refreshCatalog();
    revalidatePath("/admin");
    return { ok: true, data: { units, updated, created } };
  } catch (e) {
    return fail(e, "No pudimos cargar la boleta.");
  }
}

/**
 * Guarda la factura y lo que se cargó de ella en el historial. Si la misma factura se carga en
 * varias veces (de a uno), se acumula en el mismo registro. Un error acá no deshace el stock.
 */
async function recordReceipt(
  supabase: Awaited<ReturnType<typeof assertAdmin>>["supabase"],
  receipt: { id: string } & ReceiptInvoice,
  units: number,
  items: { product_id: string; product_name: string; quantity: number; description: string | null }[],
) {
  try {
    const number = cleanInvoiceNumber(receipt.number);
    const { data: existing } = await supabase.from("receipts").select("id, units").eq("id", receipt.id).maybeSingle();
    const now = new Date().toISOString();
    const { error } = existing
      ? await supabase.from("receipts").update({ units: existing.units + units, updated_at: now }).eq("id", receipt.id)
      : await supabase.from("receipts").insert({
          id: receipt.id,
          invoice_number: number,
          invoice_date: receipt.date && /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) ? receipt.date : null,
          due_date: receipt.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(receipt.dueDate) ? receipt.dueDate : null,
          total: typeof receipt.total === "number" && receipt.total > 0 ? receipt.total : null,
          units,
        });
    if (error) throw error;
    const { error: itemsError } = await supabase
      .from("receipt_items")
      .insert(items.map((i) => ({ ...i, receipt_id: receipt.id, product_name: i.product_name.slice(0, 200) })));
    if (itemsError) throw itemsError;
    revalidatePath("/admin/productos");
  } catch (e) {
    console.error("[admin] historial de facturas:", (e as Error)?.message ?? e);
  }
}

/* ------------------------- Fotos desde Natura ------------------------- */

export type NaturaPhotoStatus = "ok" | "same" | "not_found" | "no_images" | "full" | "blocked" | "bad_ref" | "no_code" | "own_photos" | "error";
type NaturaPhotoResponse = { status: NaturaPhotoStatus; added?: number; replaced?: number; name?: string | null; message?: string };

const NATURA_PHOTO_MESSAGES: Record<Exclude<NaturaPhotoStatus, "ok" | "same">, string> = {
  not_found: "No encontramos ese producto en Natura. Revisá el código o pegá el enlace de la ficha.",
  no_images: "Ese producto no tiene fotos en Natura.",
  full: "Este producto ya tiene el máximo de fotos propias.",
  blocked: "Natura no nos dejó entrar en este momento. Probá más tarde.",
  bad_ref: "Escribí el código de Natura (solo números) o pegá el enlace del producto.",
  no_code: "Este producto no tiene código de Natura: escribilo o pegá el enlace.",
  own_photos: "Este producto tiene fotos tuyas: no se cambian.",
  error: "No pudimos traer la foto.",
};

async function callNaturaPhotos(
  supabase: Awaited<ReturnType<typeof assertAdmin>>["supabase"],
  body: { productId: string; ref?: string; skipOwn?: boolean },
): Promise<NaturaPhotoResponse> {
  const { data, error } = await supabase.functions.invoke<NaturaPhotoResponse>("fotos-natura", { body });
  if (error || !data) {
    console.error("[admin] fotos-natura:", error?.message);
    return { status: "error", message: "No pudimos consultar Natura. Probá de nuevo en un rato." };
  }
  return data;
}

/**
 * Trae las fotos de un producto desde su ficha en Natura (por código o enlace). Reemplaza solo las
 * fotos que vinieron de Natura; las que subió la administradora no se tocan.
 * La descarga la hace la función de Supabase `fotos-natura` (Natura rechaza los pedidos desde Vercel).
 */
export async function importNaturaPhotos(
  productId: string,
  ref: string,
): Promise<ActionResult<{ added: number; same: boolean; name: string | null }>> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(productId)) return { ok: false, error: "Producto inválido." };
    const clean = String(ref ?? "").trim().slice(0, 300);
    if (!clean) return { ok: false, error: "Escribí el código de Natura o pegá el enlace del producto." };

    const data = await callNaturaPhotos(supabase, { productId, ref: clean });
    if (data.status === "same") return { ok: true, data: { added: 0, same: true, name: data.name ?? null } };
    if (data.status !== "ok") return { ok: false, error: data.message ?? NATURA_PHOTO_MESSAGES[data.status] ?? "No pudimos traer la foto." };

    refreshCatalog();
    revalidatePath(`/admin/productos/${productId}`);
    return { ok: true, data: { added: data.added ?? 0, same: false, name: data.name ?? null } };
  } catch (e) {
    return fail(e, "No pudimos traer la foto.");
  }
}

/**
 * Un paso de la actualización general de fotos: usa el código guardado del producto y no toca los
 * productos que solo tienen fotos propias. No refresca la tienda (se hace una vez al final).
 */
export async function updateNaturaPhotosStep(productId: string): Promise<NaturaPhotoStatus> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(productId)) return "error";
    return (await callNaturaPhotos(supabase, { productId, skipOwn: true })).status;
  } catch {
    return "error";
  }
}

/** Al terminar la actualización general: refresca la tienda una sola vez. */
export async function finishNaturaPhotos(): Promise<ActionResult> {
  try {
    await assertAdmin();
    refreshCatalog();
    return { ok: true };
  } catch (e) {
    return fail(e, "No pudimos refrescar la tienda.");
  }
}

/* ------------------------- Productos nuevos de Natura ------------------------- */

export type NaturaNovelties = { total: number; have: number; pending: string[] };
export type NoveltyStatus = "agregado" | "variante" | "sin_precio" | "no_disponible" | "ya_estaba" | "blocked" | "error";
export type NoveltyResult = { status: NoveltyStatus; id?: string; name?: string; category?: string | null; price?: number };

/** Compara la lista pública de productos de Natura con la tienda y devuelve los códigos que faltan revisar. */
export async function findNaturaNovelties(): Promise<ActionResult<NaturaNovelties>> {
  try {
    const { supabase } = await assertAdmin();
    const { data, error } = await supabase.functions.invoke<{ status: string; total?: number; have?: number; pending?: string[]; message?: string }>(
      "novedades-natura",
      { body: { mode: "buscar" } },
    );
    if (error || !data) {
      console.error("[admin] novedades-natura (buscar):", error?.message);
      return { ok: false, error: "No pudimos consultar Natura. Probá de nuevo en un rato." };
    }
    if (data.status === "blocked") return { ok: false, error: "Natura no nos dejó entrar en este momento. Probá más tarde." };
    if (data.status !== "ok") return { ok: false, error: data.message ?? "No pudimos leer la lista de Natura." };
    return { ok: true, data: { total: data.total ?? 0, have: data.have ?? 0, pending: data.pending ?? [] } };
  } catch (e) {
    return fail(e, "No pudimos buscar productos nuevos.");
  }
}

export type DeadNaturaItem = { sku: string; name: string };

/** Productos de la lista de Natura cuya ficha ya no existe (el nombre sale del enlace) y que la tienda no tiene. */
export async function listDeadNaturaProducts(): Promise<ActionResult<DeadNaturaItem[]>> {
  try {
    const { supabase } = await assertAdmin();
    const { data, error } = await supabase.functions.invoke<{ status: string; items?: DeadNaturaItem[]; message?: string }>("novedades-natura", { body: { mode: "muertos" } });
    if (error || !data) return { ok: false, error: "No pudimos consultar Natura. Probá de nuevo en un rato." };
    if (data.status === "blocked") return { ok: false, error: "Natura no nos deja entrar en este momento. Probá más tarde." };
    if (data.status !== "ok") return { ok: false, error: data.message ?? "No pudimos leer la lista de Natura." };
    return { ok: true, data: data.items ?? [] };
  } catch (e) {
    return fail(e, "No pudimos buscar esos productos.");
  }
}

/** Crea a mano un producto cuya ficha de Natura ya no existe: nombre y precio de revista los pone la administradora. */
export async function createManualNaturaProduct(sku: string, name: string, price: number): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const { supabase } = await assertAdmin();
    if (!/^NATARG-\d{1,12}$/.test(String(sku))) return { ok: false, error: "Código inválido." };
    const { data, error } = await supabase.functions.invoke<NoveltyResult & { message?: string }>("novedades-natura", { body: { mode: "crear", sku, name, price } });
    if (error || !data) return { ok: false, error: "No pudimos agregarlo. Probá de nuevo." };
    if (data.status === "agregado" && data.id) {
      refreshCatalog();
      return { ok: true, data: { id: data.id, name: data.name ?? name }, message: "Producto agregado." };
    }
    if (data.status === "ya_estaba") return { ok: false, error: `Ese ya lo tenés${data.name ? `: ${data.name}` : ""}.` };
    return { ok: false, error: data.message ?? "No pudimos agregarlo. Probá de nuevo." };
  } catch (e) {
    return fail(e, "No pudimos agregarlo.");
  }
}

/** Un paso de «Solo ver qué falta»: revisa un código de Natura y dice si falta en la tienda, sin crear nada. */
export async function previewNaturaNoveltyStep(sku: string): Promise<NoveltyResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!/^NATARG-\d{1,12}$/.test(String(sku))) return { status: "error" };
    const { data, error } = await supabase.functions.invoke<NoveltyResult & { preview?: { price?: number } }>("novedades-natura", { body: { mode: "simular", sku } });
    if (error || !data) return { status: "error" };
    return { status: data.status, id: data.id, name: data.name, category: data.category, price: data.preview?.price };
  } catch {
    return { status: "error" };
  }
}

/** Un paso de «Agregar los nuevos»: revisa un código de Natura y, si es un producto nuevo, lo crea (sin stock). */
export async function addNaturaNoveltyStep(sku: string): Promise<NoveltyResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!/^NATARG-\d{1,12}$/.test(String(sku))) return { status: "error" };
    const { data, error } = await supabase.functions.invoke<NoveltyResult>("novedades-natura", { body: { mode: "agregar", sku } });
    if (error || !data) {
      console.error("[admin] novedades-natura (agregar):", error?.message);
      return { status: "error" };
    }
    return data;
  } catch {
    return { status: "error" };
  }
}

/** Club de clientas: anota que se entregó un regalo (solo si de verdad le toca). */
export async function giveLoyaltyGift(phone: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const key = typeof phone === "string" ? toWhatsAppPhone(phone) : null;
    if (!key) return { ok: false, error: "Teléfono inválido." };
    const [{ count: purchases, error: e1 }, { count: given, error: e2 }] = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_phone", key)
        .not("customer_user_id", "is", null)
        .in("status", [...PURCHASE_STATUSES])
        .eq("payment_status", "approved")
        .gte("products_total", await getLoyaltyMinTotal()),
      supabase.from("loyalty_gifts").select("id", { count: "exact", head: true }).eq("phone", key),
    ]);
    if (e1 || e2) return fail(e1 ?? e2, "No pudimos anotar el regalo.");
    if (loyaltyStatus(purchases ?? 0, given ?? 0).pending <= 0) return { ok: false, error: "A esta clienta todavía no le toca regalo." };
    const { error } = await supabase.from("loyalty_gifts").insert({ phone: key });
    if (error) return fail(error, "No pudimos anotar el regalo.");
    revalidatePath("/admin/club");
    revalidatePath("/admin");
    return { ok: true, message: "¡Listo! Regalo anotado como entregado." };
  } catch (e) {
    return fail(e, "No pudimos anotar el regalo.");
  }
}

/** Deshace el último regalo anotado de una clienta (por si se tocó sin querer). */
export async function undoLoyaltyGift(phone: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const key = typeof phone === "string" ? toWhatsAppPhone(phone) : null;
    if (!key) return { ok: false, error: "Teléfono inválido." };
    const { data: last, error: e1 } = await supabase
      .from("loyalty_gifts")
      .select("id")
      .eq("phone", key)
      .order("given_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e1) return fail(e1, "No pudimos deshacer el regalo.");
    if (!last) return { ok: false, error: "No hay regalos anotados para deshacer." };
    const { error } = await supabase.from("loyalty_gifts").delete().eq("id", last.id);
    if (error) return fail(error, "No pudimos deshacer el regalo.");
    revalidatePath("/admin/club");
    revalidatePath("/admin");
    return { ok: true, message: "Listo, se deshizo el último regalo." };
  } catch (e) {
    return fail(e, "No pudimos deshacer el regalo.");
  }
}

const campaignSchema = z.object({
  id: z.string().regex(UUID_RE).optional(),
  title: z.string().trim().min(2, "Poné un nombre.").max(60),
  message: z.string().trim().max(200).optional().default(""),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí desde cuándo."),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí hasta cuándo."),
  product_ids: z.array(z.string().regex(UUID_RE)).max(200).default([]),
});

/** Crea o edita una fecha especial (Día de la Madre, del Padre...). */
export async function saveCampaign(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await assertAdmin();
    const parsed = campaignSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisá los datos." };
    const c = parsed.data;
    if (c.ends_on < c.starts_on) return { ok: false, error: "La fecha de fin tiene que ser después de la de inicio." };
    const row = {
      title: c.title,
      message: c.message || null,
      starts_on: c.starts_on,
      ends_on: c.ends_on,
      product_ids: [...new Set(c.product_ids)],
      slug: campaignSlug(c.title, c.starts_on),
    };
    const { data, error } = c.id
      ? await supabase.from("campaigns").update(row).eq("id", c.id).select("id").single()
      : await supabase.from("campaigns").insert(row).select("id").single();
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Ya hay una fecha especial con ese nombre este año." };
      return fail(error, "No pudimos guardar la fecha especial.");
    }
    revalidatePath("/admin/fechas");
    refreshCatalog();
    return { ok: true, data: { id: data.id }, message: "¡Listo! Fecha especial guardada." };
  } catch (e) {
    return fail(e, "No pudimos guardar la fecha especial.");
  }
}

export async function deleteCampaign(id: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "Fecha especial inválida." };
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) return fail(error, "No pudimos borrarla.");
    revalidatePath("/admin/fechas");
    refreshCatalog();
    return { ok: true, message: "Fecha especial borrada." };
  } catch (e) {
    return fail(e, "No pudimos borrarla.");
  }
}

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

/** Activa los avisos de pedidos en este celular. */
export async function savePushSubscription(input: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const parsed = pushSubscriptionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Este celular no permite avisos." };
    const { endpoint, keys } = parsed.data;
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
    if (error) return fail(error, "No pudimos activar los avisos.");
    return { ok: true, message: "¡Listo! Vas a recibir un aviso con cada pedido nuevo." };
  } catch (e) {
    return fail(e, "No pudimos activar los avisos.");
  }
}

/** Desactiva los avisos en este celular. */
export async function removePushSubscription(endpoint: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) return { ok: true };
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) return fail(error, "No pudimos desactivar los avisos.");
    return { ok: true, message: "Avisos desactivados en este celular." };
  } catch (e) {
    return fail(e, "No pudimos desactivar los avisos.");
  }
}

/** Manda un aviso de prueba a los celulares con avisos activados. */
export async function sendTestPush(): Promise<ActionResult> {
  try {
    await assertAdmin();
    await notifyAdmins({ title: "🔔 Aviso de prueba", body: "Así te va a llegar cada pedido nuevo de Natu Mariel.", url: "/admin/pedidos", tag: "prueba" });
    return { ok: true, message: "Mandamos el aviso de prueba. Si no te llegó en unos segundos, revisá los permisos del celular." };
  } catch (e) {
    return fail(e, "No pudimos mandar el aviso de prueba.");
  }
}

/** Club de clientas: monto mínimo para que un pedido sume una compra. */
export async function saveLoyaltyMinTotal(value: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const n = typeof value === "number" ? value : Number.NaN;
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { ok: false, error: "Escribí un monto válido (0 = cuentan todos)." };
    const { error } = await supabase
      .from("store_settings")
      .update({ loyalty_min_total: Math.round(n * 100) / 100, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) return fail(error, "No pudimos guardar el monto.");
    refreshCatalog();
    revalidatePath("/admin/club");
    return { ok: true, message: n > 0 ? `Listo: suman los pedidos desde ${formatARS(Math.round(n * 100))}.` : "Listo: suman todos los pedidos." };
  } catch (e) {
    return fail(e, "No pudimos guardar el monto.");
  }
}

/** Saca una reseña de la tienda (se borra para siempre). */
export async function deleteReview(id: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "Reseña inválida." };
    const { data, error } = await supabase.from("reviews").delete().eq("id", id).select("id");
    if (error) return fail(error, "No pudimos sacarla.");
    if (!data?.length) return { ok: false, error: "Esa reseña ya no está." };
    revalidatePath("/admin/resenas");
    revalidatePath("/");
    return { ok: true, message: "Reseña sacada de la tienda." };
  } catch (e) {
    return fail(e, "No pudimos sacarla.");
  }
}

/** Contesta una reseña (o borra la respuesta si viene vacía). La respuesta se ve en la tienda. */
export async function replyReview(id: unknown, reply: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "Reseña inválida." };
    const text = typeof reply === "string" ? reply.trim() : "";
    if (text.length > 500) return { ok: false, error: "La respuesta es muy larga (hasta 500 letras)." };
    const { data, error } = await supabase
      .from("reviews")
      .update({ reply: text || null, replied_at: text ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id");
    if (error) return fail(error, "No pudimos guardar la respuesta.");
    if (!data?.length) return { ok: false, error: "Esa reseña ya no está." };
    revalidatePath("/admin/resenas");
    revalidatePath("/");
    return { ok: true, message: text ? "Respuesta publicada." : "Respuesta borrada." };
  } catch (e) {
    return fail(e, "No pudimos guardar la respuesta.");
  }
}

/** Envíos a domicilio: guarda el % de cada localidad y la compra mínima para pedir envío. */
export async function saveShippingSettings(input: unknown): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const parsed = z
      .object({
        minTotal: z.number().min(0).max(100_000_000),
        zones: z.array(z.object({ id: z.string().regex(UUID_RE), percent: z.number().min(0).max(100) })).max(50),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisá los datos: los % van de 0 a 100 y el mínimo es un monto en pesos." };
    const now = new Date().toISOString();
    const results = await Promise.all([
      supabase
        .from("store_settings")
        .update({ shipping_min_total: Math.round(parsed.data.minTotal * 100) / 100, updated_at: now })
        .eq("id", 1),
      ...parsed.data.zones.map((zone) =>
        supabase
          .from("shipping_zones")
          .update({ percent: Math.round(zone.percent * 100) / 100, updated_at: now })
          .eq("id", zone.id),
      ),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error) return fail(failed.error, "No pudimos guardar los envíos.");
    refreshCatalog();
    revalidatePath("/carrito");
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Envíos guardados." };
  } catch (e) {
    return fail(e, "No pudimos guardar los envíos.");
  }
}

/**
 * Deja TODO el stock en cero y borra los vencimientos anotados (para empezar de nuevo, por ejemplo al
 * contar el stock real). No borra productos ni pedidos.
 */
export async function clearAllStock(): Promise<ActionResult<{ products: number }>> {
  try {
    const { supabase } = await assertAdmin();
    const { data: changed, error } = await supabase.from("products").update({ stock: 0 }).gt("stock", 0).select("id");
    if (error) return fail(error, "No pudimos dejar el stock en cero.");
    const { error: lotsError } = await supabase.from("product_lots").delete().gte("quantity", 0);
    if (lotsError) return fail(lotsError, "El stock quedó en cero, pero no pudimos borrar los vencimientos anotados.");
    refreshCatalog();
    revalidatePath("/admin/productos");
    revalidatePath("/admin/vencimientos");
    revalidatePath("/admin");
    const products = changed?.length ?? 0;
    return {
      ok: true,
      data: { products },
      message: products === 0 ? "No había stock para borrar." : `Listo: ${products} ${products === 1 ? "producto quedó" : "productos quedaron"} sin stock.`,
    };
  } catch (e) {
    return fail(e, "No pudimos dejar el stock en cero.");
  }
}

/** Agrega una localidad a la que se hace envío a domicilio. */
export async function addShippingZone(name: string, percent: number): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    const clean = String(name ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    if (clean.length < 2) return { ok: false, error: "Escribí el nombre de la localidad." };
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { ok: false, error: "El % va de 0 a 100." };
    const { data: last } = await supabase.from("shipping_zones").select("position").order("position", { ascending: false }).limit(1);
    const { error } = await supabase
      .from("shipping_zones")
      .insert({ name: clean, percent: Math.round(percent * 100) / 100, position: (last?.[0]?.position ?? 0) + 10 });
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Esa localidad ya está en la lista." };
      return fail(error, "No pudimos agregar la localidad.");
    }
    refreshCatalog();
    revalidatePath("/carrito");
    revalidatePath("/admin/configuracion");
    return { ok: true, message: `Agregaste ${clean}.` };
  } catch (e) {
    return fail(e, "No pudimos agregar la localidad.");
  }
}

/** Apaga o vuelve a prender una localidad (apagada no se ofrece en el carrito, pero no se pierde). */
export async function setShippingZoneActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(id)) return { ok: false, error: "Datos inválidos." };
    const { error } = await supabase.from("shipping_zones").update({ is_active: active }).eq("id", id);
    if (error) return fail(error, "No pudimos cambiar la localidad.");
    refreshCatalog();
    revalidatePath("/carrito");
    revalidatePath("/admin/configuracion");
    return { ok: true, message: active ? "Localidad activada." : "Localidad apagada: ya no se ofrece en el carrito." };
  } catch (e) {
    return fail(e, "No pudimos cambiar la localidad.");
  }
}

/** Borra una localidad. Los pedidos viejos conservan el nombre que tenían. */
export async function deleteShippingZone(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await assertAdmin();
    if (!UUID_RE.test(id)) return { ok: false, error: "Datos inválidos." };
    const { error } = await supabase.from("shipping_zones").delete().eq("id", id);
    if (error) return fail(error, "No pudimos borrar la localidad.");
    refreshCatalog();
    revalidatePath("/carrito");
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Localidad borrada." };
  } catch (e) {
    return fail(e, "No pudimos borrar la localidad.");
  }
}

/**
 * Descuento por categoría: el precio especial de TODOS los productos de la categoría pasa a ser
 * la revista menos el %. Con «mostrar en Ofertas», además aparecen en la página de Ofertas.
 */
export async function applyCategoryDiscount(input: unknown): Promise<ActionResult<{ updated: number }>> {
  try {
    const { supabase } = await assertAdmin();
    const parsed = z
      .object({ categoryId: z.string().regex(UUID_RE), percent: z.number().min(0).max(99), markOffer: z.boolean() })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: "Elegí una categoría y un descuento entre 0 y 99 %." };
    const { categoryId, percent, markOffer } = parsed.data;
    const { data: rows, error: readError } = await supabase
      .from("products")
      .select("id, magazine_price, is_offer")
      .eq("category_id", categoryId)
      .limit(5000);
    if (readError) return fail(readError, "No pudimos leer los productos de la categoría.");

    const results = await Promise.all(
      (rows ?? []).map((p) => {
        const sale_price = salePriceFromDiscount(p.magazine_price, percent);
        if (!Number.isFinite(sale_price)) return Promise.resolve({ error: null, skipped: true });
        const discounted = sale_price < Number(p.magazine_price);
        // Sin descuento no puede seguir como oferta; con «mostrar en Ofertas», pasa a oferta.
        const is_offer = discounted && (markOffer || p.is_offer);
        return supabase
          .from("products")
          .update({ sale_price, is_offer })
          .eq("id", p.id)
          .then(({ error }) => ({ error, skipped: false }));
      }),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return fail(failed.error, "No pudimos actualizar algunos precios.");
    // Queda guardado: los productos nuevos (o con precio de revista nuevo) de la categoría lo toman solos.
    const { error: saveError } = await supabase
      .from("categories")
      .update({ discount_percent: percent, discount_offer: markOffer })
      .eq("id", categoryId);
    if (saveError) return fail(saveError, "Se cambiaron los precios, pero no pudimos guardar el descuento de la categoría.");
    refreshCatalog();
    revalidatePath("/admin/productos");
    revalidatePath("/admin/categorias");
    const updated = results.filter((r) => !r.skipped).length;
    return {
      ok: true,
      data: { updated },
      message:
        updated === 0
          ? percent === 0
            ? "Listo: la categoría ya no tiene descuento."
            : `Listo: ${percent}% guardado. Se aplica solo a los productos que cargues en esta categoría.`
          : percent === 0
          ? `Listo: ${updated} ${updated === 1 ? "producto quedó" : "productos quedaron"} al precio de revista.`
          : `Listo: ${updated} ${updated === 1 ? "producto" : "productos"} con ${percent}% de descuento.`,
    };
  } catch (e) {
    return fail(e, "No pudimos aplicar el descuento.");
  }
}
