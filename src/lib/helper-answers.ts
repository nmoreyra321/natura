/** Respuestas del ayudante de la tienda. Sin inteligencia artificial: preguntas conocidas con datos reales de la tienda. */

export type HelperInfo = {
  alias: string | null;
  mpSurcharge: number;
  shippingMin: string | null;
  clubMin: string | null;
  giftEvery: number;
  deliveryText: string;
};

export type HelperLink = { label: string; href: string };
export type HelperAnswer = { id: string; text: string; links?: HelperLink[] };

/** Temas que se ofrecen como botones. */
export const HELPER_TOPICS = [
  { id: "comprar", label: "Cómo comprar" },
  { id: "pagos", label: "Formas de pago" },
  { id: "envios", label: "Envíos" },
  { id: "club", label: "El Club" },
  { id: "pedido", label: "¿Dónde está mi pedido?" },
  { id: "buscar", label: "Buscar un producto" },
] as const;

export type HelperTopicId = (typeof HELPER_TOPICS)[number]["id"];

const pct = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });

export function answerFor(topic: HelperTopicId | "revista", info: HelperInfo): HelperAnswer {
  switch (topic) {
    case "comprar":
      return {
        id: topic,
        text: "Elegís tus productos, los sumás al carrito y tocás «Hacer pedido». No hace falta crear una cuenta. Después coordinás la entrega con Mariel por WhatsApp.",
        links: [{ label: "Ver cómo comprar", href: "/como-comprar" }],
      };
    case "pagos": {
      const parts = ["en efectivo al recibir"];
      if (info.alias) parts.push(`por transferencia al alias ${info.alias} (sin recargo; mandás el comprobante por WhatsApp)`);
      if (info.mpSurcharge > 0) parts.push(`con Mercado Pago (se suma un ${pct(info.mpSurcharge)} % a tu compra)`);
      const joined = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} o ${parts.at(-1)}` : parts[0];
      return { id: topic, text: `Podés pagar ${joined}.`, links: [{ label: "Ir al carrito", href: "/carrito" }] };
    }
    case "envios":
      return {
        id: topic,
        text: `Entregamos gratis en puntos de encuentro: ${info.deliveryText} (más que nada los sábados). También hay envío a domicilio en zona sur${info.shippingMin ? `, para compras desde ${info.shippingMin}` : ""}. En el carrito ves si llega tu localidad y cuánto cuesta.`,
      };
    case "club":
      return {
        id: topic,
        text: `Cada ${info.giftEvery} compras${info.clubMin ? ` de ${info.clubMin} o más` : ""} te ganás un regalo. Entrás con tu cuenta y en la página del Club ves cuánto te falta.`,
        links: [{ label: "Ir al Club", href: "/club" }],
      };
    case "pedido":
      return {
        id: topic,
        text: "Podés ver el estado de tu pedido con tu número de pedido. Si tenés cuenta, también lo ves en «Mi cuenta».",
        links: [{ label: "Buscar mi pedido", href: "/mi-pedido" }],
      };
    case "buscar":
      return { id: topic, text: "Escribime lo que buscás (por ejemplo «crema para manos» o «perfume de hombre») y te muestro lo que hay." };
    case "revista":
      return {
        id: topic,
        text: "El precio de revista es el oficial de Natura. Al lado ves el precio de Natu Mariel; si es más bajo, te mostramos cuánto ahorrás.",
      };
  }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const ROUTES: { topic: HelperTopicId | "revista"; words: RegExp }[] = [
  { topic: "pedido", words: /\b(mi pedido|seguimiento|estado|donde esta|donde viene|rastre)/ },
  { topic: "pagos", words: /\b(pago|pagar|transfer|alias|cbu|mercado|efectivo|tarjeta|cuota|debito|credito|recargo)/ },
  { topic: "envios", words: /\b(envio|entrega|entregan|domicilio|retiro|retirar|estacion|punto de encuentro|llega)/ },
  { topic: "club", words: /\b(club|regalo|puntos|fidelidad)/ },
  { topic: "revista", words: /\b(revista|descuento|oferta|ahorro)/ },
  { topic: "comprar", words: /\b(como compro|comprar|hacer (un )?pedido|carrito|cuenta|registr)/ },
];

/** Si el texto habla de un tema conocido devuelve ese tema; si no, null (se busca como producto). */
export function routeText(text: string): HelperTopicId | "revista" | null {
  const t = norm(text);
  return ROUTES.find((r) => r.words.test(t))?.topic ?? null;
}

const FILLER = new Set(["busco", "buscando", "quiero", "quisiera", "necesito", "tienen", "tenes", "hay", "una", "un", "unos", "unas", "para", "de", "el", "la", "los", "las", "me", "por", "favor", "algo", "algun", "alguna", "que", "con"]);

/** Saca palabras de relleno («busco una crema para manos» → «crema manos»). */
export function searchTerm(text: string): string {
  const words = norm(text)
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w));
  return words.join(" ").slice(0, 80);
}
