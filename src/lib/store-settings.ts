import "server-only";

import { cache } from "react";

import { createPublicClient } from "@/lib/supabase/server";

export type TransferDetails = {
  alias: string | null;
  cbu: string | null;
  holder: string | null;
  bank: string | null;
};

/** Datos para pagar por transferencia (null si no hay alias ni CBU/CVU cargado). */
export const getTransferDetails = cache(async (): Promise<TransferDetails | null> => {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("store_settings")
    .select("transfer_alias, transfer_cbu, transfer_holder, transfer_bank")
    .eq("id", 1)
    .maybeSingle();
  if (!data || (!data.transfer_alias && !data.transfer_cbu)) return null;
  return {
    alias: data.transfer_alias,
    cbu: data.transfer_cbu,
    holder: data.transfer_holder,
    bank: data.transfer_bank,
  };
});

/** % de recargo que paga la clienta si elige Mercado Pago (0 = sin recargo). */
export const getMercadoPagoSurcharge = cache(async (): Promise<number> => {
  const supabase = createPublicClient();
  if (!supabase) return 0;
  const { data } = await supabase.from("store_settings").select("mp_surcharge_percent").eq("id", 1).maybeSingle();
  const n = Number(data?.mp_surcharge_percent ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
});
