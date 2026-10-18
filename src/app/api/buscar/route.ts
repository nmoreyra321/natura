import type { NextRequest } from "next/server";

import { getSearchHints, searchSuggestions } from "@/lib/catalog";

/** Sugerencias del buscador instantáneo: GET /api/buscar?q=crema */
export async function GET(request: NextRequest) {
  // GET /api/buscar?ejemplos=1: nombres de productos reales para el cartel que se escribe solo.
  if (request.nextUrl.searchParams.get("ejemplos")) {
    return Response.json({ hints: await getSearchHints() }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
  }
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ results: [] });

  const results = await searchSuggestions(q, 30);
  if (!results) return Response.json({ results: [], error: "unavailable" }, { status: 503 });

  return Response.json(
    { results },
    // Respuestas iguales para todos: se pueden cachear un rato en la CDN.
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
