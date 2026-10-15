"use client";

import { useSyncExternalStore } from "react";

/** Pedidos hechos desde este celular, para encontrarlos en "Seguir mi pedido". Solo el enlace y el código. */
export type SavedOrder = { id: string; code: string; at: string };

const KEY = "natu-mariel:pedidos:v1";
const HIDDEN_KEY = "natu-mariel:pedido-oculto";
const CHANGE = "natu-mariel:pedidos";
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
    window.dispatchEvent(new Event(CHANGE));
  } catch {
    // Sin almacenamiento: igual puede buscarlo con el código.
  }
}

/** Oculta el aviso del pedido en curso (hasta que haga otro pedido). */
export function hideOrderReminder(id: string) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, id);
    window.dispatchEvent(new Event(CHANGE));
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}

export function readHiddenReminder(): string | null {
  try {
    return window.localStorage.getItem(HIDDEN_KEY);
  } catch {
    return null;
  }
}

const NONE: SavedOrder[] = [];
let cached: { raw: string; list: SavedOrder[] } | null = null;
/** Lee los pedidos guardados sin crear una lista nueva en cada render. */
function snapshot(): SavedOrder[] {
  const list = readSavedOrders();
  const raw = JSON.stringify(list);
  if (cached?.raw !== raw) cached = { raw, list };
  return cached.list;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Pedidos guardados en este celular (lista vacía mientras carga la página). */
export function useSavedOrders(): SavedOrder[] {
  return useSyncExternalStore(subscribe, snapshot, () => NONE);
}


const RECENT_DAYS = 10;
/** El último pedido de los últimos días, si no se ocultó su aviso. */
function recentSnapshot(): SavedOrder | null {
  const last = snapshot()[0];
  if (!last || readHiddenReminder() === last.id) return null;
  const age = Date.now() - new Date(last.at).getTime();
  return age >= 0 && age < RECENT_DAYS * 86_400_000 ? last : null;
}

/** Pedido reciente para mostrar el aviso "Tenés un pedido en curso". */
export function useRecentOrder(): SavedOrder | null {
  return useSyncExternalStore(subscribe, recentSnapshot, () => null);
}
