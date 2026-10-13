import { z } from "zod";

import { SLUG_PATTERN } from "./slug";

/** Acepta "12500", "12.500,50", "12500.5" y devuelve un número con 2 decimales. */
export function parseMoney(input: unknown): number {
  if (typeof input === "number") return input;
  if (typeof input !== "string") return NaN;
  let s = input.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!s) return NaN;
  if (s.includes(",")) {
    // Formato argentino: punto de miles y coma decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "12.500" sin decimales → miles.
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}

const money = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => parseMoney(v))
    .refine((n) => Number.isFinite(n), `Ingresá un ${label} válido (ej. 12500 o 12.500,50).`)
    .refine((n) => n > 0, `El ${label} tiene que ser mayor a cero.`)
    .refine((n) => n <= 100_000_000, `El ${label} es demasiado alto.`)
    .transform((n) => Math.round(n * 100) / 100);

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const productSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre tiene que tener al menos 2 caracteres.")
      .max(120, "El nombre puede tener hasta 120 caracteres."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(140, "La URL puede tener hasta 140 caracteres.")
      .refine((v) => v === "" || SLUG_PATTERN.test(v), "Usá solo minúsculas, números y guiones.")
      .optional()
      .transform((v) => v ?? ""),
    description: z
      .string()
      .trim()
      .max(5000, "La descripción puede tener hasta 5000 caracteres.")
      .optional()
      .transform((v) => v ?? ""),
    category_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional()
      .transform((v) => v ?? null)
      .refine((v) => v === null || z.uuid().safeParse(v).success, "Categoría inválida."),
    size: optionalText(60, "La presentación puede tener hasta 60 caracteres."),
    magazine_price: money("precio de revista"),
    sale_price: money("precio especial"),
    stock: z.coerce
      .number({ message: "Ingresá el stock." })
      .int("El stock tiene que ser un número entero.")
      .min(0, "El stock no puede ser negativo.")
      .max(100_000, "El stock es demasiado alto."),
    status: z.enum(["draft", "published"]),
    is_featured: z.coerce.boolean(),
    is_offer: z.coerce.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.is_offer && !(data.sale_price < data.magazine_price)) {
      ctx.addIssue({
        code: "custom",
        path: ["is_offer"],
        message: "Para marcarlo como oferta, el precio especial tiene que ser menor al de revista.",
      });
    }
  });

export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre tiene que tener al menos 2 caracteres.")
    .max(60, "El nombre puede tener hasta 60 caracteres."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(80)
    .refine((v) => v === "" || SLUG_PATTERN.test(v), "Usá solo minúsculas, números y guiones.")
    .optional()
    .transform((v) => v ?? ""),
  description: optionalText(300, "La descripción puede tener hasta 300 caracteres."),
  position: z.coerce.number().int().min(0).max(1000).default(0),
  is_visible: z.coerce.boolean(),
});

export type CategoryInput = z.input<typeof categorySchema>;

export const loginSchema = z.object({
  email: z.email("Ingresá un correo válido.").trim().toLowerCase().max(254),
  password: z.string().min(1, "Ingresá tu contraseña.").max(200),
});

export const cartRequestSchema = z
  .array(
    z.object({
      productId: z.uuid(),
      quantity: z.number().int().min(1).max(999),
    }),
  )
  .max(50);

/** Convierte los errores de Zod en { campo: mensaje } para mostrar en el formulario. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
