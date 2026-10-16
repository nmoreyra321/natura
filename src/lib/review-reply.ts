/**
 * Ideas de respuesta para las reseñas: lee las estrellas y de qué habla la clienta
 * (precio, productos, atención, entrega…) y arma una respuesta corta con su nombre.
 * Cada vez sale distinta y evita las frases ya usadas en otras respuestas.
 * Es todo local (sin servicios pagos).
 */

type Topic = "precio" | "producto" | "aroma" | "atencion" | "entrega" | "compra" | "regalo" | "vuelve" | "recomienda";

const TOPICS: [Topic, RegExp][] = [
  ["precio", /precio|barat|econ[oó]mic|ahorr|oferta|descuento|conviene|plata/i],
  ["aroma", /perfum|aroma|olor|fragancia|huele|colonia/i],
  ["producto", /producto|calidad|hermos|divin|lind|bell|crema|excelente|original/i],
  ["atencion", /atenci[oó]n|amable|atent|buena onda|dulce|genia|responde|trato|simp[aá]tic/i],
  ["entrega", /entreg|lleg[oóa]|r[aá]pid|puntual|env[ií]o|enseguida/i],
  ["compra", /m[eé]todo|compra|f[aá]cil|p[aá]gina|web|pedido|sencill|c[oó]mod|pagar|pago/i],
  ["regalo", /regal|cumple|d[ií]a de la madre|sorpresa/i],
  ["vuelve", /vuelv|volver|otra vez|de nuevo|siempre (le )?compro|clienta/i],
  ["recomienda", /recomiend|recomendable|recomendad/i],
];

const NEGATIVE = /mal|tard|demor|nunca|roto|rota|falt|no (me )?(lleg|gust|respond|contest|anduv)|problema|decepci|horrible|feo|caro|equivoc|vencid/i;

const POS_OPEN = [
  "¡Gracias, {n}!",
  "¡Hola, {n}! Muchísimas gracias.",
  "¡Qué lindo leerte, {n}!",
  "¡Mil gracias, {n}!",
  "{n}, ¡gracias por tomarte el tiempo de escribirnos!",
  "¡Ay, {n}, gracias de corazón!",
  "¡Gracias por la reseña, {n}!",
];

const POS_TOPIC: Record<Topic, string[]> = {
  precio: [
    "Nos esforzamos mucho para que los precios te rindan.",
    "Nos alegra que los precios te hayan convenido.",
    "La idea es que puedas darte el gusto sin gastar de más.",
  ],
  aroma: [
    "¡Ese aroma es de nuestros preferidos!",
    "Nos encanta que te haya gustado la fragancia.",
    "¡Qué bueno que el perfume te haya enamorado!",
  ],
  producto: [
    "Nos alegra muchísimo que te hayan gustado los productos.",
    "Qué bueno que los productos te hayan encantado.",
    "¡Los productos de Natura son una maravilla!",
  ],
  atencion: [
    "Para nosotras es un placer atenderte.",
    "Siempre tratamos de atender como nos gusta que nos atiendan.",
    "Nos pone muy contentas que te hayas sentido bien atendida.",
  ],
  entrega: [
    "Nos alegra que la entrega haya salido tan bien.",
    "Tratamos de que todo llegue rápido y en orden.",
    "¡Qué bueno que haya llegado todo a tiempo!",
  ],
  compra: [
    "Armamos la tienda para que comprar sea fácil y cómodo.",
    "Nos alegra que te haya resultado fácil hacer el pedido.",
    "Qué bueno que el pedido te haya resultado sencillo.",
  ],
  regalo: [
    "¡Ojalá el regalo haya sido un éxito!",
    "Nos encanta ser parte de tus regalos.",
  ],
  vuelve: [
    "Es un gusto tenerte de nuevo por acá.",
    "Gracias por seguir eligiéndonos.",
  ],
  recomienda: [
    "Y gracias por recomendarnos, ¡es lo que más nos ayuda!",
    "Que nos recomiendes vale muchísimo para nosotras.",
  ],
};

const POS_GENERIC = [
  "Nos alegra muchísimo que hayas quedado contenta.",
  "Reseñas como la tuya nos dan ganas de seguir.",
  "Nos hace muy felices saber que te gustó.",
  "Nos alegraste el día.",
];

const POS_CLOSE = [
  "¡Te esperamos en tu próximo pedido! 💕",
  "¡Nos vemos pronto! 🌸",
  "¡Que lo disfrutes mucho! ✨",
  "Acá estamos para lo que necesites. 😊",
  "¡Un beso grande! 💖",
  "¡Hasta la próxima! 🌷",
];

const NEG_OPEN = [
  "{n}, gracias por contarnos tu experiencia.",
  "Hola, {n}. Gracias por avisarnos.",
  "{n}, lamentamos mucho que no haya salido como esperabas.",
  "Hola, {n}. Te pedimos disculpas.",
];

const NEG_MIDDLE = [
  "No es lo que queremos para nuestras clientas y ya lo estamos revisando.",
  "Nos importa mucho que quedes conforme, así que queremos solucionarlo.",
  "Tomamos tu comentario para mejorar.",
];

const NEG_CLOSE = [
  "Escribinos por WhatsApp así lo resolvemos juntas.",
  "Mandanos un mensaje por WhatsApp y lo arreglamos.",
  "Si nos escribís por WhatsApp, lo vemos enseguida.",
];

const MID_OPEN = [
  "¡Gracias por tu reseña, {n}!",
  "Hola, {n}, gracias por escribirnos.",
  "{n}, ¡gracias por tu opinión!",
];

const MID_CLOSE = [
  "Si hay algo que podamos mejorar, contanos por WhatsApp. 😊",
  "Cualquier sugerencia nos sirve muchísimo: escribinos cuando quieras.",
  "Nos encantaría saber qué podemos mejorar para la próxima.",
];

/** Primer nombre, con mayúscula ("giselle arroyo" → "Giselle"). */
export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first ? first[0].toLocaleUpperCase("es-AR") + first.slice(1).toLocaleLowerCase("es-AR") : "";
}

/** De qué habla la reseña. */
export function detectTopics(comment: string): Topic[] {
  return TOPICS.filter(([, re]) => re.test(comment)).map(([t]) => t);
}

type Review = { name: string; rating: number; comment: string | null };

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Arma una respuesta posible (sin mirar las demás respuestas). */
function compose(review: Review, rand: () => number): string {
  const n = firstName(review.name) || "";
  const comment = review.comment ?? "";
  const fill = (s: string) => (n ? s.replace("{n}", n) : s.replace(/,? ?\{n\},?/, "").replace(/^\s*!/, "¡"));
  const negative = review.rating <= 2 || (review.rating <= 3 && NEGATIVE.test(comment));

  if (negative) {
    return [fill(pick(NEG_OPEN, rand)), pick(NEG_MIDDLE, rand), pick(NEG_CLOSE, rand)].join(" ");
  }
  if (review.rating === 3) {
    return [fill(pick(MID_OPEN, rand)), pick(MID_CLOSE, rand)].join(" ");
  }

  // Positiva: hasta dos temas de los que habló, si no habló de ninguno, una frase general.
  const topics = shuffle(detectTopics(comment), rand).slice(0, 2);
  const middle = topics.length ? topics.map((t) => pick(POS_TOPIC[t], rand)) : [pick(POS_GENERIC, rand)];
  return [fill(pick(POS_OPEN, rand)), ...middle, pick(POS_CLOSE, rand)].join(" ");
}

/** Frases de una respuesta, para comparar cuánto se parece a otras. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/[^\p{L}\s]/gu, "").trim().toLowerCase())
    .filter((s) => s.length > 6);
}

/**
 * Sugiere una respuesta: prueba varias y elige la que menos frases comparte con las
 * respuestas que ya existen (así no queda todo igual) y distinta de la anterior.
 */
export function suggestReply(
  review: Review,
  { others = [], previous = "", rand = Math.random }: { others?: string[]; previous?: string; rand?: () => number } = {},
): string {
  const used = new Set(others.flatMap(sentences));
  let best = "";
  let bestScore = Infinity;
  for (let i = 0; i < 24; i++) {
    const candidate = compose(review, rand);
    if (candidate === previous) continue;
    const own = sentences(candidate);
    // Frases ya usadas en otras respuestas, y dos frases que arrancan igual («Nos alegra… Nos alegra…»).
    const starts = own.map((s) => s.split(/\s+/).slice(0, 2).join(" "));
    const repeated = starts.length - new Set(starts).size + (own.filter((s) => /disfrut/.test(s)).length > 1 ? 1 : 0);
    const score = own.filter((s) => used.has(s)).length + repeated * 2;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
      if (score === 0) break;
    }
  }
  return best || compose(review, rand);
}
