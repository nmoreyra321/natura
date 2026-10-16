"use server";

import { revalidatePath } from "next/cache";

import { getCustomer } from "@/lib/customer";
import { toWhatsAppPhone } from "@/lib/debts";
import { createSessionClient } from "@/lib/supabase/server";

export type AccountResult = { ok: true } | { ok: false; error: string };

/** La clienta guarda su nombre y su WhatsApp (con él suma al Club y le escriben por los pedidos). */
export async function saveMyAccount(input: { name: string; phone: string }): Promise<AccountResult> {
  const customer = await getCustomer();
  const supabase = await createSessionClient();
  if (!customer || !supabase) return { ok: false, error: "Tu sesión se cerró. Entrá de nuevo." };
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Escribí tu nombre y apellido." };
  const phone = toWhatsAppPhone(String(input.phone ?? ""));
  if (!phone) return { ok: false, error: "Revisá tu WhatsApp: con código de área, por ejemplo 11 2345-6789." };
  const { error } = await supabase.from("customers").upsert({ user_id: customer.id, name, phone }, { onConflict: "user_id" });
  if (error) {
    console.error("[cuenta] No se pudo guardar:", error.message);
    return { ok: false, error: "No pudimos guardar tus datos. Probá de nuevo." };
  }
  revalidatePath("/cuenta");
  return { ok: true };
}
