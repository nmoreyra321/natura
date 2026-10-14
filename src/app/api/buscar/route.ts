import type { NextRequest } from "next/server";

import { searchSuggestions } from "@/lib/catalog";

/** Sugerencias del buscador instantáneo: GET /api/buscar?q=crema */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ results: [] });

  const results = await searchSuggestions(q);
  if (!results) return Response.json({ results: [], error: "unavailable" }, { status: 503 });

  return Response.json(
    { results },
    // Respuestas iguales para todos: se pueden cachear un rato en la CDN.
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
