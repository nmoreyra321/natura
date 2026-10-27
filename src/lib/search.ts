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

/** Palabras de relleno: no hace falta que figuren en el nombre para encontrar el producto («kaiak eau de parfum» → «Kaiak»). */
const FILLER = new Set(["de", "del", "la", "el", "las", "los", "para", "y", "con", "eau", "parfum", "perfume", "perfumes", "toilette", "cologne", "deo", "colonia", "fragancia", "fragancias"]);

/** Las palabras que sí identifican el producto (sin relleno). Si todo era relleno, devuelve todas las palabras. */
export function meaningfulWords(q: string): string[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  const keep = words.filter((w) => !FILLER.has(w));
  return keep.length > 0 ? keep : words;
}
