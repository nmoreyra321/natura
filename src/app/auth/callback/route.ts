import { NextResponse, type NextRequest } from "next/server";

import { createSessionClient } from "@/lib/supabase/server";

/** Vuelta de «Continuar con Google / Facebook»: guarda la sesión y lleva a donde estaba. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const raw = searchParams.get("next") ?? "/cuenta";
  // Solo direcciones de la propia tienda (nunca a otro sitio).
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/cuenta";
  if (code) {
    const supabase = await createSessionClient();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? { error: true };
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/cuenta?error=1`);
}
