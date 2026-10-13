/**
 * Configuración pública centralizada.
 * Solo datos NO secretos: todo lo que empieza con NEXT_PUBLIC_ termina en el navegador.
 */

export const SITE_NAME = "Natu Mariel";

export const SITE_DESCRIPTION =
  "Encontrá tus productos favoritos de Natura, de belleza y cuidado personal, a precios especiales.";

function cleanUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.origin;
  } catch {
    return null;
  }
}

/** URL pública del sitio, usada en metadata, sitemap y Open Graph. */
export function getSiteUrl(): string {
  return (
    cleanUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    cleanUrl(
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined,
    ) ??
    "http://localhost:3000"
  );
}

export type SupabasePublicConfig = { url: string; anonKey: string };

/**
 * Clave pública de Supabase. Acepta la nueva "publishable key" (sb_publishable_...)
 * o la clásica "anon key". Ninguna de las dos es secreta: los permisos los define RLS.
 */
export function getSupabasePublicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

/** Devuelve la configuración pública de Supabase o null si falta. */
export function getSupabaseConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = getSupabasePublicKey();
  if (!url || !anonKey) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return { url: url.replace(/\/$/, ""), anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export const PRODUCT_IMAGES_BUCKET = "product-images";

export const LOW_STOCK_THRESHOLD = 3;
