/** Utilidades para la carga de stock desde la foto de la boleta de Natura. */

const SKU_PREFIX = "NATARG-";

/** Código de Natura solo con números y sin ceros adelante ("00071" → "71"). Null si no parece un código. */
export function codeKey(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "")
    .replace(SKU_PREFIX, "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
  return digits.length >= 2 && digits.length <= 8 ? digits : null;
}

/** Código para guardar en un producto nuevo, tal como figura en la boleta. */
export function skuFromCode(raw: string | null | undefined): string | null {
  const key = codeKey(raw);
  if (!key) return null;
  const printed = String(raw).replace(/\D/g, "");
  return SKU_PREFIX + (printed.length >= key.length ? printed : key);
}

export type RawReceiptItem = { code: string; description: string; quantity: number; unitPrice: number | null; kit?: string };

/** Junta los renglones repetidos (mismo código) y descarta los que no tienen sentido. */
export function mergeReceiptItems(items: RawReceiptItem[]): RawReceiptItem[] {
  const merged = new Map<string, RawReceiptItem>();
  for (const it of items) {
    const quantity = Math.round(Number(it.quantity));
    const description = String(it.description ?? "").trim().slice(0, 160);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 1000 || !description) continue;
    const key = codeKey(it.code) ?? `sin-codigo:${description.toLowerCase()}`;
    const price = Number(it.unitPrice);
    const prev = merged.get(key);
    merged.set(key, {
      code: prev?.code ?? (codeKey(it.code) ? String(it.code).replace(/\D/g, "") : ""),
      description: prev?.description ?? description,
      quantity: (prev?.quantity ?? 0) + quantity,
      unitPrice: prev?.unitPrice ?? (Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null),
      kit: prev?.kit || String(it.kit ?? "").trim().slice(0, 160),
    });
  }
  return [...merged.values()];
}

/** "DES ROLL ON EKOS CASTANHA" → "Des Roll On Ekos Castanha" (punto de partida para crear el producto). */
export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)(\p{L})/gu, (_, sp: string, ch: string) => sp + ch.toUpperCase());
}
