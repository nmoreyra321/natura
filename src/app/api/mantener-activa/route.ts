import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vercel la llama una vez por día (ver vercel.json). Hace una consulta mínima a la base de datos
 * para que Supabase (plan gratis) no la ponga en pausa si pasa una semana sin visitas.
 */
export async function GET(request: NextRequest) {
  // Si algún día se configura CRON_SECRET en Vercel, solo responde a la tarea automática.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, error: "sin base de datos" }, { status: 503 });
  const { error } = await admin.from("store_settings").select("id").limit(1);
  return Response.json({ ok: !error }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
