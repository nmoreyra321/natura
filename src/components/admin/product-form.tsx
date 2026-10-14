"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { saveProduct } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/fields";
import { formatARS } from "@/lib/format";
import { getPriceInfo } from "@/lib/pricing";
import { slugify } from "@/lib/slug";
import { parseMoney, productSchema, type ProductData, type ProductInput } from "@/lib/validation";

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  category_id: string;
  size: string;
  natura_sku: string;
  magazine_price: string;
  sale_price: string;
  stock: string;
  status: "draft" | "published";
  is_featured: boolean;
  is_offer: boolean;
};

export function ProductForm({
  productId,
  defaults,
  categories,
}: {
  productId: string | null;
  defaults: ProductFormValues;
  categories: { id: string; name: string }[];
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

  const onSubmit = async (data: ProductData) => {
    const res = await saveProduct(productId, data);
    if (!res.ok) {
      toast.error(res.error);
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
          label="URL del producto"
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
        <Field label="Precio de revista ($)" htmlFor="magazine_price" error={err("magazine_price")} hint="El precio oficial de la revista Natura.">
          <Input id="magazine_price" inputMode="decimal" placeholder="Ej.: 25.000 o 25000,50" aria-invalid={Boolean(errors.magazine_price)} {...register("magazine_price")} />
        </Field>
        <Field label="Precio especial Natu Mariel ($)" htmlFor="sale_price" error={err("sale_price")} hint="El precio al que lo vendés.">
          <Input id="sale_price" inputMode="decimal" placeholder="Ej.: 21.000" aria-invalid={Boolean(errors.sale_price)} {...register("sale_price")} />
        </Field>
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
        <Field label="Estado" htmlFor="status" className="sm:col-span-2">
          <Select id="status" {...register("status")}>
            <option value="draft">Borrador (no se ve en la tienda)</option>
            <option value="published">Publicado (visible en la tienda)</option>
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
