import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Horas que se guarda una reserva (lo fija la base de datos; acá solo para los textos). */
export const RESERVATION_HOURS = 24;

/** Devuelve al stock las reservas vencidas. Se llama antes de mirar stock y una vez por día. Nunca frena a quien la llama. */
export async function releaseExpiredReservations(): Promise<number> {
  try {
    const admin = createAdminClient();
    if (!admin) return 0;
    const { data, error } = await admin.rpc("release_expired_reservations");
    if (error) {
      console.error("[reservas] No se pudieron liberar las vencidas:", error.message);
      return 0;
    }
    return data ?? 0;
  } catch {
    return 0;
  }
}
