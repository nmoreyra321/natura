"use client";

import { useSyncExternalStore } from "react";

/**
 * Carrito persistido en localStorage. Solo guarda datos de catálogo (nada sensible).
 * Los precios guardados son una referencia: antes de enviar el pedido se vuelven a
 * consultar en la base de datos.
 */

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  size: string | null;
  image: string | null;
  salePrice: number;
  magazinePrice: number;
  stock: number;
  quantity: number;
};

const STORAGE_KEY = "natu-mariel:carrito:v1";
const MAX_ITEMS = 50;

let items: CartItem[] = [];
let hydrated = false;
const listeners = new Set<() => void>();
const EMPTY: CartItem[] = [];

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.productId === "string" &&
    typeof v.slug === "string" &&
    typeof v.name === "string" &&
    typeof v.salePrice === "number" &&
    typeof v.magazinePrice === "number" &&
    typeof v.stock === "number" &&
    typeof v.quantity === "number" &&
    Number.isInteger(v.quantity) &&
    v.quantity > 0
  );
}

function read(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem).slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Modo privado o almacenamiento lleno: el carrito sigue funcionando en memoria.
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function ensureHydrated() {
  if (!hydrated && typeof window !== "undefined") {
    items = read();
    hydrated = true;
  }
}

function set(next: CartItem[]) {
  items = next;
  persist();
  emit();
}

function subscribe(listener: () => void) {
  ensureHydrated();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      items = read();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  ensureHydrated();
  return items;
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/** true una vez que el carrito se leyó del navegador (evita parpadeos de "vacío"). */
export function useCartHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export const cart = {
  /** Agrega unidades respetando el stock. Devuelve la cantidad final en el carrito. */
  add(product: Omit<CartItem, "quantity">, quantity: number): { quantity: number; capped: boolean } {
    ensureHydrated();
    const existing = items.find((i) => i.productId === product.productId);
    const wanted = (existing?.quantity ?? 0) + quantity;
    const finalQty = Math.max(0, Math.min(wanted, product.stock));
    if (finalQty <= 0) return { quantity: existing?.quantity ?? 0, capped: true };
    const updated: CartItem = { ...product, quantity: finalQty };
    if (existing) {
      set(items.map((i) => (i.productId === product.productId ? updated : i)));
    } else {
      if (items.length >= MAX_ITEMS) return { quantity: 0, capped: true };
      set([...items, updated]);
    }
    return { quantity: finalQty, capped: finalQty < wanted };
  },
  setQuantity(productId: string, quantity: number) {
    ensureHydrated();
    set(
      items.flatMap((i) => {
        if (i.productId !== productId) return [i];
        const q = Math.min(Math.max(Math.floor(quantity), 0), i.stock);
        return q > 0 ? [{ ...i, quantity: q }] : [];
      }),
    );
  },
  remove(productId: string) {
    ensureHydrated();
    set(items.filter((i) => i.productId !== productId));
  },
  clear() {
    set([]);
  },
  /** Actualiza precios y stock con los datos vigentes de la base. */
  sync(updates: Map<string, Pick<CartItem, "name" | "slug" | "size" | "image" | "salePrice" | "magazinePrice" | "stock">>, missing: Set<string>) {
    ensureHydrated();
    let changed = false;
    const next = items.flatMap((i) => {
      if (missing.has(i.productId)) {
        changed = true;
        return [];
      }
      const u = updates.get(i.productId);
      if (!u) return [i];
      const quantity = Math.min(i.quantity, u.stock);
      const merged = { ...i, ...u, quantity };
      if (
        merged.salePrice !== i.salePrice ||
        merged.magazinePrice !== i.magazinePrice ||
        merged.stock !== i.stock ||
        merged.quantity !== i.quantity ||
        merged.name !== i.name ||
        merged.image !== i.image ||
        merged.size !== i.size ||
        merged.slug !== i.slug
      ) {
        changed = true;
      }
      if (quantity <= 0) {
        changed = true;
        return [];
      }
      return [merged];
    });
    if (changed) set(next);
  },
};

export function cartCount(list: CartItem[]): number {
  return list.reduce((sum, i) => sum + i.quantity, 0);
}
