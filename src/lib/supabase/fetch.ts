import "server-only";

const RETRIES = 2;

/**
 * fetch que reintenta las LECTURAS (GET/HEAD) cuando falla la conexión con Supabase
 * (en Vercel a veces se corta la conexión antes de responder: "fetch failed", ECONNRESET).
 * Las escrituras no se reintentan, para no duplicar pedidos o pagos.
 */
export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      const networkError = error instanceof TypeError;
      if (!canRetry || !networkError || attempt >= RETRIES || init?.signal?.aborted) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
}
