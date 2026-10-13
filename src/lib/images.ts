import { PRODUCT_IMAGES_BUCKET } from "./config";

/** URL pública de una foto guardada en Supabase Storage. */
export function productImageUrl(storagePath: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!base || !storagePath) return null;
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${encoded}`;
}

export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 8;

const EXTENSIONS_BY_TYPE: Record<AllowedImageType, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
};

/** Valida tipo, extensión y tamaño. Devuelve un mensaje de error o null. */
export function validateImageFile(file: { name: string; type: string; size: number }): string | null {
  if (!(file.type in ALLOWED_IMAGE_TYPES)) {
    return "Formato no permitido. Usá JPG, PNG, WebP o AVIF.";
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS_BY_TYPE[file.type as AllowedImageType].includes(ext)) {
    return "La extensión del archivo no coincide con su formato.";
  }
  if (file.size <= 0) return "El archivo está vacío.";
  if (file.size > MAX_IMAGE_BYTES) return "La foto supera los 5 MB.";
  return null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Ruta esperada de una foto: products/<productId>/<uuid>.<ext> */
export function isValidProductImagePath(path: string, productId: string): boolean {
  const re = new RegExp(`^products/${UUID}/${UUID}\\.(jpg|png|webp|avif)$`);
  return re.test(path) && path.startsWith(`products/${productId}/`);
}
