import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Freno contra abusos: cuenta los intentos de una misma persona (por IP) en una ventana de tiempo.
 * Devuelve false si se pasó del máximo. Si el contador no está disponible, deja pasar
 * (mejor que trabar a una clienta de verdad).
 */
export async function allowRequest(action: string, max: number, windowSeconds: number): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return true;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";
  // La IP no se guarda tal cual: solo un resumen que no se puede revertir.
  const key = `${action}:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
  const { data, error } = await admin.rpc("rate_limit_hit", { p_key: key, p_max: max, p_seconds: windowSeconds });
  if (error) {
    console.error("[freno] No se pudo contar el intento:", error.message);
    return true;
  }
  return data !== false;
}
