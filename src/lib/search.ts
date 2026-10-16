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
/** Palabras que la clienta usa pero no figuran así en los nombres de Natura. */
const SYNONYMS: Record<string, string> = {
  perfume: "(perfum|fragancia|colonia|eau de (toilette|parfum|cologne)|deo parfum)",
  perfumes: "(perfum|fragancia|colonia|eau de (toilette|parfum|cologne)|deo parfum)",
  fragancia: "(perfum|fragancia|colonia|eau de (toilette|parfum|cologne)|deo parfum)",
  fragancias: "(perfum|fragancia|colonia|eau de (toilette|parfum|cologne)|deo parfum)",
  colonia: "(colonia|eau de (toilette|cologne))",
};

export function nameSearchPatterns(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((word) =>
      SYNONYMS[word] ??
      [...word]
        .map((c) => {
          const base = BASE[c];
          return base ? `[${VOWELS[base]}]` : escapeRegex(c);
        })
        .join(""),
    );
}
