export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Patrones ILIKE para buscar por nombre: una palabra por patrón (todas deben aparecer,
 * en cualquier orden) y vocales comodín para que "jabon" encuentre "Jabón".
 */
export function nameSearchPatterns(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((word) => `%${escapeLike(word).replace(/[aeiouáéíóúü]/g, "_")}%`);
}
