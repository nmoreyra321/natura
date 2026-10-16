import "server-only";

import { cache } from "react";

import { loyaltyStatus, PURCHASE_STATUSES } from "@/lib/loyalty";
import { getLoyaltyMinTotal } from "@/lib/store-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

/** Clienta con cuenta (entró con Google o Facebook). */
export type Customer = {
  id: string;
  email: string | null;
  name: string | null;
  /** WhatsApp de la cuenta (formato 549…): con él se agrupan sus compras en el Club. */
  phone: string | null;
};

/**
 * La clienta que tiene la sesión iniciada, o null. Las administradoras entran al panel con mail
 * y contraseña: esas sesiones no cuentan como cuenta de clienta.
 */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const supabase = await createSessionClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.provider === "email") return null;
  const { data } = await supabase.from("customers").select("name, phone").eq("user_id", user.id).maybeSingle();
  const meta = user.user_metadata ?? {};
  const metaName = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : null;
  return { id: user.id, email: user.email ?? null, name: data?.name ?? metaName, phone: data?.phone ?? null };
});

/** Avance en el Club de una cuenta: sus compras hechas con la cuenta, agrupadas por su WhatsApp. */
export async function accountClub(phone: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const min = await getLoyaltyMinTotal();
  const [{ count: purchases }, { count: given }] = await Promise.all([
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_phone", phone)
      .not("customer_user_id", "is", null)
      .in("status", [...PURCHASE_STATUSES])
      .eq("payment_status", "approved")
      .gte("total", min),
    admin.from("loyalty_gifts").select("id", { count: "exact", head: true }).eq("phone", phone),
  ]);
  return { ...loyaltyStatus(purchases ?? 0, given ?? 0), minCents: Math.round(min * 100) };
}
