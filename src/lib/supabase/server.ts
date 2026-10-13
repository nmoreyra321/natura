import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "@/lib/config";
import type { Database } from "./types";

export const CATALOG_TAG = "catalog";

/**
 * Cliente con la sesión de la persona que navega (cookies).
 * Usa la clave pública (anon): los permisos los decide RLS en la base de datos.
 */
export async function createSessionClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  });
}

/**
 * Cliente público sin sesión para leer el catálogo.
 * Solo ve lo que RLS permite al rol anon: productos publicados y categorías visibles.
 */
export function createPublicClient({ cached = true }: { cached?: boolean } = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createClient<Database>(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      // Lecturas del catálogo cacheadas (se invalidan al guardar desde el panel).
      fetch: cached
        ? (input, init) =>
            fetch(input, { ...init, next: { revalidate: 300, tags: [CATALOG_TAG] } })
        : (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
