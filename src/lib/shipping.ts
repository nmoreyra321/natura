import "server-only";

import { cache } from "react";

import type { ShippingZoneOption } from "@/lib/delivery";
import { createPublicClient } from "@/lib/supabase/server";

export type ShippingZone = ShippingZoneOption;

/** Localidades con envío a domicilio (las activas, en orden de cercanía a Glew). */
export const getShippingZones = cache(async (): Promise<ShippingZone[]> => {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("shipping_zones")
    .select("id, name, percent")
    .eq("is_active", true)
    .order("position")
    .order("name");
  return (data ?? []).map((z) => ({ id: z.id, name: z.name, percent: Number(z.percent) }));
});

/** Compra mínima (en pesos) para poder elegir envío a domicilio. */
export const getShippingMinTotal = cache(async (): Promise<number> => {
  const supabase = createPublicClient();
  if (!supabase) return 35000;
  const { data } = await supabase.from("store_settings").select("shipping_min_total").eq("id", 1).maybeSingle();
  const n = Number(data?.shipping_min_total ?? 35000);
  return Number.isFinite(n) && n >= 0 ? n : 35000;
});
