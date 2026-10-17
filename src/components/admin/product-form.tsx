"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { saveProduct } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/fields";
import { formatARS } from "@/lib/format";
import { getPriceInfo, salePriceFromDiscount } from "@/lib/pricing";
import { slugify } from "@/lib/slug";
import { parseMoney, productSchema, type ProductData, type ProductInput } from "@/lib/validation";

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  category_id: string;
  size: string;
  line: string;
  natura_sku: string;
  magazine_price: string;
  sale_price: string;
  stock: string;
  status: "draft" | "published";
  is_featured: boolean;
  is_offer: boolean;
  gender: "" | "femenino" | "masculino";
};

export function ProductForm({
  productId,
  defaults,
  categories,
  lines = [],
}: {
  productId: string | null;
  defaults: ProductFormValues;
  categories: { id: string; name: string }[];
  /** Líneas ya usadas, para sugerirlas al escribir. */
  lines?: string[];
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductInput, unknown, ProductData>({
    resolver: zodResolver(productSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  const [magazine, sale, name, slug] = useWatch({ control, name: ["magazine_price", "sale_price", "name", "slug"] });
  const info = getPriceInfo(parseMoney(magazine), parseMoney(sale));
  const bothValid = Number.isFinite(parseMoney(magazine)) && Number.isFinite(parseMoney(sale));

  // Dos formas de poner el precio: un % de descuento sobre la revista, o el precio final.
  const [priceMode, setPriceMode] = useState<"descuento" | "precio">("descuento");
  const [percent, setPercent] = useState(() => {
    const start = getPriceInfo(parseMoney(defaults.magazine_price), parseMoney(defaults.sale_price));
    return start.hasDiscount ? String(start.discountPercent) : defaults.sale_price ? "0" : "";
  });
  const applyDiscount = (magazineRaw: string | number, percentRaw: string) => {
    const pct = Number(percentRaw.replace(",", "."));
    if (percentRaw.trim() === "" || !Number.isFinite(pct)) return;
    const price = salePriceFromDiscount(parseMoney(magazineRaw), pct);
    if (Number.isFinite(price)) setValue("sale_price", String(price), { shouldDirty: true, shouldValidate: true });
  };
  const percentInvalid =
    percent.trim() !== "" && !(Number(percent.replace(",", ".")) >= 0 && Number(percent.replace(",", ".")) < 100);

  const onSubmit = async (data: ProductData) => {
    const res = await saveProduct(productId, data);
    if (!res.ok) {
      // Dice cuál es el problema (no solo "revisá los campos"), por si el campo no se ve en pantalla.
      const details = Object.values(res.fields ?? {}).slice(0, 2).join(" ");
      toast.error(details ? `${res.error} ${details}` : res.error);
      for (const [field, message] of Object.entries(res.fields ?? {})) {
        setError(field as keyof ProductInput, { message });
      }
      return;
    }
    toast.success(res.message ?? "Guardado.");
    if (!productId && res.data) {
      router.push(`/admin/productos/${res.data.id}?nuevo=1`);
    } else {
      router.refresh();
    }
  };

  const err = (k: keyof ProductInput) => errors[k]?.message as string | undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-3xl bg-warm-white p-5 shadow-soft sm:grid-cols-2">
        <h2 className="font-display text-xl font-bold sm:col-span-2">Información</h2>
        <Field label="Nombre" htmlFor="name" error={err("name")} className="sm:col-span-2">
          <Input
            id="name"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            {...register("name", {
              onBlur: () => {
                if (!slug && name) setValue("slug", slugify(name), { shouldDirty: true });
              },
            })}
          />
        </Field>
        <Field
          label="Dirección del producto en la web"
          htmlFor="slug"
          error={err("slug")}
          hint={`Se verá como /productos/${slug || slugify(name || "") || "nombre-del-producto"}. Si la dejás vacía se genera sola.`}
          className="sm:col-span-2"
        >
          <Input id="slug" autoComplete="off" aria-invalid={Boolean(errors.slug)} {...register("slug")} />
        </Field>
        <Field label="Categoría" htmlFor="category_id" error={err("category_id")}>
          <Select id="category_id" {...register("category_id")}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Presentación o tamaño" htmlFor="size" error={err("size")} hint="Ej.: 100 ml, 200 g, kit x3">
          <Input id="size" autoComplete="off" {...register("size")} />
        </Field>
        <Field
          label="Línea Natura (opcional)"
          htmlFor="line"
          error={err("line")}
          hint="Ej.: Chronos, Ekos, Tododia. Las clientas pueden filtrar por línea."
        >
          <Input id="line" autoComplete="off" list="lineas-natura" {...register("line")} />
          <datalist id="lineas-natura">
            {lines.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
        <Field
          label="Código de Natura (opcional)"
          htmlFor="natura_sku"
          error={err("natura_sku")}
          hint="Ej.: NATARG-2821. Sirve para actualizar el precio de revista desde «Precios Natura»."
        >
          <Input id="natura_sku" autoComplete="off" placeholder="NATARG-" {...register("natura_sku")} />
        </Field>
        <Field label="Descripción" htmlFor="description" error={err("description")} className="sm:col-span-2">
          <Textarea id="description" rows={6} {...register("description")} />
        </Field>
      </section>

      <section className="grid gap-4 rounded-3xl bg-warm-white p-5 shadow-soft sm:grid-cols-2">
        <h2 className="font-display text-xl font-bold sm:col-span-2">Precios y stock</h2>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-semibold">¿Cómo querés poner el precio?</p>
          <div role="radiogroup" aria-label="Forma de poner el precio" className="inline-flex rounded-full bg-cream p-1">
            {(
              [
                ["descuento", "Con % de descuento"],
                ["precio", "Precio final"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={priceMode === value}
                onClick={() => {
                  setPriceMode(value);
                  if (value === "descuento") {
                    const now = getPriceInfo(parseMoney(magazine), parseMoney(sale));
                    if (now.hasDiscount) setPercent(String(now.discountPercent));
                  }
                }}
                className={`rounded-full px-4 py-2 text-sm font-bold ${priceMode === value ? "bg-forest text-white" : "text-forest hover:bg-sun"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Precio de revista ($)" htmlFor="magazine_price" error={err("magazine_price")} hint="El precio oficial de la revista Natura.">
          <Input
            id="magazine_price"
            inputMode="decimal"
            placeholder="Ej.: 25.000 o 25000,50"
            aria-invalid={Boolean(errors.magazine_price)}
            {...register("magazine_price", {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                if (priceMode === "descuento") applyDiscount(e.target.value, percent);
              },
            })}
          />
        </Field>
        {priceMode === "descuento" ? (
          <Field
            label="Descuento sobre la revista (%)"
            htmlFor="discount_pct"
            error={percentInvalid ? "Poné un número entre 0 y 99." : err("sale_price")}
            hint={
              Number.isFinite(parseMoney(sale)) && !percentInvalid
                ? `Precio de venta: ${formatARS(Math.round(parseMoney(sale) * 100))}`
                : "Ej.: 25 para venderlo 25% más barato que la revista."
            }
          >
            <div className="flex items-center gap-2">
              <Input
                id="discount_pct"
                inputMode="decimal"
                placeholder="Ej.: 25"
                value={percent}
                aria-invalid={percentInvalid || Boolean(errors.sale_price)}
                onChange={(e) => {
                  setPercent(e.target.value);
                  applyDiscount(String(magazine ?? ""), e.target.value);
                }}
                className="max-w-28"
              />
              <span className="font-bold">%</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[10, 15, 20, 25, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setPercent(String(n));
                    applyDiscount(String(magazine ?? ""), String(n));
                  }}
                  className={`rounded-full border px-3 py-1 text-sm font-bold ${percent === String(n) ? "border-forest bg-forest text-white" : "border-line bg-white hover:bg-sun"}`}
                >
                  {n}%
                </button>
              ))}
            </div>
            <input type="hidden" {...register("sale_price")} />
          </Field>
        ) : (
          <Field label="Precio especial Natu Mariel ($)" htmlFor="sale_price" error={err("sale_price")} hint="El precio al que lo vendés.">
            <Input id="sale_price" inputMode="decimal" placeholder="Ej.: 21.000" aria-invalid={Boolean(errors.sale_price)} {...register("sale_price")} />
          </Field>
        )}
        <div className="rounded-2xl bg-cream p-4 text-sm sm:col-span-2" aria-live="polite">
          {!bothValid ? (
            <span className="text-muted">Completá ambos precios para ver el descuento.</span>
          ) : info.hasDiscount ? (
            <span>
              Los clientes ven <strong>{formatARS(info.saleCents)}</strong> con el precio de revista tachado.
              Ahorro: <strong className="text-botanical-deep">{formatARS(info.savingsCents)}</strong> (
              <strong>{info.discountPercent}%</strong>).
            </span>
          ) : info.saleCents === info.magazineCents ? (
            <span>Los precios son iguales: se muestra un solo precio, sin oferta.</span>
          ) : (
            <span className="font-semibold text-coral-deep">
              El precio especial es mayor al de revista: no se va a mostrar descuento.
            </span>
          )}
        </div>
        <Field label="Stock disponible" htmlFor="stock" error={err("stock")} hint="Con 0 el producto se muestra como “Sin stock” y no se puede agregar al carrito.">
          <Input id="stock" type="number" min={0} step={1} inputMode="numeric" aria-invalid={Boolean(errors.stock)} {...register("stock")} />
        </Field>
      </section>

      <section className="grid gap-3 rounded-3xl bg-warm-white p-5 shadow-soft sm:grid-cols-2">
        <h2 className="font-display text-xl font-bold sm:col-span-2">Visibilidad</h2>
        <Field label="Estado" htmlFor="status" error={err("status")} className="sm:col-span-2">
          <Select id="status" {...register("status")}>
            <option value="draft">Borrador (no se ve en la tienda)</option>
            <option value="published">Publicado (visible en la tienda)</option>
          </Select>
        </Field>
        <Field label="Género (filtro «Género» de la tienda)" htmlFor="gender" error={err("gender")} className="sm:col-span-2">
          <Select id="gender" {...register("gender")}>
            <option value="">Para todos (aparece en Mujer y en Hombre)</option>
            <option value="femenino">Mujer</option>
            <option value="masculino">Hombre</option>
          </Select>
        </Field>
        <Checkbox label="Destacado" description="Aparece en “Los más elegidos” del inicio." {...register("is_featured")} />
        <div>
          <Checkbox label="Oferta" description="Aparece en la sección de ofertas. Requiere descuento real." {...register("is_offer")} />
          {err("is_offer") ? <p role="alert" className="mt-1 text-sm font-medium text-coral-deep">{err("is_offer")}</p> : null}
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-cream/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-3xl sm:border">
        {isDirty ? <span className="mr-auto text-sm text-muted">Tenés cambios sin guardar</span> : null}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Save className="size-5" aria-hidden="true" />}
          {productId ? "Guardar cambios" : "Crear producto"}
        </Button>
      </div>
    </form>
  );
}
