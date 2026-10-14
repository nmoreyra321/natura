import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/config";
import type { Database } from "./types";

/**
 * Cliente con la clave secreta: saltea RLS. Solo para tareas del servidor que no hace
 * una persona logueada (por ejemplo, anotar un pago que confirmó Mercado Pago).
 * Nunca se usa en el navegador ni con datos que no hayamos verificado antes.
 */
export function createAdminClient() {
  const config = getSupabaseConfig();
  const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!config || !secret) return null;
  return createClient<Database>(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
