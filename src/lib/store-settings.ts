import "server-only";

import { cache } from "react";

import { createPublicClient } from "@/lib/supabase/server";

export type TransferDetails = {
  alias: string | null;
  cbu: string | null;
  holder: string | null;
  bank: string | null;
  /** Link de pago de Mercado Pago sin monto fijo. */
  mpLink: string | null;
};

/** Datos para pagar por transferencia o link de Mercado Pago (null si no hay ninguno cargado). */
export const getTransferDetails = cache(async (): Promise<TransferDetails | null> => {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("store_settings")
    .select("transfer_alias, transfer_cbu, transfer_holder, transfer_bank, mp_link")
    .eq("id", 1)
    .maybeSingle();
  if (!data || (!data.transfer_alias && !data.transfer_cbu && !data.mp_link)) return null;
  return {
    alias: data.transfer_alias,
    cbu: data.transfer_cbu,
    holder: data.transfer_holder,
    bank: data.transfer_bank,
    mpLink: data.mp_link,
  };
});

/** Redes de la tienda (para «Quiénes somos»). */
export const getSocialLinks = cache(async (): Promise<{ facebook: string | null; instagram: string | null }> => {
  const supabase = createPublicClient();
  if (!supabase) return { facebook: null, instagram: null };
  const { data } = await supabase.from("store_settings").select("facebook_url, instagram_url").eq("id", 1).maybeSingle();
  return { facebook: data?.facebook_url ?? null, instagram: data?.instagram_url ?? null };
});

/** % de recargo que paga la clienta si elige Mercado Pago (0 = sin recargo). */
export const getMercadoPagoSurcharge = cache(async (): Promise<number> => {
  const supabase = createPublicClient();
  if (!supabase) return 0;
  const { data } = await supabase.from("store_settings").select("mp_surcharge_percent").eq("id", 1).maybeSingle();
  const n = Number(data?.mp_surcharge_percent ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
});
