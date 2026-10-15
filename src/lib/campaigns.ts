/** Fechas especiales (Día de la Madre, del Padre...): cartel en la portada y página con productos elegidos. */

import { slugify } from "./slug";

export type Campaign = {
  id: string;
  title: string;
  slug: string;
  message: string | null;
  starts_on: string;
  ends_on: string;
  product_ids: string[];
};

/** "2026-10-18" a partir de año, mes (1-12) y día. */
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Día del mes del n-ésimo domingo (n = 1, 2, 3...). */
function nthSunday(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = domingo
  return 1 + ((7 - first) % 7) + (n - 1) * 7;
}

/** Resta días a una fecha "AAAA-MM-DD". */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Preset = { title: string; emoji: string; message: string; day: (year: number) => string };

/** Fechas típicas de Argentina. El cartel empieza a mostrarse 15 días antes. */
export const PRESETS: Preset[] = [
  {
    title: "Día de la Madre",
    emoji: "💐",
    message: "Regalos elegidos para mamá. ¡Pedilo con tiempo!",
    day: (y) => iso(y, 10, nthSunday(y, 10, 3)),
  },
  {
    title: "Día del Padre",
    emoji: "👔",
    message: "Perfumes y regalos para papá.",
    day: (y) => iso(y, 6, nthSunday(y, 6, 3)),
  },
  {
    title: "Día de las Infancias",
    emoji: "🧸",
    message: "Productos para los más chicos de la casa.",
    day: (y) => iso(y, 8, nthSunday(y, 8, 3)),
  },
  { title: "San Valentín", emoji: "❤️", message: "Regalos para tu persona favorita.", day: (y) => iso(y, 2, 14) },
  { title: "Día del Amigo", emoji: "🤝", message: "Un detalle para tus amigas y amigos.", day: (y) => iso(y, 7, 20) },
  { title: "Navidad", emoji: "🎄", message: "Regalos para todos en Navidad.", day: (y) => iso(y, 12, 25) },
  { title: "Reyes", emoji: "👑", message: "Regalos de Reyes.", day: (y) => iso(y, 1, 6) },
];

/** Datos para completar el formulario con una fecha típica: la próxima vez que cae (desde hoy). */
export function presetFor(p: Preset, today: string): { title: string; message: string; starts_on: string; ends_on: string } {
  const year = Number(today.slice(0, 4));
  let day = p.day(year);
  if (day < today) day = p.day(year + 1);
  return { title: `${p.emoji} ${p.title}`, message: p.message, starts_on: addDays(day, -15), ends_on: day };
}

/** ¿Está activa hoy? (fechas "AAAA-MM-DD", hora de Argentina). */
export function isActive(c: Pick<Campaign, "starts_on" | "ends_on">, today: string): boolean {
  return c.starts_on <= today && today <= c.ends_on;
}

/** Dirección de la página del evento: "dia-de-la-madre-2026". */
export function campaignSlug(title: string, startsOn: string): string {
  const base = slugify(title).slice(0, 60) || "fecha-especial";
  return `${base}-${startsOn.slice(0, 4)}`;
}

/** Hoy en Argentina, "AAAA-MM-DD". */
export function todayAR(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(now);
}
