const VOWELS: Record<string, string> = {
  a: "aáàâäAÁÀÂÄ",
  e: "eéèêëEÉÈÊË",
  i: "iíìîïIÍÌÎÏ",
  o: "oóòôöOÓÒÔÖ",
  u: "uúùûüUÚÙÛÜ",
  n: "nñNÑ",
};

const BASE: Record<string, string> = {};
for (const [base, chars] of Object.entries(VOWELS)) for (const c of chars) BASE[c] = base;

function escapeRegex(char: string): string {
  return /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

/**
 * Expresiones para buscar por nombre (operador "imatch" de la base, sin distinguir mayúsculas):
 * una palabra por expresión (todas deben aparecer, en cualquier orden) y cada vocal acepta
 * su versión con tilde, para que "jabon" encuentre "Jabón". A diferencia de un comodín,
 * la vocal no coincide con cualquier letra: "humor" no encuentra "splash Mora".
 */
export function nameSearchPatterns(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((word) =>
      [...word]
        .map((c) => {
          const base = BASE[c];
          return base ? `[${VOWELS[base]}]` : escapeRegex(c);
        })
        .join(""),
    );
}
