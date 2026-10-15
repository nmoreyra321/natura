"use client";

/** Pedidos hechos desde este celular, para encontrarlos en "Seguir mi pedido". Solo el enlace y el código. */
export type SavedOrder = { id: string; code: string; at: string };

const KEY = "natu-mariel:pedidos:v1";
const MAX = 10;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readSavedOrders(): SavedOrder[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (o): o is SavedOrder =>
          !!o && typeof o.id === "string" && UUID_RE.test(o.id) && typeof o.code === "string" && typeof o.at === "string",
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberOrder(order: SavedOrder) {
  try {
    const rest = readSavedOrders().filter((o) => o.id !== order.id);
    window.localStorage.setItem(KEY, JSON.stringify([order, ...rest].slice(0, MAX)));
  } catch {
    // Sin almacenamiento: igual puede buscarlo con el código.
  }
}
