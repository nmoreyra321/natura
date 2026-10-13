"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente del navegador (clave pública). Se usa solo en el panel para subir fotos. */
export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Referencias literales para que Next las incluya en el bundle del navegador.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  client ??= createBrowserClient<Database>(url, anonKey);
  return client;
}
