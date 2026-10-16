import "server-only";

import { cache } from "react";

import { toCents } from "@/lib/pricing";
import { createPublicClient } from "@/lib/supabase/server";

import type { ShippingZoneOption } from "@/lib/delivery";

export type ShippingZone = ShippingZoneOption;

/** Localidades con envío a domicilio (las activas, en orden de cercanía a Glew). */
export const getShippingZones = cache(async (): Promise<ShippingZone[]> => {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("shipping_zones")
    .select("id, name, price")
    .eq("is_active", true)
    .order("position")
    .order("name");
  return (data ?? []).map((z) => ({ id: z.id, name: z.name, priceCents: toCents(z.price) }));
});
