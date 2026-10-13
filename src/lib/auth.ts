import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createSessionClient } from "@/lib/supabase/server";

export type AdminContext = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSessionClient>>>;
  user: { id: string; email: string | null };
};

/**
 * Verifica la sesión contra Supabase Auth (getUser valida el token en el servidor)
 * y que el usuario figure en admin_users. Devuelve null si no es administradora.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const supabase = await createSessionClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
  if (rpcError || isAdmin !== true) return null;

  return { supabase, user: { id: user.id, email: user.email ?? null } };
});

/** Para páginas del panel: redirige al login si no hay una administradora autenticada. */
export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  return ctx;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("No autorizado");
  }
}

/** Para Server Actions: lanza si no hay permisos (nunca confiar solo en la UI). */
export async function assertAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}
